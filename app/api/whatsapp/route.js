export async function GET() {
  return new Response("API is alive", { status: 200 });
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function kvHeaders() {
  return {
    Authorization: `Bearer ${KV_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function kvGet(key) {
  const response = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: kvHeaders(),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KV GET failed: ${response.status} ${text}`);
  }

  const json = text ? JSON.parse(text) : null;

  if (!json || json.result == null) return null;

  try {
    return JSON.parse(json.result);
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const response = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: kvHeaders(),
    body: JSON.stringify({
      value: JSON.stringify(value),
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KV SET failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function kvDelete(key) {
  const response = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: kvHeaders(),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KV DEL failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function transcribeAudio(mediaArrayBuffer, mediaType) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([mediaArrayBuffer], { type: mediaType || "audio/ogg" }),
    "audio.ogg"
  );
  form.append("model", "gpt-4o-mini-transcribe");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI transcription failed: ${response.status} ${text}`);
  }

  const json = JSON.parse(text);
  return json.text || "";
}

async function sendEmailReport(reportText) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: ["paulvignos@gmail.com"], // change if needed
      subject: "Field Report Completed",
      text: reportText,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Resend failed: ${response.status} ${text}`);
  }

  return text;
}

function newSession(from) {
  return {
    from,
    startedAt: new Date().toISOString(),
    textMessages: [],
    transcriptions: [],
    photos: [],
  };
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    const from = (formData.get("From") || "").toString();
    const rawBody = (formData.get("Body") || "").toString();
    const bodyTrimmed = rawBody.trim();
    const bodyLower = bodyTrimmed.toLowerCase();
    const numMedia = Number(formData.get("NumMedia") || 0);

    const sessionKey = `session:${from}`;

    let session = await kvGet(sessionKey);

    if (!session && bodyLower !== "done") {
      session = newSession(from);
      console.log("🆕 New session created");
    }

    console.log("---- NEW MESSAGE ----");
    console.log("From:", from);
    console.log("Text:", rawBody);
    console.log("Media count:", numMedia);

    if (!session && bodyLower === "done") {
      console.log("⚠️ No active session for done trigger");
      return new Response("No active session", { status: 200 });
    }

    if (bodyTrimmed && bodyLower !== "done") {
      session.textMessages.push(bodyTrimmed);
      console.log("💬 Text saved");
    }

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = (formData.get(`MediaUrl${i}`) || "").toString();
      const mediaType = (formData.get(`MediaContentType${i}`) || "").toString();

      console.log(`Media ${i}:`, mediaUrl);
      console.log(`Type ${i}:`, mediaType);

      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
            ).toString("base64"),
        },
      });

      if (!mediaResponse.ok) {
        const mediaError = await mediaResponse.text();
        console.log(`❌ Failed to download media ${i}:`, mediaError);
        continue;
      }

      const mediaArrayBuffer = await mediaResponse.arrayBuffer();

      if (mediaType.includes("audio")) {
        console.log("🎤 Audio received");

        try {
          const transcription = await transcribeAudio(mediaArrayBuffer, mediaType);
          console.log("📝 Transcription:", transcription);

          if (transcription) {
            session.transcriptions.push(transcription);
          }
        } catch (error) {
          console.log("❌ Audio transcription error:", String(error));
          session.transcriptions.push("[Transcription failed]");
        }
      }

      if (mediaType.includes("image")) {
        console.log("📸 Photo received");
        session.photos.push(mediaUrl);
      }
    }

    await kvSet(sessionKey, session);
    console.log("💾 Session saved");

    if (bodyLower === "done") {
      const latestSession = await kvGet(sessionKey);

      const report = `Field Report

From: ${latestSession?.from || from}
Started: ${latestSession?.startedAt || new Date().toISOString()}
Completed: ${new Date().toISOString()}

Text Messages:
${
  latestSession?.textMessages?.length
    ? latestSession.textMessages.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)"
}

Voice Transcriptions:
${
  latestSession?.transcriptions?.length
    ? latestSession.transcriptions.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)"
}

Photos Received:
${
  latestSession?.photos?.length
    ? latestSession.photos.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : "(none)"
}
`;

      console.log("📄 FINAL REPORT:", report);

      const resendResult = await sendEmailReport(report);
      console.log("📧 Resend response:", resendResult);

      await kvDelete(sessionKey);
      console.log("🧹 Session deleted");

      return new Response("Report sent", { status: 200 });
    }

    return new Response("Saved", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
