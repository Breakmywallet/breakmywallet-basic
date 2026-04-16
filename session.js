/**
 * lib/session.js
 * KV-backed session management for the field reporting pipeline.
 * One session per technician phone number, keyed by sender.
 * All functions are pure KV operations — no AI calls, no business logic.
 *
 * @imports types: Session, VoiceNote, ImageRef, TextRecord, JobInfo
 */

import config from './config.js';
import { log, logError } from './logger.js';

const PHASE = 'session';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

// ─── KV primitives ────────────────────────────────────────────────────────────

function kvHeaders() {
  return {
    Authorization: `Bearer ${config.kv.token}`,
    'Content-Type': 'application/json',
  };
}

async function kvCommand(command) {
  const response = await fetch(config.kv.url, {
    method: 'POST',
    headers: kvHeaders(),
    body: JSON.stringify(command),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KV command failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function kvGet(key) {
  const result = await kvCommand(['GET', key]);
  if (!result || result.result == null) return null;
  try {
    return JSON.parse(result.result);
  } catch {
    return null;
  }
}

async function kvSet(key, value, expirySeconds) {
  const args = ['SET', key, JSON.stringify(value)];
  if (expirySeconds) {
    args.push('EX', expirySeconds);
  }
  return await kvCommand(args);
}

async function kvDelete(key) {
  return await kvCommand(['DEL', key]);
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

/**
 * KV key for a session.
 * @param {string} from - e.g. "whatsapp:+12035551212"
 * @returns {string}
 */
export function sessionKey(from) {
  return `session:${from}`;
}

/**
 * KV key for finalization idempotency guard.
 * @param {string} from
 * @returns {string}
 */
export function finalizedKey(from) {
  return `finalized:${sessionKey(from)}`;
}

/**
 * KV key for message-level idempotency guard.
 * @param {string} messageSid
 * @returns {string}
 */
export function messageKey(messageSid) {
  return `message:${messageSid}`;
}

// ─── Session normalization ────────────────────────────────────────────────────

/**
 * Build a normalized session object — creates a new one or repairs an existing one.
 * Always returns a structurally complete session.
 * @param {string} from
 * @param {Object|null} existing
 * @returns {import('./types.js').Session}
 */
export function normalizeSession(from, existing) {
  const now = new Date().toISOString();
  return {
    from: existing?.from || from,
    state: existing?.state || 'collecting',
    startedAt: existing?.startedAt || now,
    lastUpdatedAt: now,
    processedMessageSids: Array.isArray(existing?.processedMessageSids)
      ? existing.processedMessageSids
      : [],
    textMessages: Array.isArray(existing?.textMessages)
      ? existing.textMessages
      : [],
    voiceNotes: Array.isArray(existing?.voiceNotes)
      ? existing.voiceNotes
      : [],
    images: Array.isArray(existing?.images)
      ? existing.images
      : [],
    jobInfo: existing?.jobInfo || {
      customerName: null,
      address: null,
      jobNumber: null,
      serviceType: null,
      serviceDate: null,
    },
  };
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

/**
 * Load and normalize a session from KV. Returns a new session if none exists.
 * @param {string} from
 * @returns {Promise<import('./types.js').Session>}
 */
export async function getSession(from) {
  const key = sessionKey(from);
  const existing = await kvGet(key);
  const session = normalizeSession(from, existing);

  log(PHASE, {
    action: 'getSession',
    sender: from,
    sessionKey: key,
    isNew: !existing,
  });

  return session;
}

/**
 * Persist a session to KV. Updates lastUpdatedAt before saving.
 * Sessions auto-expire after 24h as a safety net (20-min inactivity handled in isSessionExpired).
 * @param {string} from
 * @param {import('./types.js').Session} session
 * @returns {Promise<void>}
 */
export async function saveSession(from, session) {
  const key = sessionKey(from);
  session.lastUpdatedAt = new Date().toISOString();

  await kvSet(key, session, 60 * 60 * 24); // 24h hard expiry in KV

  log(PHASE, {
    action: 'saveSession',
    sender: from,
    sessionKey: key,
    state: session.state,
    textCount: session.textMessages.length,
    voiceCount: session.voiceNotes.length,
    imageCount: session.images.length,
  });
}

/**
 * Delete a session from KV. Only called after confirmed email send.
 * @param {string} from
 * @returns {Promise<void>}
 */
export async function deleteSession(from) {
  const key = sessionKey(from);
  await kvDelete(key);

  log(PHASE, {
    action: 'deleteSession',
    sender: from,
    sessionKey: key,
  });
}

// ─── Session state transitions ────────────────────────────────────────────────

/**
 * Mark session as finalizing. Prevents concurrent finalization attempts.
 * @param {import('./types.js').Session} session
 * @returns {import('./types.js').Session}
 */
export function setFinalizing(session) {
  session.state = 'finalizing';
  return session;
}

/**
 * Mark session as send_failed. Preserves session so email can be retried.
 * @param {import('./types.js').Session} session
 * @returns {import('./types.js').Session}
 */
export function markSendFailed(session) {
  session.state = 'send_failed';
  return session;
}

// ─── Append helpers ───────────────────────────────────────────────────────────

/**
 * Append a text message to the session. Mutates and returns session.
 * Caller is responsible for saving.
 * @param {import('./types.js').Session} session
 * @param {string} text
 * @returns {import('./types.js').Session}
 */
export function appendText(session, text) {
  session.textMessages.push({
    receivedAt: new Date().toISOString(),
    text,
  });
  return session;
}

/**
 * Append a transcribed voice note to the session. Mutates and returns session.
 * Caller is responsible for saving.
 * @param {import('./types.js').Session} session
 * @param {Object} voiceNote
 * @param {string} voiceNote.storageKey
 * @param {string} voiceNote.rawTranscript
 * @param {string} voiceNote.englishTranslation
 * @param {string} voiceNote.sourceLanguage
 * @returns {import('./types.js').Session}
 */
export function appendVoiceNote(session, voiceNote) {
  session.voiceNotes.push({
    receivedAt: new Date().toISOString(),
    ...voiceNote,
  });
  return session;
}

/**
 * Append an image reference to the session. Role is always "unknown" at intake.
 * Mutates and returns session. Caller is responsible for saving.
 * @param {import('./types.js').Session} session
 * @param {Object} image
 * @param {string} image.storageKey
 * @param {string} image.storageUrl
 * @param {string} image.contentType
 * @returns {import('./types.js').Session}
 */
export function appendImage(session, image) {
  session.images.push({
    receivedAt: new Date().toISOString(),
    role: 'unknown',
    ...image,
  });
  return session;
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Check if a MessageSid has already been processed.
 * @param {string} messageSid
 * @returns {Promise<boolean>}
 */
export async function isSidProcessed(messageSid) {
  const key = messageKey(messageSid);
  const result = await kvGet(key);
  return result !== null;
}

/**
 * Mark a MessageSid as processed. Set with 48h expiry — long enough to catch
 * any Twilio retry window, short enough not to accumulate indefinitely.
 * @param {string} messageSid
 * @returns {Promise<void>}
 */
export async function markSidProcessed(messageSid) {
  const key = messageKey(messageSid);
  await kvSet(key, 1, 60 * 60 * 48); // 48h expiry
}

/**
 * Check if a session has already been finalized (email sent).
 * @param {string} from
 * @returns {Promise<boolean>}
 */
export async function isFinalized(from) {
  const key = finalizedKey(from);
  const result = await kvGet(key);
  return result !== null;
}

/**
 * Mark a session as finalized after successful email send.
 * Set with 48h expiry to handle any delayed done retries.
 * @param {string} from
 * @returns {Promise<void>}
 */
export async function markFinalized(from) {
  const key = finalizedKey(from);
  await kvSet(key, 1, 60 * 60 * 48); // 48h expiry

  log(PHASE, {
    action: 'markFinalized',
    sender: from,
  });
}

// ─── Timeout check ────────────────────────────────────────────────────────────

/**
 * Check if a session has exceeded the 20-minute inactivity timeout.
 * @param {import('./types.js').Session} session
 * @returns {boolean}
 */
export function isSessionExpired(session) {
  const lastUpdated = new Date(session.lastUpdatedAt).getTime();
  const now = Date.now();
  return now - lastUpdated > SESSION_TIMEOUT_MS;
}

// ─── Status summary ───────────────────────────────────────────────────────────

/**
 * Build a human-readable status string for the tech's WhatsApp reply.
 * @param {import('./types.js').Session} session
 * @returns {string}
 */
export function buildStatusSummary(session) {
  const workOrderCandidate = session.images.some(
    (img) => img.role === 'work_order'
  );

  const hasWorkOrderCandidate =
    workOrderCandidate || session.images.length > 0
      ? 'possibly yes'
      : 'no';

  return [
    `Session open.`,
    `Text notes: ${session.textMessages.length}`,
    `Voice notes: ${session.voiceNotes.length}`,
    `Images: ${session.images.length}`,
    `Work-order candidate: ${hasWorkOrderCandidate}`,
    `Send "done" to finalize or "cancel" to discard.`,
  ].join(' · ');
}
