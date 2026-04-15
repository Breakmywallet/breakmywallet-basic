export async function POST(req) {
  try {
    const formData = await req.formData();

    const body = formData.get("Body");
    const from = formData.get("From");
    const numMedia = formData.get("NumMedia");

    console.log("---- NEW MESSAGE ----");
    console.log("From:", from);
    console.log("Text:", body);
    console.log("Media count:", numMedia);

    // Loop through media (photos/audio)
    for (let i = 0; i < numMedia; i++) {
  const mediaUrl = formData.get(`MediaUrl${i}`);
  const mediaType = formData.get(`MediaContentType${i}`);

  console.log(`Media ${i}:`, mediaUrl);
  console.log(`Type ${i}:`, mediaType);

  const response = await fetch(mediaUrl);
  const buffer = await response.arrayBuffer();

  console.log(`Downloaded media ${i}, size:`, buffer.byteLength);

  if (mediaType.includes("audio")) {
  console.log("🎤 This is a voice note");

  const audioResponse = await fetch(mediaUrl);
  const audioBuffer = await audioResponse.arrayBuffer();

  const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: (() => {
      const formData = new FormData();
      formData.append("file", new Blob([audioBuffer]), "audio.ogg");
      formData.append("model", "gpt-4o-mini-transcribe");
      return formData;
    })(),
  });

  const result = await openaiResponse.json();

  console.log("📝 Transcription:", result.text);
}

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}
