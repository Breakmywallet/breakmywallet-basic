export async function POST(req) {
  try {
    const formData = await req.formData();

    const bodyText = formData.get("Body") || "";

    console.log("Incoming message:", bodyText);

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}
