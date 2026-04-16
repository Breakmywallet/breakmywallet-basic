/**
 * lib/types.js
 * JSDoc typedefs for all data shapes in the system.
 * No runtime code — import types via JSDoc @type annotations in other modules.
 * All shapes must match the locked data contracts from the spec.
 */

/**
 * @typedef {Object} MediaItem
 * @property {string} storageKey   - Permanent key in Blob storage
 * @property {string} storageUrl   - Permanent URL in Blob storage (never a Twilio URL)
 * @property {string} contentType  - e.g. "image/jpeg" | "audio/ogg"
 * @property {string} receivedAt   - ISO timestamp
 */

/**
 * @typedef {Object} InboundEvent
 * @property {string}      messageSid  - Twilio MessageSid — used for idempotency
 * @property {string}      from        - Sender e.g. "whatsapp:+12035551212"
 * @property {string}      body        - Raw text body of the message
 * @property {string|null} command     - Normalized command: "done" | "cancel" | "status" | null
 * @property {MediaItem[]} media       - Downloaded and stored media items
 * @property {string}      receivedAt  - ISO timestamp
 */

/**
 * @typedef {Object} QueuePayload
 * @property {string}      messageSid  - Twilio MessageSid
 * @property {string}      from        - Sender e.g. "whatsapp:+12035551212"
 * @property {string}      body        - Raw text body
 * @property {string|null} command     - "done" | "cancel" | "status" | null
 * @property {string}      receivedAt  - ISO timestamp
 * @property {MediaItem[]} media       - Stored media items (permanent URLs only)
 */

/**
 * @typedef {Object} TextRecord
 * @property {string} receivedAt  - ISO timestamp
 * @property {string} text        - Message text content
 */

/**
 * @typedef {Object} VoiceNote
 * @property {string} receivedAt         - ISO timestamp
 * @property {string} storageKey         - Key to audio file in Blob storage
 * @property {string} rawTranscript      - Verbatim Whisper output in source language
 * @property {string} englishTranslation - English translation (same as raw if source is English)
 * @property {string} sourceLanguage     - Detected language code e.g. "es" | "uk" | "ru" | "en"
 */

/**
 * @typedef {Object} ImageRef
 * @property {string} receivedAt  - ISO timestamp
 * @property {string} storageKey  - Key in Blob storage
 * @property {string} storageUrl  - Permanent URL
 * @property {string} contentType - e.g. "image/jpeg"
 * @property {string} role        - "unknown" at intake. Set at finalization:
 *                                  "work_order" | "house_exterior" | "gutter_before" |
 *                                  "gutter_after" | "problem_area" | "other"
 */

/**
 * @typedef {Object} JobInfo
 * @property {string|null} customerName  - Extracted customer name
 * @property {string|null} address       - Job site address
 * @property {string|null} jobNumber     - Work order / job number
 * @property {string|null} serviceType   - Type of service performed
 * @property {string|null} serviceDate   - Date visible on work order
 */

/**
 * @typedef {Object} Session
 * @property {string}       from                   - Sender phone e.g. "whatsapp:+12035551212"
 * @property {string}       state                  - "collecting" | "finalizing" | "send_failed"
 * @property {string}       startedAt              - ISO timestamp — first message
 * @property {string}       lastUpdatedAt          - ISO timestamp — updated on every message
 * @property {string[]}     processedMessageSids   - MessageSids already handled (idempotency)
 * @property {TextRecord[]} textMessages           - Non-command text messages
 * @property {VoiceNote[]}  voiceNotes             - Transcribed + translated voice notes
 * @property {ImageRef[]}   images                 - All images (role = "unknown" at intake)
 * @property {JobInfo}      jobInfo                - Null fields until finalization
 */

/**
 * @typedef {Object} SourceOfTruth
 * @property {string|null} customerName  - "image" | "voice" | "text" | null
 * @property {string|null} address       - "image" | "voice" | "text" | null
 * @property {string|null} jobNumber     - "image" | "voice" | "text" | null
 * @property {string|null} serviceType   - "image" | "voice" | "text" | null
 * @property {string|null} serviceDate   - "image" | "voice" | "text" | null
 */

/**
 * @typedef {Object} ImageObservation
 * @property {string} storageUrl   - Permanent image URL
 * @property {string} storageKey   - Storage key for attachment building
 * @property {string} role         - Classified role
 * @property {string} observation  - Conservative one-sentence GPT-4o description
 * @property {string} confidence   - "high" | "low"
 */

/**
 * @typedef {Object} FinalReport
 * @property {Object}            meta
 * @property {string}            meta.from
 * @property {string}            meta.startedAt
 * @property {string}            meta.completedAt
 *
 * @property {Object}            jobInfo
 * @property {string|null}       jobInfo.customerName
 * @property {string|null}       jobInfo.address
 * @property {string|null}       jobInfo.jobNumber
 * @property {string|null}       jobInfo.serviceType
 * @property {string|null}       jobInfo.serviceDate
 * @property {SourceOfTruth}     jobInfo.sourceOfTruth
 *
 * @property {Object}            voice
 * @property {string}            voice.combinedRawTranscript
 * @property {string}            voice.combinedEnglishTranslation
 * @property {string}            voice.cleanedOfficeSummary
 * @property {string[]}          voice.sourceLanguages
 *
 * @property {Object}            images
 * @property {boolean}           images.workOrderImageFound
 * @property {number|null}       images.workOrderImageIndex
 * @property {number}            images.supportImageCount
 * @property {Object}            images.workOrderExtraction
 * @property {ImageObservation[]} images.supportPhotoObservations
 *
 * @property {string[]}          issuesFound
 * @property {string[]}          recommendedActions
 * @property {string}            urgency           - "low" | "monitor" | "repair_estimate"
 * @property {string[]}          missingInfo
 * @property {string[]}          confidenceNotes
 */

export {};
