/**
 * lib/report.js
 * Assembles the FinalReport object from a finalized session.
 *
 * Orchestration order:
 *   1. Classify all images (single batched call)
 *   2. Extract work-order fields + summarize support images (parallel)
 *   3. Generate office summary from everything
 *   4. Assign CIDs to support images
 *   5. Assemble and return FinalReport
 *
 * Voice notes are already transcribed/translated by the worker at intake.
 * This module only reads them — it does not call Whisper.
 */

import { classifyImages, extractWorkOrder, summarizeSupportImages } from './vision.js';
import {
  OFFICE_SUMMARY_MODEL,
  OFFICE_SUMMARY_SYSTEM_PROMPT,
  OFFICE_SUMMARY_SCHEMA,
  buildOfficeSummaryUserPrompt,
} from './prompts/officeSummary.js';
import config from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('report');

const NULL_JOB_INFO = {
  customerName: null,
  address: null,
  jobNumber: null,
  serviceType: null,
  serviceDate: null,
  notes: null,
  confidence: 'low',
};

// ─── Office summary call ──────────────────────────────────────────────────────

/**
 * Call GPT-4o to generate the structured office summary.
 * This is the one place synthesis and judgment are allowed.
 *
 * @param {Object} jobInfo
 * @param {Array}  voiceNotes
 * @param {Array}  imageObservations
 * @returns {Promise<Object>} — { headline, urgency, workPerformed, condition, repairRecommendations, concerns }
 */
