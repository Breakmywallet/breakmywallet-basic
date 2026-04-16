export async function GET() {
  return new Response("API is alive", { status: 200 });
}

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

function kvHeaders() {
  return {
    Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function kvCommand(command) {
  const response = await fetch(KV_REST_API_URL, {
    method: "POST",
    headers: kvHeaders(),
    body: JSON.stringify(command),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KV command failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function kvGet(key) {
  const result = await kvCommand(["GET", key]);

  if (!result || result.result == null) return null;

  try {
    return JSON.parse(result.result);
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  return await kvCommand(["SET", key, JSON.stringify(value)]);
}

async function kvDelete(key) {
  return await kvCommand(["DEL", key]);
}

function normalizeSession(from, session) {
  return {
    from: session?.from || from,
    startedAt: session?.startedAt || new Date().toISOString(),
    textMessages: Array.isArray(session?.textMessages) ? session.textMessages : [],
    transcriptions: Array.isArray(session?.transcriptions) ? session.transcriptions : [],
    photos: Array.isArray(session?.photos) ? session.photos : [],
  };
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

export async function POST(req) {
  try {
    const formData = await req.formData();

    const from = (formData.get("From") || "").toString();
    const rawBody = (formData.get("Body") || "").toString();
    const bodyTrimmed = rawBody.trim();
    const bodyLower = bodyTrimmed.toLowerCase();
    const numMedia = Number(formData.get("NumMedia") || 0);

    const sessionKey = `session:${from}`;

    let existingSession = await kvGet(sessionKey);
    let session = normalizeSession(from, existingSession);

    console.log("---- NEW MESSAGE ----");
    console.log("From:", from);
    console.log("Text:", rawBody);
    console.log("Media count:", numMedia);
    console.log("Loaded session:", JSON.stringify(session));

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

    // Save first, always
    await kvSet(sessionKey, session);
    console.log("💾 Session saved:", JSON.stringify(session));

    // If not done yet, stop here
    if (bodyLower !== "done") {
      return new Response("Saved", { status: 200 });
    }

    // Re-read the saved session so we know KV is actually returning it
    const latestSession = normalizeSession(from, await kvGet(sessionKey));
    console.log("📦 Reloaded session for done:", JSON.stringify(latestSession));

    const report = `Field Report

From: ${latestSession.from}
Started: ${latestSession.startedAt}
Completed: ${new Date().toISOString()}

Text Messages:
${
  latestSession.textMessages.length
    ? latestSession.textMessages.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)"
}

Voice Transcriptions:
${
  latestSession.transcriptions.length
    ? latestSession.transcriptions.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)"
}

Photos Received:
${
  latestSession.photos.length
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
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
