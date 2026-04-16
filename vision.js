/**
 * lib/vision.js
 * Image classification and analysis using GPT-4o vision.
 *
 * Three exports:
 *   classifyImages        — batch classify all session images in one call
 *   extractWorkOrder      — structured field extraction from work-order image
 *   summarizeSupportImages — conservative per-image observations (parallel, failure-isolated)
 */

import OpenAI from 'openai';
import config from './config.js';
import { createLogger } from './logger.js';
import {
  SYSTEM_PROMPT as CLASSIFY_SYSTEM,
  userPromptForBatch as classifyUserPrompt,
  JSON_SCHEMA as CLASSIFY_SCHEMA,
  IMAGE_ROLES,
} from './prompts/imageClassify.js';
import {
  SYSTEM_PROMPT as EXTRACT_SYSTEM,
  USER_PROMPT as EXTRACT_USER,
  JSON_SCHEMA as EXTRACT_SCHEMA,
} from './prompts/jobExtract.js';
import {
  systemPromptForRole as summarySystemForRole,
  USER_PROMPT as SUMMARY_USER,
  JSON_SCHEMA as SUMMARY_SCHEMA,
} from './prompts/supportImageSummary.js';

const logger = createLogger('vision');

const client = new OpenAI({ apiKey: config.openai.apiKey });

const VISION_MODEL = 'gpt-4o-2024-08-06';

/**
 * Parse the JSON body from a Responses API call.
 * Responses API with text.format=json_schema guarantees schema-conformant
 * JSON in output_text, but we still wrap the parse for clean error messages.
 */
function parseResponseJson(response, contextLabel) {
  const text = response.output_text;
  if (!text) {
    throw new Error(`${contextLabel}: empty output_text from Responses API`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `${contextLabel}: failed to parse JSON output: ${err.message}. Raw: ${text.slice(0, 500)}`,
    );
  }
}

/**
 * Classify all images in a session in a single model call.
 * A single call lets the model compare images to pick the best work-order
 * candidate and distinguish gutter_before from gutter_after.
 *
 * @param {Array<{storageUrl: string, storageKey: string, contentType?: string}>} images
 * @returns {Promise<{
 *   workOrderIndex: number|null,
 *   supportIndexes: number[],
 *   classifiedImages: Array,
 *   confidenceNotes: string[]
 * }>}
 */
export async function classifyImages(images) {
  try {
    if (!Array.isArray(images) || images.length === 0) {
      return {
        workOrderIndex:   null,
        supportIndexes:   [],
        classifiedImages: [],
        confidenceNotes:  [],
      };
    }

    // Build a single user message containing a text header + every image
    const userContent = [
      { type: 'input_text', text: classifyUserPrompt(images.length) },
      ...images.map((img) => ({
        type:      'input_image',
        image_url: img.storageUrl,
        detail:    'auto',
      })),
    ];

    const response = await client.responses.create({
      model: VISION_MODEL,
      input: [
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user',   content: userContent },
      ],
      text: {
        format: {
          type:   'json_schema',
          name:   CLASSIFY_SCHEMA.name,
          schema: CLASSIFY_SCHEMA.schema,
          strict: CLASSIFY_SCHEMA.strict,
        },
      },
    });

    const parsed = parseResponseJson(response, 'classifyImages');
    const classifications = Array.isArray(parsed.classifications)
      ? parsed.classifications
      : [];

    // Build an index-aligned role array. Any image the model skipped
    // defaults to 'other' with low confidence — no images are ever lost.
    const byIndex = new Map();
    for (const c of classifications) {
      if (
        typeof c.index === 'number' &&
        c.index >= 0 &&
        c.index < images.length &&
        IMAGE_ROLES.includes(c.role)
      ) {
        byIndex.set(c.index, c);
      }
    }

    const classifiedImages = images.map((img, i) => {
      const c = byIndex.get(i);
      return {
        ...img,
        role:          c ? c.role       : 'other',
        roleConfidence: c ? c.confidence : 'low',
        roleReasoning: c ? c.reasoning  : 'Model did not return a classification for this image.',
      };
    });

    // Pick the single best work-order candidate. If multiple images are
    // classified as work_order, prefer the first high-confidence one.
    const workOrderCandidates = classifiedImages
      .map((img, i) => ({ img, i }))
      .filter(({ img }) => img.role === 'work_order');

    let workOrderIndex = null;
    if (workOrderCandidates.length > 0) {
      const highConf = workOrderCandidates.find(({ img }) => img.roleConfidence === 'high');
      workOrderIndex = (highConf || workOrderCandidates[0]).i;
    }

    // Support images = everything except the chosen work order.
    // Extra work-order-looking images are demoted to 'other' so they
    // still appear in the report as site photos.
    const supportIndexes = classifiedImages
      .map((_, i) => i)
      .filter((i) => i !== workOrderIndex);

    if (workOrderIndex !== null) {
      for (const { i } of workOrderCandidates) {
        if (i !== workOrderIndex) {
          classifiedImages[i].role          = 'other';
          classifiedImages[i].roleReasoning = 'Demoted: another image was selected as the primary work order.';
        }
      }
    }

    const confidenceNotes = classifiedImages
      .map((img, i) =>
        img.roleConfidence === 'low'
          ? `Image ${i + 1} (${img.role}): ${img.roleReasoning}`
          : null,
      )
      .filter(Boolean);

    logger.log({
      action:            'classifyImages',
      imageCount:        images.length,
      workOrderIndex,
      supportCount:      supportIndexes.length,
      lowConfidenceCount: confidenceNotes.length,
      success: true,
    });

    return {
      workOrderIndex,
      supportIndexes,
      classifiedImages,
      confidenceNotes,
    };
  } catch (error) {
    logger.logError(error, { action: 'classifyImages', imageCount: images?.length });
    throw error;
  }
}

