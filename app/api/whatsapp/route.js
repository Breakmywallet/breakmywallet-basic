export async function GET() {
  return new Response("API is alive", { status: 200 });
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCommand(command) {
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
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
  await kvCommand(["SET", key, JSON.stringify(value)]);
}

async function kvDelete(key) {
  await kvCommand(["DEL", key]);
}

async function transcribeAudio(mediaBuffer, mediaType) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([mediaBuffer], { type: mediaType || "audio/ogg" }),
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

    let session = await kvGet(sessionKey);

    if (!session) {
      session = {
        from,
        startedAt: new Date().toISOString(),
        textMessages: [],
        transcriptions: [],
        photos: [],
      };
    }

    console.log("---- NEW MESSAGE ----");
    console.log("From:", from);
    console.log("Text:", rawBody);
    console.log("Media count:", numMedia);

    // Store normal text messages, but don't store "done"
    if (bodyTrimmed && bodyLower !== "done") {
      session.textMessages.push(bodyTrimmed);
    }

    // Process every media item in this webhook
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

      const mediaText = await mediaResponse.text();

      if (!mediaResponse.ok) {
        console.log(`❌ Failed to download media ${i}:`, mediaText);
        continue;
      }

      const mediaBuffer = Buffer.from(mediaText, "binary");

      if (mediaType.includes("audio")) {
        console.log("🎤 Audio received");

        try {
          const transcription = await transcribeAudio(mediaBuffer, mediaType);
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
        session.photos.push({
          index: session.photos.length + 1,
          mediaType,
          url: mediaUrl,
          receivedAt: new Date().toISOString(),
        });
      }
    }

    // Save session after every incoming message/media event
    await kvSet(sessionKey, session);
    console.log("💾 Session saved:", JSON.stringify(session, null, 2));

    // Only compile + email when sender texts "done"
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

Photos:
${
  latestSession?.photos?.length
    ? latestSession.photos
        .map((p, i) => `${i + 1}. ${p.url}`)
        .join("\n")
    : "(none)"
}
`;

      console.log("📄 FINAL REPORT:", report);

      const resendResult = await sendEmailReport(report);
      console.log("📧 Resend response:", resendResult);

      await kvDelete(sessionKey);
      console.log("🧹 Session cleared");

      return new Response("Report sent", { status: 200 });
    }

    return new Response("Saved", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
