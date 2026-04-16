/**
 * lib/config.js
 * Centralized environment variable validation and access.
 * Import this first in every module. Throws on startup if any required var is missing.
 */

const REQUIRED_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'WORKER_URL',
  'REPORT_EMAIL_TO',
  'REPORT_EMAIL_FROM',
];

function validate() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required environment variables:\n  ${missing.join('\n  ')}`
    );
  }

  return {
    twilio: {
      accountSid:   process.env.TWILIO_ACCOUNT_SID,
      authToken:    process.env.TWILIO_AUTH_TOKEN,
      whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY,
    },
    kv: {
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    },
    qstash: {
      token:             process.env.QSTASH_TOKEN,
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY,
    },
    blob: {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    },
    worker: {
      url: process.env.WORKER_URL,
    },
    email: {
      to:   process.env.REPORT_EMAIL_TO,
      from: process.env.REPORT_EMAIL_FROM,
    },
  };
}

const config = validate();

export default config;