/**
 * Extract structured job fields from the work-order image.
 *
 * @param {{storageUrl: string, storageKey: string}} image
 * @returns {Promise<{
 *   customerName: string|null,
 *   address: string|null,
 *   jobNumber: string|null,
 *   serviceType: string|null,
 *   serviceDate: string|null,
 *   notes: string|null,
 *   confidence: string
 * }>}
 */
export async function extractWorkOrder(image) {
  try {
    if (!image || !image.storageUrl) {
      throw new Error('extractWorkOrder: image.storageUrl is required');
    }

    const response = await client.responses.create({
      model: VISION_MODEL,
      input: [
        { role: 'system', content: EXTRACT_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'input_text',  text: EXTRACT_USER },
            { type: 'input_image', image_url: image.storageUrl, detail: 'high' },
          ],
        },
      ],
      text: {
        format: {
          type:   'json_schema',
          name:   EXTRACT_SCHEMA.name,
          schema: EXTRACT_SCHEMA.schema,
          strict: EXTRACT_SCHEMA.strict,
        },
      },
    });

    const parsed = parseResponseJson(response, 'extractWorkOrder');

    const result = {
      customerName: parsed.customerName ?? null,
      address:      parsed.address      ?? null,
      jobNumber:    parsed.jobNumber     ?? null,
      serviceType:  parsed.serviceType   ?? null,
      serviceDate:  parsed.serviceDate   ?? null,
      notes:        parsed.visibleNotes  ?? null,
      confidence:   parsed.confidence    ?? 'low',
    };

    logger.log({
      action:              'extractWorkOrder',
      storageKey:          image.storageKey,
      confidence:          parsed.confidence,
      missingFields:       parsed.missingFields,
      extractedFieldCount: Object.values(result).filter((v) => v !== null && v !== 'low' && v !== 'high').length,
      success: true,
    });

    return result;
  } catch (error) {
    logger.logError(error, {
      action:     'extractWorkOrder',
      storageKey: image?.storageKey,
    });
    throw error;
  }
}

/**
 * Generate a single conservative observation for one support image.
 * Internal helper called by summarizeSupportImages.
 */
async function summarizeOne(image) {
  const role = image.role || 'other';

  const response = await client.responses.create({
    model: VISION_MODEL,
    input: [
      { role: 'system', content: summarySystemForRole(role) },
      {
        role: 'user',
        content: [
          { type: 'input_text',  text: SUMMARY_USER },
          { type: 'input_image', image_url: image.storageUrl, detail: 'high' },
        ],
      },
    ],
    text: {
      format: {
        type:   'json_schema',
        name:   SUMMARY_SCHEMA.name,
        schema: SUMMARY_SCHEMA.schema,
        strict: SUMMARY_SCHEMA.strict,
      },
    },
  });

  const parsed = parseResponseJson(response, 'summarizeSupportImages');

  return {
    storageUrl:     image.storageUrl,
    storageKey:     image.storageKey,
    role,
    observation:    parsed.observation,
    confidence:     parsed.confidence,
    visibleIssues:  Array.isArray(parsed.visibleIssues) ? parsed.visibleIssues : [],
    uncertaintyNote: parsed.uncertaintyNote ?? null,
  };
}

/**
 * Generate conservative observations for all support images in parallel.
 * Per-image failures are isolated — one failed image never sinks the batch.
 * Failed images come back with a degraded record so the report still sends.
 *
 * @param {Array} images - classified images with role set
 * @returns {Promise<Array>}
 */
export async function summarizeSupportImages(images) {
  try {
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }

    const results = await Promise.all(
      images.map(async (img) => {
        try {
          return await summarizeOne(img);
        } catch (err) {
          logger.logError(err, {
            action:     'summarizeOne',
            storageKey: img.storageKey,
            role:       img.role,
          });
          return {
            storageUrl:      img.storageUrl,
            storageKey:      img.storageKey,
            role:            img.role || 'other',
            observation:     'Image could not be analyzed automatically.',
            confidence:      'low',
            visibleIssues:   [],
            uncertaintyNote: `Analysis failed: ${err.message}`,
          };
        }
      }),
    );

    logger.log({
      action:            'summarizeSupportImages',
      imageCount:        images.length,
      successCount:      results.filter((r) => r.confidence === 'high').length,
      lowConfidenceCount: results.filter((r) => r.confidence === 'low').length,
      success: true,
    });

    return results;
  } catch (error) {
    logger.logError(error, {
      action:     'summarizeSupportImages',
      imageCount: images?.length,
    });
    throw error;
  }
}
