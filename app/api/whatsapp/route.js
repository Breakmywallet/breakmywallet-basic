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

      if (!mediaResponse.ok) {
        const mediaError = await mediaResponse.text();
        console.log(`❌ Failed to download media ${i}:`, mediaError);
        continue;
      }

      const mediaBuffer = await mediaResponse.arrayBuffer();

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

        if (!response.ok) {
          const aiError = await response.text();
          console.log("❌ OpenAI transcription error:", aiError);
        } else {
          const result = await response.json();
          transcriptionText = result.text || "";
          console.log("📝 Transcription:", transcriptionText);
        }
      }

      if (mediaType.includes("image")) {
        photoNotes.push(`Photo ${i + 1} received`);
      }
    }

    const report = `Field Report

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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["paulvignos@gmail.com"], // replace with the exact inbox you want
        subject: "New Field Report",
        text: report,
      }),
    });

    const resendText = await resendResponse.text();
    console.log("📧 Resend status:", resendResponse.status);
    console.log("📧 Resend response:", resendText);

    if (!resendResponse.ok) {
      return new Response("Email failed", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
