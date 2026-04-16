/**
 * lib/email.js
 * Renders FinalReport to HTML and sends via Resend.
 *
 * Images are inlined as CID attachments — NOT linked externally.
 * Outlook and many webmail clients block remote images by default.
 * CID inline ensures photos appear without user action.
 *
 * HTML is Outlook-safe: inline styles only, table-based layout,
 * no flexbox, no grid, no external fonts.
 */

import { getMediaBuffer } from './storage.js';
import config from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('email');

// ─── Subject line ─────────────────────────────────────────────────────────────

/**
 * Build a scan-friendly subject line.
 * Priority: jobNumber → customerName → address → sender phone
 *
 * @param {import('./types.js').FinalReport} report
 * @returns {string}
 */
function buildSubject(report) {
  const { jobInfo, summary, from } = report;

  const urgencyLabel = {
    all_clear:    '[All Clear]',
    monitor:      '[Monitor]',
    repair_needed: '[Repair Needed]',
  }[summary.urgency] || '[Field Report]';

  const identifier =
    jobInfo.customerName ||
    jobInfo.address      ||
    from.replace('whatsapp:', '');

  const jobRef  = jobInfo.jobNumber ? ` - ${jobInfo.jobNumber}` : '';
  const service = jobInfo.serviceType || 'Field report';

  return `${urgencyLabel} ${identifier} - ${service}${jobRef}`;
}

// ─── Urgency colors ───────────────────────────────────────────────────────────

const URGENCY_COLORS = {
  all_clear:    { bg: '#16a34a', label: 'All Clear' },
  monitor:      { bg: '#ca8a04', label: 'Monitor' },
  repair_needed: { bg: '#dc2626', label: 'Repair Needed' },
};

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function sectionHeader(title) {
  return `
    <tr>
      <td style="padding: 20px 24px 8px; border-top: 2px solid #e5e7eb;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px;
                  font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase;
                  color: #6b7280;">
          ${title}
        </p>
      </td>
    </tr>`;
}

