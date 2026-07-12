import { NextResponse } from "next/server";

import { extractTextFromImage } from "@/lib/gemini";

export const runtime = "nodejs";

type JsonBody = {
  imageBase64?: string;
  mimeType?: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/parse-receipt
 *
 * Accepts a receipt image and returns the OCR'd text as a plain string.
 *
 * Request body (either):
 *   - multipart/form-data with an `image` file field
 *   - application/json with `{ imageBase64: string, mimeType?: string }`
 *
 * Response: `{ text: string }`
 */
export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await readImagePayload(request);

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided. Send an 'image' file or 'imageBase64' field." },
        { status: 400 }
      );
    }

    const text = await extractTextFromImage(imageBase64, mimeType);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse receipt";
    const status = message.startsWith("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function readImagePayload(
  request: Request
): Promise<{ imageBase64: string | null; mimeType: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return { imageBase64: null, mimeType: "image/jpeg" };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image too large (${file.size} bytes). Max is ${MAX_IMAGE_BYTES} bytes.`
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      imageBase64: buffer.toString("base64"),
      mimeType: file.type || "image/jpeg",
    };
  }

  const body = (await request.json().catch(() => null)) as JsonBody | null;
  if (!body?.imageBase64) {
    return { imageBase64: null, mimeType: "image/jpeg" };
  }
  const stripped = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
  return {
    imageBase64: stripped,
    mimeType: body.mimeType ?? "image/jpeg",
  };
}
