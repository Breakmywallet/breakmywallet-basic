import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
}

async function kvDelete(key) {
  await fetch(`${KV_URL}/del/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

export default async function handler(req, res) {
  try {
    const from = req.body.From || 'unknown';
    const text = (req.body.Body || '').trim().toLowerCase();
    const mediaUrl = req.body.MediaUrl0;

    const key = `session:${from}`;

    let session = await kvGet(key);

    if (!session) {
      session = {
        messages: [],
        photos: [],
        transcriptions: [],
        startTime: new Date().toISOString(),
      };
    }

    // 📸 PHOTO
    if (mediaUrl) {
      session.photos.push(mediaUrl);
    }

    // 🎤 VOICE TRANSCRIPTION (already coming from your current setup)
    if (req.body.TranscriptionText) {
      session.transcriptions.push(req.body.TranscriptionText);
    }

    // 💬 TEXT MESSAGE
    if (text && text !== 'done') {
      session.messages.push(text);
    }

    // 🧠 SAVE SESSION
    await kvSet(key, session);

    // ✅ DONE TRIGGER
    if (text === 'done') {
      const report = `
Field Report
------------------------
From: ${from}
Started: ${session.startTime}

TEXT NOTES:
${session.messages.join('\n') || 'None'}

VOICE NOTES:
${session.transcriptions.join('\n') || 'None'}

PHOTOS:
${session.photos.join('\n') || 'None'}
      `;

      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'paulvignos@gmail.com',
        subject: 'Field Report Completed',
        text: report,
      });

      await kvDelete(key);

      return res.status(200).send('Report sent');
    }

    return res.status(200).send('Saved');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error');
  }
}