async function generateOfficeSummary(jobInfo, voiceNotes, imageObservations) {
  const userPrompt = buildOfficeSummaryUserPrompt({
    jobInfo,
    voiceNotes,
    imageObservations,
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OFFICE_SUMMARY_MODEL,
      input: [
        { role: 'system', content: OFFICE_SUMMARY_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      text: {
        format: OFFICE_SUMMARY_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Office summary call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const raw = data.output?.[0]?.content?.[0]?.text;

  if (!raw) {
    throw new Error('Office summary: empty response from model');
  }

  return JSON.parse(raw);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Assemble the complete FinalReport from a finalized session.
 * This is called once per job when the tech sends "done".
 *
 * @param {import('./types.js').Session} session
 * @returns {Promise<import('./types.js').FinalReport>}
 */
export async function assembleReport(session) {
  const startTime = Date.now();
  const qualityFlags = [];

  logger.log({
    action: 'assembleReport_start',
    sender: session.from,
    imageCount: session.images.length,
    voiceNoteCount: session.voiceNotes.length,
    textCount: session.textMessages.length,
  });

  // ── Step 1: Classify all images ───────────────────────────────────────────
  // Single batched call so model can compare images for work-order detection.
  let classified;
  try {
    classified = await classifyImages(session.images);
  } catch (error) {
    logger.logError(error, { action: 'classifyImages', sender: session.from });
    throw error; // propagate — without classification we cannot assemble the report
  }

  const { workOrderIndex, supportIndexes, classifiedImages, confidenceNotes } = classified;

  if (confidenceNotes.length > 0) {
    qualityFlags.push(...confidenceNotes);
  }

  // ── Step 2 + 3: Extract work-order fields and summarize support images ─────
  // These don't depend on each other — run in parallel.
  const workOrderImg = workOrderIndex !== null ? classifiedImages[workOrderIndex] : null;
  const supportImgs  = supportIndexes.map((i) => classifiedImages[i]);

  if (!workOrderImg) {
    qualityFlags.push('no_work_order');
  }

  if (session.voiceNotes.length === 0) {
    qualityFlags.push('no_voice_notes');
  }

  if (supportImgs.length === 0 && session.images.length === 0) {
    qualityFlags.push('no_support_images');
  }

  let jobInfo;
  let observations;

  const [jobInfoResult, observationsResult] = await Promise.allSettled([
    workOrderImg
      ? extractWorkOrder(workOrderImg)
      : Promise.resolve({ ...NULL_JOB_INFO }),
    summarizeSupportImages(supportImgs),
  ]);

  // Handle work-order extraction result
  if (jobInfoResult.status === 'fulfilled') {
    jobInfo = jobInfoResult.value;

    if (!jobInfo) {
      jobInfo = { ...NULL_JOB_INFO };
      qualityFlags.push('no_job_info_fields');
    } else {
      if (jobInfo.confidence === 'low') {
        qualityFlags.push('work_order_low_confidence');
      }
      // Check if all fields are null even though extraction succeeded
      const extractedFields = ['customerName', 'address', 'jobNumber', 'serviceType'];
      const allNull = extractedFields.every((f) => !jobInfo[f]);
      if (allNull) qualityFlags.push('no_job_info_fields');
    }
  } else {
    logger.logError(jobInfoResult.reason, {
      action: 'extractWorkOrder',
      sender: session.from,
    });
    jobInfo = { ...NULL_JOB_INFO };
    qualityFlags.push('work_order_extract_failed');
  }

  // Handle support image observations result
  if (observationsResult.status === 'fulfilled') {
    observations = observationsResult.value;

    // Check if majority are low-confidence
    const lowCount = observations.filter((o) => o.confidence === 'low').length;
    if (observations.length > 0 && lowCount / observations.length > 0.5) {
      qualityFlags.push('majority_low_confidence_images');
    }
  } else {
    logger.logError(observationsResult.reason, {
      action: 'summarizeSupportImages',
      sender: session.from,
    });
    // summarizeSupportImages is designed to isolate failures — if it throws
    // entirely, fall back to empty array rather than failing the report
    observations = [];
    qualityFlags.push('image_summary_failed');
  }

  // ── Step 4: Generate office summary ───────────────────────────────────────
  // Filter empty voice note translations before feeding to the prompt
  const validVoiceNotes = session.voiceNotes.filter(
    (vn) => vn.englishTranslation && vn.englishTranslation.trim().length > 0
  );

  const summary = await generateOfficeSummary(jobInfo, validVoiceNotes, observations);

  // ── Step 5: Assign CIDs to support images ─────────────────────────────────
  const workOrderObservation = workOrderImg
    ? {
        storageUrl: workOrderImg.storageUrl,
        storageKey: workOrderImg.storageKey,
        role: 'work_order',
        observation: 'Work-order image — customer and job info extraction source.',
        confidence: workOrderImg.roleConfidence || 'high',
        visibleIssues: [],
        uncertaintyNote: null,
        cid: 'work-order-img',
      }
    : null;

  const supportImagesWithCids = observations.map((obs, i) => ({
    ...obs,
    cid: `img-${i}`,
  }));

  // ── Step 6: Assemble FinalReport ──────────────────────────────────────────
  /** @type {import('./types.js').FinalReport} */
  const report = {
    from: session.from,
    generatedAt: new Date().toISOString(),

    jobInfo: {
      customerName: jobInfo.customerName || null,
      address:      jobInfo.address      || null,
      jobNumber:    jobInfo.jobNumber    || null,
      serviceType:  jobInfo.serviceType  || null,
      serviceDate:  jobInfo.serviceDate  || null,
      notes:        jobInfo.notes        || null,
      confidence:   jobInfo.confidence   || 'low',
    },

    summary: {
      headline:             summary.headline,
      urgency:              summary.urgency,
      workPerformed:        summary.workPerformed,
      condition:            summary.condition,
      repairRecommendations: summary.repairRecommendations || [],
      concerns:             summary.concerns || [],
    },

    voiceNotes: session.voiceNotes.map((vn) => ({
      receivedAt:         vn.receivedAt,
      sourceLanguage:     vn.sourceLanguage,
      rawTranscript:      vn.rawTranscript,
      englishTranslation: vn.englishTranslation,
    })),

    workOrderImage:  workOrderObservation,
    supportImages:   supportImagesWithCids,
    qualityFlags,

    meta: {
      startedAt:    session.startedAt,
      completedAt:  new Date().toISOString(),
      imageCount:   session.images.length,
      voiceCount:   session.voiceNotes.length,
      textCount:    session.textMessages.length,
    },
  };

  logger.log({
    action: 'assembleReport_complete',
    sender: session.from,
    urgency: report.summary.urgency,
    qualityFlags,
    latencyMs: Date.now() - startTime,
    success: true,
  });

  return report;
}
