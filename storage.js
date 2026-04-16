/**
 * lib/storage.js
 * Durable media storage using Vercel Blob.
 * All Twilio media is downloaded and stored here immediately at ingest.
 * Twilio URLs are never stored anywhere in the system after this point.
 *
 * Vercel Blob docs: https://vercel.com/docs/storage/vercel-blob
 */

import { put, get, del } from '@vercel/blob';
import config from './config.js';
import { log, logError } from './logger.js';

const PHASE = 'storage';

/**
 * Generate a deterministic storage filename.
 * Format: {messageSid}/{index}-{timestamp}.{ext}
 * @param {string} messageSid
 * @param {number} index
 * @param {string} contentType
 * @returns {string}
 */
function buildFilename(messageSid, index, contentType) {
  const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
  const ts = Date.now();
  return `media/${messageSid}/${index}-${ts}.${ext}`;
}

/**
 * Upload a media buffer to Vercel Blob.
 * Returns the permanent storageKey and storageUrl.
 * Called at ingest — never store the Twilio URL after this returns.
 *
 * @param {ArrayBuffer} buffer       - Raw media bytes
 * @param {string}      contentType  - e.g. "image/jpeg" | "audio/ogg"
 * @param {Object}      metadata
 * @param {string}      metadata.messageSid
 * @param {number}      metadata.index       - Media index within the message (0-based)
 * @returns {Promise<{ storageKey: string, storageUrl: string }>}
 */
export async function storeMedia(buffer, contentType, metadata) {
  const { messageSid, index = 0 } = metadata;
  const filename = buildFilename(messageSid, index, contentType);

  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
      token: config.blob.token,
    });

    log(PHASE, {
      action: 'storeMedia',
      messageSid,
      storageKey: filename,
      storageUrl: blob.url,
      contentType,
      success: true,
    });

    return {
      storageKey: filename,
      storageUrl: blob.url,
    };
  } catch (error) {
    logError(PHASE, error, {
      action: 'storeMedia',
      messageSid,
      contentType,
    });
    throw error;
  }
}

/**
 * Fetch a stored media file as a Buffer.
 * Used by email.js to embed images inline via CID, and by vision.js if needed.
 *
 * @param {string} storageUrl - The permanent Blob URL returned from storeMedia
 * @returns {Promise<Buffer>}
 */
export async function getMediaBuffer(storageUrl) {
  try {
    const response = await fetch(storageUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from storage: ${response.status} ${storageUrl}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    log(PHASE, {
      action: 'getMediaBuffer',
      storageUrl,
      bytes: buffer.length,
      success: true,
    });

    return buffer;
  } catch (error) {
    logError(PHASE, error, {
      action: 'getMediaBuffer',
      storageUrl,
    });
    throw error;
  }
}

/**
 * Delete a stored media file. Optional — used for cleanup after session deletion
 * if media retention is not required.
 *
 * @param {string} storageUrl - The permanent Blob URL to delete
 * @returns {Promise<void>}
 */
export async function deleteMedia(storageUrl) {
  try {
    await del(storageUrl, { token: config.blob.token });

    log(PHASE, {
      action: 'deleteMedia',
      storageUrl,
      success: true,
    });
  } catch (error) {
    // Log but don't throw — deletion failure should not block session cleanup
    logError(PHASE, error, {
      action: 'deleteMedia',
      storageUrl,
    });
  }
}

/**
 * Fetch multiple media files as buffers in parallel.
 * Used by email.js to prepare all images for CID embedding in one shot.
 *
 * @param {string[]} storageUrls
 * @returns {Promise<Buffer[]>} - Buffers in same order as input URLs
 */
export async function getMediaBuffers(storageUrls) {
  return Promise.all(storageUrls.map((url) => getMediaBuffer(url)));
}
