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

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`);
      const mediaType = formData.get(`MediaContentType${i}`) || "";

      console.log(`Media ${i}:`, mediaUrl);
      console.log(`Type ${i}:`, mediaType);

      const mediaResponse = await fetch(mediaUrl);

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.log(`❌ Failed to download media ${i}:`, errorText);
        continue;
      }

      const mediaBuffer = await mediaResponse.arrayBuffer();

      console.log(`Downloaded media ${i}, size:`, mediaBuffer.byteLength);

      if (mediaType.includes("audio")) {
        console.log("🎤 This is a voice note");

        const openAiForm = new FormData();
        openAiForm.append(
          "file",
          new Blob([mediaBuffer], { type: mediaType || "audio/ogg" }),
          "audio.ogg"
        );
        openAiForm.append("model", "gpt-4o-mini-transcribe");

        const openaiResponse = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: openAiForm,
          }
        );

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.log("❌ OpenAI transcription error:", errorText);
        } else {
          const result = await openaiResponse.json();
          console.log("OpenAI raw response:", result);
          console.log("📝 Transcription:", result.text || "(no text returned)");
        }
      }

      if (mediaType.includes("image")) {
        console.log("📸 This is a photo");
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}
