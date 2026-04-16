/**
 * lib/queue.js
 * QStash-backed queue publisher.
 * Abstracts the queue provider — the rest of the system never imports QStash directly.
 *
 * QStash docs: https://upstash.com/docs/qstash/overall/getstarted
 *
 * publishWorkerJob sends a QueuePayload to the worker route via QStash.
 * QStash handles: retries on non-2xx, DLQ, delivery ordering, deduplication headers.
 */

import config from './config.js';
import { log, logError } from './logger.js';

const PHASE = 'queue';
const QSTASH_PUBLISH_URL = 'https://qstash.upstash.io/v2/publish';

/**
 * Publish a worker job to QStash.
 * QStash will deliver the payload to WORKER_URL via HTTP POST.
 * Retries automatically on non-2xx responses from the worker.
 *
 * @param {import('./types.js').QueuePayload} payload
 * @returns {Promise<void>}
 */
export async function publishWorkerJob(payload) {
  const workerUrl = config.worker.url;

  if (!workerUrl) {
    throw new Error('[queue] WORKER_URL is not configured');
  }

  const response = await fetch(`${QSTASH_PUBLISH_URL}/${encodeURIComponent(workerUrl)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.qstash.token}`,
      'Content-Type': 'application/json',
      // Deduplication: QStash won't re-deliver a message with the same ID
      // within the deduplication window. Use MessageSid as the dedup key.
      'Upstash-Deduplication-Id': payload.messageSid,
      // Retry policy: 3 attempts with exponential backoff
      'Upstash-Retries': '3',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `QStash publish failed: ${response.status} ${errorText}`
    );
  }

  const result = await response.json();

  log(PHASE, {
    action: 'publishWorkerJob',
    messageSid: payload.messageSid,
    sender: payload.from,
    qstashMessageId: result.messageId,
    workerUrl,
    success: true,
  });
}
