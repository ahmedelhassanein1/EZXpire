import { NextResponse } from "next/server";

import {
  checkGeminiConfig,
  extractTextFromImage,
  extractTextFromImageDebug,
  inferImageMimeType,
  queryGemini,
  SUPPORTED_IMAGE_MIME_TYPES,
} from "@/lib/gemini";

interface ParsedItems {
  firstWords: string[];
  maxInts: number[];
}

/**
 * Pipe OCR text through `queryGemini` (which uses QueryPrompt.txt as its
 * system instruction) to get `{ firstWords, maxInts }`. Never throws — returns
 * `{ parsed: null, parseError }` so the OCR text still makes it back to the
 * client even if the second Gemini call fails.
 */
async function parseOcrText(text: string): Promise<{
  parsed: ParsedItems | null;
  parseError?: string;
}> {
  if (text.trim().length === 0) {
    return { parsed: null, parseError: "OCR returned no text to parse." };
  }
  try {
    const raw = await queryGemini(text);
    const parsed = JSON.parse(raw) as ParsedItems;
    return { parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[parse-receipt] queryGemini failed:", message);
    return { parsed: null, parseError: message };
  }
}

export const runtime = "nodejs";

type JsonBody = {
  imageBase64?: string;
  mimeType?: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * GET /api/parse-receipt
 *
 * Cheap diagnostic. Returns Gemini config sanity info (no network calls,
 * no image processing). Use this from the browser first when the POST
 * endpoint misbehaves.
 */
export function GET() {
  const config = checkGeminiConfig();
  return NextResponse.json({
    endpoint: "/api/parse-receipt",
    method: "POST",
    accepts: [
      "multipart/form-data with an `image` file field",
      "application/json with { imageBase64: string, mimeType?: string }",
    ],
    query: {
      debug: "Add `?debug=1` to POST to get diagnostic metadata alongside the OCR text.",
    },
    maxImageBytes: MAX_IMAGE_BYTES,
    config,
  });
}

/**
 * POST /api/parse-receipt
 *
 * Accepts a receipt image and returns the OCR'd text as a plain string.
 * Add `?debug=1` to also receive diagnostic metadata about the Gemini call.
 *
 * Response:
 *   - `{ text: string }` normally
 *   - `{ text: string, meta: {...} }` with `?debug=1`
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  const startedAt = Date.now();
  try {
    const {
      imageBase64,
      mimeType,
      payloadSource,
      browserReportedType,
      filename,
    } = await readImagePayload(request);

    if (!imageBase64) {
      return NextResponse.json(
        {
          error: "No image provided. Send an 'image' file or 'imageBase64' field.",
          ...(debug ? { meta: { payloadSource, elapsedMs: Date.now() - startedAt } } : {}),
        },
        { status: 400 }
      );
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        {
          error:
            `Unsupported image type "${mimeType}". Gemini accepts: ` +
            `${[...SUPPORTED_IMAGE_MIME_TYPES].join(", ")}.`,
          ...(debug
            ? {
                meta: {
                  payloadSource,
                  browserReportedType,
                  filename,
                  resolvedMimeType: mimeType,
                  elapsedMs: Date.now() - startedAt,
                },
              }
            : {}),
        },
        { status: 415 }
      );
    }

    if (debug) {
      const { text, meta } = await extractTextFromImageDebug(imageBase64, mimeType);
      const parseStartedAt = Date.now();
      const { parsed, parseError } = await parseOcrText(text);
      console.log("[parse-receipt] debug", {
        payloadSource,
        browserReportedType,
        filename,
        ...meta,
        parseError,
        parseElapsedMs: Date.now() - parseStartedAt,
      });
      return NextResponse.json({
        text,
        parsed,
        ...(parseError ? { parseError } : {}),
        meta: {
          payloadSource,
          browserReportedType,
          filename,
          totalRouteElapsedMs: Date.now() - startedAt,
          parseElapsedMs: Date.now() - parseStartedAt,
          ...meta,
        },
      });
    }

    const text = await extractTextFromImage(imageBase64, mimeType);
    const { parsed, parseError } = await parseOcrText(text);
    return NextResponse.json({
      text,
      parsed,
      ...(parseError ? { parseError } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse receipt";
    console.error("[parse-receipt] error", err);
    const status = message.startsWith("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      {
        error: message,
        ...(debug
          ? {
              meta: {
                totalRouteElapsedMs: Date.now() - startedAt,
                stack: err instanceof Error ? err.stack : undefined,
              },
            }
          : {}),
      },
      { status }
    );
  }
}

interface ReadImagePayload {
  imageBase64: string | null;
  mimeType: string;
  payloadSource: "multipart" | "json" | "unknown";
  /** Whatever type the client sent, before inference. */
  browserReportedType?: string;
  /** Filename the client sent, if any. */
  filename?: string;
}

async function readImagePayload(request: Request): Promise<ReadImagePayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return { imageBase64: null, mimeType: "image/jpeg", payloadSource: "multipart" };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image too large (${file.size} bytes). Max is ${MAX_IMAGE_BYTES} bytes.`
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const firstBytes = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      Math.min(buffer.byteLength, 32)
    );
    const mimeType = inferImageMimeType(file.type, file.name, firstBytes);
    return {
      imageBase64: buffer.toString("base64"),
      mimeType,
      payloadSource: "multipart",
      browserReportedType: file.type,
      filename: file.name,
    };
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as JsonBody | null;
    if (!body?.imageBase64) {
      return { imageBase64: null, mimeType: "image/jpeg", payloadSource: "json" };
    }
    // If the client sent a data URL, pull the MIME out of it and trust that
    // over a missing `mimeType` field.
    const dataUrlMatch = body.imageBase64.match(/^data:([^;]+);base64,/);
    const stripped = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(stripped, "base64");
    const firstBytes = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      Math.min(buffer.byteLength, 32)
    );
    const browserReported =
      body.mimeType ?? dataUrlMatch?.[1] ?? undefined;
    const mimeType = inferImageMimeType(browserReported, undefined, firstBytes);
    return {
      imageBase64: stripped,
      mimeType,
      payloadSource: "json",
      browserReportedType: browserReported,
    };
  }

  return { imageBase64: null, mimeType: "image/jpeg", payloadSource: "unknown" };
}
