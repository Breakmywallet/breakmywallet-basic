/**
 * lib/transcription.js
 * Transcribe audio and translate to English if needed.
 * Uses Whisper with verbose_json for language detection.
 * Translates via GPT-4o if sourceLanguage !== 'en'.
 */

import OpenAI from 'openai';
import config from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('transcription');

const client = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Map a content-type string to a filename Whisper will accept.
 * OpenAI's Node SDK requires a File/Blob with a recognizable extension
 * so it can route to the correct decoder.
 */
function filenameForContentType(contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('ogg'))                          return 'audio.ogg';
  if (ct.includes('opus'))                         return 'audio.ogg';
  if (ct.includes('mpeg') || ct.includes('mp3'))   return 'audio.mp3';
  if (ct.includes('mp4') || ct.includes('m4a') || ct.includes('aac')) return 'audio.m4a';
  if (ct.includes('wav'))                          return 'audio.wav';
  if (ct.includes('webm'))                         return 'audio.webm';
  if (ct.includes('flac'))                         return 'audio.flac';
  return 'audio.ogg'; // Twilio WhatsApp default is audio/ogg
}

const SUPPORTED_SOURCE_LANGS = new Set(['es', 'uk', 'ru', 'en']);

/**
 * Translate non-English transcript to English using GPT-4o.
 * Kept faithful — no summarization, no cleanup beyond what the target
 * language naturally requires.
 *
 * @param {string} text
 * @param {string} sourceLanguage
 * @returns {Promise<string>}
 */
async function translateToEnglish(text, sourceLanguage) {
  const response = await client.responses.create({
    model: 'gpt-4o-2024-08-06',
    input: [
      {
        role: 'system',
        content: `You translate field-technician voice-note transcripts into natural English. The source language is ${sourceLanguage}. This is a gutter-cleaning and roof-inspection company, so expect domain terms like gutters, downspouts, fascia, soffit, shingles, flashing, chimney crown, debris, and similar. Translate faithfully — do not summarize, do not add content, do not remove content. Preserve the technician's meaning including hedges, uncertainty, and asides. If the source already contains English words or fragments (common with technicians using English trade terms), keep them as-is. Return only the translated text, no preamble, no quotes, no notes.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  const out = (response.output_text || '').trim();
  if (!out) {
    throw new Error('Translation returned empty output');
  }
  return out;
}

/**
 * Transcribe audio and translate to English if needed.
 *
 * @param {ArrayBuffer} audioBuffer
 * @param {string}      contentType - e.g. "audio/ogg"
 * @returns {Promise<{ rawTranscript: string, englishTranslation: string, sourceLanguage: string }>}
 */
export async function transcribeAndTranslate(audioBuffer, contentType) {
  try {
    const filename = filenameForContentType(contentType);
    const file = new File(
      [audioBuffer],
      filename,
      { type: contentType || 'audio/ogg' },
    );

    const whisperResponse = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      // No language hint — let Whisper auto-detect across es/uk/ru/en
    });

    const rawTranscript = (whisperResponse.text || '').trim();
    const detectedLang  = (whisperResponse.language || '').toLowerCase();

    // Whisper returns language as either an ISO-639-1 code or an English name
    // depending on version. Normalize to code.
    const langNameToCode = {
      spanish:   'es',
      ukrainian: 'uk',
      russian:   'ru',
      english:   'en',
    };
    let sourceLanguage =
      langNameToCode[detectedLang] ||
      (detectedLang.length === 2 ? detectedLang : 'en');

    if (!SUPPORTED_SOURCE_LANGS.has(sourceLanguage)) {
      // Out-of-scope language — fall back to treating as English so the
      // worker can still produce a report rather than hard-failing.
      logger.log({
        action: 'transcribe.unexpected_language',
        detectedLang,
        normalized: sourceLanguage,
        success: true,
      });
      sourceLanguage = 'en';
    }

    if (!rawTranscript) {
      // Empty transcript is not an error — a 1-second accidental voice note
      // can legitimately produce no text. Return empty, let caller decide.
      logger.log({
        action: 'transcribe.empty_transcript',
        sourceLanguage,
        success: true,
      });
      return {
        rawTranscript:      '',
        englishTranslation: '',
        sourceLanguage,
      };
    }

    let englishTranslation;
    if (sourceLanguage === 'en') {
      englishTranslation = rawTranscript;
    } else {
      englishTranslation = await translateToEnglish(rawTranscript, sourceLanguage);
    }

    logger.log({
      action: 'transcribe',
      sourceLanguage,
      rawLength:        rawTranscript.length,
      translatedLength: englishTranslation.length,
      translated:       sourceLanguage !== 'en',
      success: true,
    });

    return {
      rawTranscript,
      englishTranslation,
      sourceLanguage,
    };
  } catch (error) {
    logger.logError(error, { action: 'transcribeAndTranslate' });
    throw error;
  }
}
