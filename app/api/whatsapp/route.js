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
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}
