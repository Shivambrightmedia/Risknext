import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BRIA_ENDPOINT = "https://engine.prod.bria-api.com/v2/image/edit/remove_background";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const apiToken = process.env.BRIA_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: "BRIA_API_TOKEN is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "The image must be smaller than 12 MB." }, { status: 413 });
    }

    const base64Image = Buffer.from(await image.arrayBuffer()).toString("base64");
    const briaResponse = await fetch(BRIA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_token: apiToken,
      },
      body: JSON.stringify({ image: base64Image, sync: true }),
      cache: "no-store",
    });

    const payload = await briaResponse.json().catch(() => null) as {
      result?: { image_url?: string };
      result_url?: string;
      error?: string;
      message?: string;
    } | null;

    if (!briaResponse.ok) {
      return NextResponse.json(
        { error: payload?.message || payload?.error || "BRIA could not process this image." },
        { status: briaResponse.status },
      );
    }

    const resultUrl = payload?.result?.image_url || payload?.result_url;
    if (!resultUrl) {
      return NextResponse.json({ error: "BRIA returned no processed image." }, { status: 502 });
    }

    const resultResponse = await fetch(resultUrl, { cache: "no-store" });
    if (!resultResponse.ok) {
      return NextResponse.json({ error: "Could not download the processed image." }, { status: 502 });
    }

    return new NextResponse(resultResponse.body, {
      headers: {
        "Content-Type": resultResponse.headers.get("content-type") || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("BRIA background removal failed", error);
    return NextResponse.json({ error: "Background removal failed. Please try again." }, { status: 500 });
  }
}
