export async function GET() {
  return new Response("API is alive", { status: 200 });
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    const body = formData.get("Body") || "";
    const from = formData.get("From") || "";
    const numMedia = Number(formData.get("NumMedia") || 0);

    console.log("---- NEW MESSAGE ----");
    console.log("From:", from);
    console.log("Text:", body);
    console.log("Media count:", numMedia);

    let transcriptionText = "";
    let photoNotes = [];

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`);
      const mediaType = formData.get(`MediaContentType${i}`) || "";

      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
            ).toString("base64"),
        },
      });

      if (!mediaResponse.ok) continue;

      const mediaBuffer = await mediaResponse.arrayBuffer();

      // 🎤 TRANSCRIBE AUDIO
      if (mediaType.includes("audio")) {
        const openAiForm = new FormData();
        openAiForm.append(
          "file",
          new Blob([mediaBuffer], { type: mediaType || "audio/ogg" }),
          "audio.ogg"
        );
        openAiForm.append("model", "gpt-4o-mini-transcribe");

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: openAiForm,
          }
        );

        const result = await response.json();
        transcriptionText = result.text || "";
      }

      // 📸 IMAGE PLACEHOLDER
      if (mediaType.includes("image")) {
        photoNotes.push(`Photo ${i + 1} received`);
      }
    }

    // 🧠 BUILD REPORT
    const report = `
Field Report

From: ${from}
Time: ${new Date().toLocaleString()}

Text Message:
${body || "(none)"}

Voice Transcription:
${transcriptionText || "(none)"}

Photos:
${photoNotes.length ? photoNotes.join("\n") : "(none)"}
`;

    console.log("📄 REPORT:", report);

    // 📧 SEND EMAIL (NO SDK — PURE FETCH)
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["paul@gutterguys.com"], // 🔴 CHANGE THIS
        subject: "New Field Report",
        text: report,
      }),
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
