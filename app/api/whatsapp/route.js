/**
 * app/api/whatsapp/route.js
 * Twilio ingest handler — the thinnest possible entry point.
 *
 * Responsibilities (in order):
 *   1. Verify Twilio signature
 *   2. Parse form data
 *   3. Check MessageSid idempotency
 *   4. Download all media from Twilio
 *   5. Store media to permanent Blob storage
 *   6. Publish worker job to QStash
 *   7. Return 200 immediately
 *
 * This route must NEVER:
 *   - Call OpenAI
 *   - Mutate session state
 *   - Build reports
 *   - Send email
 *   - Block on any slow operation after enqueue
 */

import { verifyTwilioSignature, parseTwilioFormData, downloadTwilioMedia } from '../../../lib/twilio.js';
import { storeMedia } from '../../../lib/storage.js';
import { isSidProcessed, markSidProcessed } from '../../../lib/session.js';
import { publishWorkerJob } from '../../../lib/queue.js';
import { log, logError } from '../../../lib/logger.js';

const PHASE = 'ingest';

export async function POST(request) {
  const startTime = Date.now();

  // ── 1. Verify Twilio signature ─────────────────────────────────────────────
  // Must use the exact URL Twilio called — including protocol and host.
  const exactUrl = `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}${request.nextUrl?.pathname || '/api/whatsapp'}`;

  // Clone request to read body twice (once for sig verification, once for parsing)
  const clonedRequest = request.clone();
  const formData = await request.formData();

  // Build plain object of form params for signature verification
  const params = {};
  for (const [key, value] of formData.entries()) {
    params[key] = value.toString();
  }

  const isValid = await verifyTwilioSignature(clonedRequest, exactUrl, params);

  if (!isValid) {
    logError(PHASE, new Error('Invalid Twilio signature'), {
      url: exactUrl,
    });
    return new Response('Forbidden', { status: 403 });
  }

  // ── 2. Parse form data ─────────────────────────────────────────────────────
  const event = parseTwilioFormData(formData);

  log(PHASE, {
    action: 'received',
    messageSid: event.messageSid,
    sender: event.from,
    command: event.command,
    mediaCount: event.media.length,
  });

  // ── 3. Check MessageSid idempotency ────────────────────────────────────────
  // Twilio can deliver the same webhook twice. Silently accept duplicates.
  const alreadyProcessed = await isSidProcessed(event.messageSid);

  if (alreadyProcessed) {
    log(PHASE, {
      action: 'duplicate',
      messageSid: event.messageSid,
      sender: event.from,
    });
    return new Response('OK', { status: 200 });
  }

  // ── 4 + 5. Download media from Twilio → store to permanent Blob ───────────
  // Must happen in ingest — Twilio URLs are not guaranteed to persist.
  const storedMedia = [];

  for (const item of event.media) {
    try {
      const buffer = await downloadTwilioMedia(item.twilioUrl);
      const stored = await storeMedia(buffer, item.contentType, {
        messageSid: event.messageSid,
        index: item.index,
      });

      storedMedia.push({
        storageKey: stored.storageKey,
        storageUrl: stored.storageUrl,
        contentType: item.contentType,
        receivedAt: event.receivedAt,
      });
    } catch (error) {
      // Log but continue — partial media is better than dropping the whole message
      logError(PHASE, error, {
        action: 'storeMedia',
        messageSid: event.messageSid,
        mediaIndex: item.index,
        sender: event.from,
      });
    }
  }

  // ── 6. Mark sid as seen + publish to QStash ────────────────────────────────
  // Mark before enqueue — if enqueue fails, the message will be retried by Twilio
  // and the idempotency check will pass on the retry.
  await markSidProcessed(event.messageSid);

  /** @type {import('../../../lib/types.js').QueuePayload} */
  const payload = {
    messageSid: event.messageSid,
    from: event.from,
    body: event.body,
    command: event.command,
    receivedAt: event.receivedAt,
    media: storedMedia,
  };

  await publishWorkerJob(payload);

  log(PHASE, {
    action: 'enqueued',
    messageSid: event.messageSid,
    sender: event.from,
    storedMediaCount: storedMedia.length,
    latencyMs: Date.now() - startTime,
    success: true,
  });

  // ── 7. Return 200 immediately ──────────────────────────────────────────────
  // Twilio requires a 200 within its timeout window.
  // All actual processing happens in the worker.
  return new Response('OK', { status: 200 });
}

// Health check
export async function GET() {
  return new Response('Ingest route active', { status: 200 });
}