function infoRow(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding: 3px 24px; font-family: Arial, sans-serif; font-size: 14px; color: #111827;">
        <span style="color: #6b7280; min-width: 120px; display: inline-block;">${label}</span>
        ${value}
      </td>
    </tr>`;
}

function bulletList(items) {
  if (!items || items.length === 0) return '<p style="margin: 4px 0; color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">None</p>';
  return items
    .map((item) => `<p style="margin: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #111827;">• ${item}</p>`)
    .join('');
}

function qualityFlagLabel(flag) {
  const labels = {
    no_work_order:                  'No work-order image was identified',
    work_order_extract_failed:      'Work-order image could not be read — job info unavailable',
    work_order_low_confidence:      'Work-order image was low-confidence — job info may be inaccurate',
    no_voice_notes:                 'No voice notes were received',
    no_support_images:              'No site photos were received',
    majority_low_confidence_images: 'More than half of site photos were low-confidence',
    no_job_info_fields:             'Work order was found but no fields could be extracted',
    image_summary_failed:           'Image analysis failed — photos included as attachments only',
  };
  return labels[flag] || flag;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

/**
 * Render the full HTML email body.
 * @param {import('./types.js').FinalReport} report
 * @returns {string}
 */
function buildHtml(report) {
  const { jobInfo, summary, voiceNotes, workOrderImage, supportImages, qualityFlags, from, generatedAt, meta } = report;
  const urgencyColor = URGENCY_COLORS[summary.urgency] || URGENCY_COLORS.monitor;

  const formattedDate = new Date(generatedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Field Report</title></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0"
         style="background-color: #ffffff; border-radius: 8px; overflow: hidden;
                border: 1px solid #e5e7eb; max-width: 600px;">

    <!-- ── HEADER ── -->
    <tr>
      <td style="background-color: #111827; padding: 20px 24px;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 18px;
                  font-weight: bold; color: #ffffff;">Field Report</p>
        <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px;
                  color: #9ca3af;">${formattedDate} · ${from.replace('whatsapp:', '')}</p>
      </td>
    </tr>

    <!-- ── JOB INFO ── -->
    ${sectionHeader('Job info')}
    ${infoRow('Customer',     jobInfo.customerName)}
    ${infoRow('Address',      jobInfo.address)}
    ${infoRow('Job number',   jobInfo.jobNumber)}
    ${infoRow('Service',      jobInfo.serviceType)}
    ${infoRow('Service date', jobInfo.serviceDate)}
    ${infoRow('Notes',        jobInfo.notes)}
    ${!jobInfo.customerName && !jobInfo.address && !jobInfo.jobNumber ? `
    <tr><td style="padding: 6px 24px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #6b7280; font-style: italic;">
        Job info not available — ${qualityFlags.includes('no_work_order') ? 'no work-order image received' : 'could not be extracted from work order'}.
      </p>
    </td></tr>` : ''}

    <!-- ── STATUS BANNER ── -->
    <tr>
      <td style="padding: 16px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color: ${urgencyColor.bg}; border-radius: 4px; padding: 12px 16px;">
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px;
                        font-weight: bold; color: #ffffff; text-transform: uppercase;
                        letter-spacing: 0.06em;">${urgencyColor.label}</p>
              <p style="margin: 6px 0 0; font-family: Arial, sans-serif; font-size: 15px;
                        color: #ffffff;">${summary.headline}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── SUMMARY ── -->
    ${sectionHeader('Summary')}
    <tr><td style="padding: 8px 24px 4px;">
      <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 12px;
                color: #6b7280; text-transform: uppercase; font-weight: bold; letter-spacing: 0.06em;">
        Work performed
      </p>
      <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
        ${summary.workPerformed}
      </p>
      <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 12px;
                color: #6b7280; text-transform: uppercase; font-weight: bold; letter-spacing: 0.06em;">
        Condition
      </p>
      <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
        ${summary.condition}
      </p>
      ${summary.repairRecommendations.length > 0 ? `
      <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 12px;
                color: #dc2626; text-transform: uppercase; font-weight: bold; letter-spacing: 0.06em;">
        Repair recommendations
      </p>
      <div style="margin: 0 0 12px;">
        ${bulletList(summary.repairRecommendations)}
      </div>` : ''}
      ${summary.concerns.length > 0 ? `
      <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 12px;
                color: #ca8a04; text-transform: uppercase; font-weight: bold; letter-spacing: 0.06em;">
        Concerns
      </p>
      <div style="margin: 0 0 4px;">
        ${bulletList(summary.concerns)}
      </div>` : ''}
    </td></tr>

    <!-- ── VOICE NOTES ── -->
    ${voiceNotes.length > 0 ? `
    ${sectionHeader('Technician voice notes')}
    <tr><td style="padding: 8px 24px;">
      ${voiceNotes.map((vn, i) => `
      <table width="100%" cellpadding="0" cellspacing="0"
             style="margin-bottom: 14px; border-left: 3px solid #e5e7eb;">
        <tr><td style="padding: 8px 12px;">
          <p style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 11px;
                    color: #6b7280; font-weight: bold; text-transform: uppercase;">
            Note ${i + 1} · ${vn.sourceLanguage.toUpperCase()}
          </p>
          ${vn.sourceLanguage !== 'en' ? `
          <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 12px;
                    color: #9ca3af; font-style: italic;">
            Original (${vn.sourceLanguage}): ${vn.rawTranscript || '—'}
          </p>` : ''}
          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px;
                    color: #111827; line-height: 1.6;">
            ${vn.englishTranslation || vn.rawTranscript || '—'}
          </p>
        </td></tr>
      </table>`).join('')}
    </td></tr>` : `
    ${sectionHeader('Technician voice notes')}
    <tr><td style="padding: 8px 24px 12px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; font-style: italic;">
        No voice notes received.
      </p>
    </td></tr>`}

    <!-- ── WORK ORDER IMAGE ── -->
    ${workOrderImage ? `
    ${sectionHeader('Work order image')}
    <tr><td style="padding: 8px 24px 16px;">
      <img src="cid:${workOrderImage.cid}" alt="Work order"
           style="max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; display: block;" />
      <p style="margin: 6px 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280;">
        Work-order image — customer and job info extraction source
      </p>
    </td></tr>` : ''}

    <!-- ── SITE PHOTOS ── -->
    ${supportImages.length > 0 ? `
    ${sectionHeader(`Site photos (${supportImages.length})`)}
    <tr><td style="padding: 8px 24px 16px;">
      ${supportImages.map((img) => {
        const roleLabel = img.role.replace(/_/g, ' ');
        const confNote  = img.confidence === 'low'
          ? `<span style="color: #ca8a04;"> · Low confidence</span>`
          : '';
        const issueStr  = img.visibleIssues && img.visibleIssues.length > 0
          ? `<p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #dc2626;">
               Issues: ${img.visibleIssues.join(', ')}
             </p>`
          : '';
        const uncertaintyNote = img.uncertaintyNote
          ? `<p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; font-style: italic;">
               Note: ${img.uncertaintyNote}
             </p>`
          : '';

        return `
        <table width="100%" cellpadding="0" cellspacing="0"
               style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden;">
          <tr><td>
            <img src="cid:${img.cid}" alt="${roleLabel}"
                 style="max-width: 100%; display: block;" />
          </td></tr>
          <tr><td style="padding: 8px 12px; background-color: #f9fafb;">
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px;
                      font-weight: bold; color: #374151; text-transform: capitalize;">
              ${roleLabel}${confNote}
            </p>
            <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 13px; color: #111827; line-height: 1.5;">
              ${img.observation}
            </p>
            ${issueStr}
            ${uncertaintyNote}
          </td></tr>
        </table>`;
      }).join('')}
    </td></tr>` : ''}

    <!-- ── QUALITY NOTES ── -->
    ${qualityFlags.length > 0 ? `
    ${sectionHeader('Quality notes')}
    <tr><td style="padding: 8px 24px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 4px; padding: 12px;">
        <tr><td style="padding: 10px 12px;">
          ${qualityFlags.map((flag) => `
          <p style="margin: 3px 0; font-family: Arial, sans-serif; font-size: 13px; color: #713f12;">
            • ${qualityFlagLabel(flag)}
          </p>`).join('')}
        </td></tr>
      </table>
    </td></tr>` : ''}

    <!-- ── FOOTER ── -->
    <tr>
      <td style="background-color: #f9fafb; padding: 14px 24px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #9ca3af;">
          ${meta.imageCount} image${meta.imageCount !== 1 ? 's' : ''} ·
          ${meta.voiceCount} voice note${meta.voiceCount !== 1 ? 's' : ''} ·
          Generated ${formattedDate}
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── CID attachment builder ───────────────────────────────────────────────────

/**
 * Fetch all images and build Resend-compatible attachment objects.
 * CID inline images appear in the HTML body as <img src="cid:...">
 *
 * @param {Array} images — supportImages + workOrderImage from FinalReport
 * @returns {Promise<Array>} — Resend attachment objects
 */
async function buildCidAttachments(images) {
  const results = await Promise.allSettled(
    images.map(async (img) => {
      const buffer = await getMediaBuffer(img.storageUrl);
      const base64 = buffer.toString('base64');
      const ext = img.contentType?.split('/')[1] || 'jpg';
      const filename = `${img.cid}.${ext}`;

      return {
        filename,
        content: base64,
        content_id: img.cid,
        content_type: img.contentType || 'image/jpeg',
      };
    })
  );

  const attachments = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      attachments.push(result.value);
    } else {
      logger.logError(result.reason, {
        action: 'buildCidAttachments',
        imageIndex: i,
        storageUrl: images[i]?.storageUrl,
      });
      // Skip failed images — report still sends without them
    }
  });

  return attachments;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Render FinalReport to HTML email and send via Resend.
 * Images are embedded inline as CID attachments.
 *
 * @param {import('./types.js').FinalReport} report
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendReportEmail(report) {
  const startTime = Date.now();

  // ── Collect all images that need CID embedding ────────────────────────────
  const allImages = [
    ...(report.workOrderImage ? [report.workOrderImage] : []),
    ...report.supportImages,
  ];

  // ── Fetch image buffers and build attachments ─────────────────────────────
  const attachments = await buildCidAttachments(allImages);

  logger.log({
    action: 'sendReportEmail_attachments',
    sender: report.from,
    requested: allImages.length,
    resolved: attachments.length,
  });

  // ── Build HTML ────────────────────────────────────────────────────────────
  const html = buildHtml(report);
  const subject = buildSubject(report);

  // ── Send via Resend ───────────────────────────────────────────────────────
  const payload = {
    from:    config.email.from,
    to:      [config.email.to],
    subject,
    html,
    attachments,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Resend failed: ${response.status} ${responseText}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { id: 'unknown' };
  }

  logger.log({
    action: 'sendReportEmail_sent',
    sender: report.from,
    messageId: result.id,
    urgency: report.summary.urgency,
    attachmentCount: attachments.length,
    latencyMs: Date.now() - startTime,
    success: true,
  });

  return { messageId: result.id };
}
