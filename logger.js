/**
 * lib/logger.js
 * Structured logging helpers. No business logic.
 * All log entries include standard fields for traceability across the pipeline.
 */

/**
 * Standard log fields present on every entry.
 * @typedef {Object} LogFields
 * @property {string} [messageSid]  - Twilio MessageSid
 * @property {string} [sender]      - Sender phone number
 * @property {string} [sessionKey]  - KV session key
 * @property {string} [phase]       - Pipeline phase e.g. "ingest" | "worker" | "finalize"
 * @property {boolean} [success]    - Whether the operation succeeded
 * @property {number} [latencyMs]   - Operation duration in milliseconds
 * @property {Object} [extra]       - Any additional context
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Emit a structured log entry.
 * @param {string} phase - Pipeline phase label
 * @param {LogFields & Record<string, unknown>} fields
 */
export function log(phase, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    phase,
    ...fields,
  };

  if (isDev) {
    const { timestamp, ...rest } = entry;
    console.log(`[${timestamp}] [${phase}]`, JSON.stringify(rest, null, 2));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Emit a structured error log entry.
 * @param {string} phase - Pipeline phase label
 * @param {Error | unknown} error
 * @param {LogFields & Record<string, unknown>} [fields]
 */
export function logError(phase, error, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    phase,
    success: false,
    error: error instanceof Error
      ? { message: error.message, stack: error.stack }
      : String(error),
    ...fields,
  };

  if (isDev) {
    const { timestamp, ...rest } = entry;
    console.error(`[${timestamp}] [${phase}] ERROR`, JSON.stringify(rest, null, 2));
  } else {
    console.error(JSON.stringify(entry));
  }
}

/**
 * Create a phase-scoped logger that pre-fills the phase field.
 * @param {string} phase
 * @returns {{ log: Function, logError: Function }}
 */
export function createLogger(phase) {
  return {
    log: (fields = {}) => log(phase, fields),
    logError: (error, fields = {}) => logError(phase, error, fields),
  };
}
