/**
 * lib/twilio.js
 * Twilio-specific logic only. No session state, no AI calls.
 *
 * Three responsibilities:
 *   1. Verify inbound webhook signatures
 *   2. Download media from Twilio with Basic auth
 *   3. Send outbound WhatsApp replies
 */

import config from './config.js';
import { log, logError } from './logger.js';

const PHASE = 'twilio';

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verify the X-Twilio-Signature header against the exact URL Twilio called.
 *
 * Twilio signs requests using HMAC-SHA1 over:
 *   - The full URL (including query string if present)
 *   - Sorted POST parameters appended as key+value pairs
 *
 * IMPORTANT: The URL must be exactly what Twilio hit — including protocol,
 * host, path, and any query params. Re-encoding or changing it breaks validation.
 *
 * @param {Request}               request  - The raw Next.js Request object
 * @param {string}                exactUrl - The exact URL Twilio called
 * @param {Record<string,string>} params   - Parsed form data as plain object
 * @returns {Promise<boolean>}
 */
export async function verifyTwilioSignature(request, exactUrl, params) {
  const signature = request.headers.get('x-twilio-signature');

  if (!signature) {
    logError(PHASE, new Error('Missing X-Twilio-Signature header'), {
      action: 'verifyTwilioSignature',
      url: exactUrl,
    });
    return false;
  }

  try {
    // Build the signed string: URL + sorted params concatenated
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map((k) => `${k}${params[k]}`).join('');
    const signedString = exactUrl + paramString;

    // HMAC-SHA1 using Web Crypto API (available in Next.js Edge and Node runtimes)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(config.twilio.authToken);
    const messageData = encoder.encode(signedString);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Buffer.from(signatureBuffer).toString('base64');

    const isValid = computedSignature === signature;

    log(PHASE, {
      action: 'verifyTwilioSignature',
      url: exactUrl,
      isValid,
      success: isValid,
    });

    return isValid;
  } catch (error) {
    logError(PHASE, error, {
      action: 'verifyTwilioSignature',
      url: exactUrl,
    });
    return false;
  }
}

// ─── Form data parsing ────────────────────────────────────────────────────────

/**
 * Parse Twilio webhook form data into a structured InboundEvent shape.
 * Extracts all standard fields plus variable-count media items.
 *
 * @param {FormData} formData
 * @returns {Object} Parsed event (media URLs are still Twilio URLs at this point)
 */
export function parseTwilioFormData(formData) {
  const from       = (formData.get('From')       || '').toString().trim();
  const body       = (formData.get('Body')       || '').toString().trim();
  const messageSid = (formData.get('MessageSid') || '').toString().trim();
  const numMedia   = Number(formData.get('NumMedia') || 0);

  const bodyLower = body.toLowerCase();
  let command = null;
  if (bodyLower === 'done')   command = 'done';
  else if (bodyLower === 'cancel') command = 'cancel';
  else if (bodyLower === 'status') command = 'status';

  const media = [];
  for (let i = 0; i < numMedia; i++) {
    const url         = (formData.get(`MediaUrl${i}`)         || '').toString();
    const contentType = (formData.get(`MediaContentType${i}`) || '').toString();
    if (url) {
      media.push({ twilioUrl: url, contentType, index: i });
    }
  }

  return {
    messageSid,
    from,
    body,
    command,
    media,
    receivedAt: new Date().toISOString(),
  };
}

// ─── Media download ───────────────────────────────────────────────────────────

/**
 * Build the Basic auth header for Twilio media downloads.
 * @returns {string}
 */
export function buildTwilioBasicAuthHeader() {
  const credentials = Buffer.from(
    `${config.twilio.accountSid}:${config.twilio.authToken}`
  ).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Download a single media file from Twilio using Basic auth.
 * Returns the raw ArrayBuffer. Caller stores it immediately.
 *
 * @param {string} twilioMediaUrl - The MediaUrl{N} value from Twilio form data
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadTwilioMedia(twilioMediaUrl) {
  const response = await fetch(twilioMediaUrl, {
    headers: {
      Authorization: buildTwilioBasicAuthHeader(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twilio media download failed: ${response.status} ${errorText} (${twilioMediaUrl})`
    );
  }

  const buffer = await response.arrayBuffer();

  log(PHASE, {
    action: 'downloadTwilioMedia',
    url: twilioMediaUrl,
    bytes: buffer.byteLength,
    success: true,
  });

  return buffer;
}

// ─── Outbound replies ─────────────────────────────────────────────────────────

/**
 * Send an outbound WhatsApp message to a technician.
 * Used for command confirmations: status, cancel, done.
 *
 * @param {string} to      - Recipient e.g. "whatsapp:+12035551212"
 * @param {string} message - Plain text message body
 * @returns {Promise<void>}
 */
export async function sendReply(to, message) {
  const body = new URLSearchParams({
    From: `whatsapp:${config.twilio.whatsappFrom}`,
    To:   to,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization:  buildTwilioBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logError(PHASE, new Error(`Twilio reply failed: ${response.status} ${errorText}`), {
      action: 'sendReply',
      to,
    });
    // Don't throw — a failed reply should not crash the main flow
    return;
  }

  log(PHASE, {
    action: 'sendReply',
    to,
    success: true,
  });
}
