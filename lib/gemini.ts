import "server-only";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
const DEFAULT_MODEL = "gemini-3.5-flash";

/**
 * Known-good Gemini model IDs that support multimodal (image) input.
 * Used only for the diagnostic warning in `checkGeminiConfig()`;
 * unknown model names are still passed through to the API.
 */
const KNOWN_MULTIMODAL_MODELS = new Set<string>([
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-image",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-3.1-flash-lite-preview",
]);

/**
 * Image MIME types Gemini's vision API accepts.
 * https://ai.google.dev/gemini-api/docs/vision#supported_image_formats
 */
export const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * Best-effort MIME inference for browser uploads that arrive with an empty
 * or generic `Content-Type` (e.g. some browsers report `.HEIC` as
 * `application/octet-stream` or `""`).
 *
 * Precedence:
 *   1. `browserType` if it's already a supported image MIME
 *   2. filename extension lookup
 *   3. magic-byte sniff on the first ~12 bytes of the file
 *   4. fall back to `browserType` (even if unsupported) so callers can decide
 *      what to do — or `"application/octet-stream"` if nothing was provided
 */
export function inferImageMimeType(
  browserType: string | undefined,
  filename: string | undefined,
  firstBytes?: Uint8Array
): string {
  const cleanedBrowser = (browserType ?? "").trim().toLowerCase();
  if (SUPPORTED_IMAGE_MIME_TYPES.has(cleanedBrowser)) {
    return cleanedBrowser;
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const fromExt = MIME_BY_EXTENSION[ext];
    if (fromExt) return fromExt;
  }

  if (firstBytes && firstBytes.length >= 12) {
    const sniffed = sniffImageMime(firstBytes);
    if (sniffed) return sniffed;
  }

  return cleanedBrowser || "application/octet-stream";
}

/**
 * Sniff common image MIME types from the first bytes of the file.
 * Only covers the formats Gemini accepts — extend as needed.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF: bytes 4..8 == "ftyp", brand at 8..12 indicates variant.
  // Brands: heic, heix, heim, heis, hevc, hevx, mif1, msf1, heif
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx"].includes(brand)) {
      return "image/heic";
    }
    if (["mif1", "msf1", "heif"].includes(brand)) {
      return "image/heif";
    }
  }
  return null;
}

const SYSTEM_INSTRUCTION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "QueryPrompt.txt"
);

let cachedClient: GoogleGenAI | null = null;
let cachedSystemInstruction: Promise<string> | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your local .env (server-side only)."
    );
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

function loadDefaultSystemInstruction(): Promise<string> {
  if (!cachedSystemInstruction) {
    cachedSystemInstruction = readFile(SYSTEM_INSTRUCTION_PATH, "utf8").then(
      (contents) => {
        const trimmed = contents.trim();
        if (trimmed.length === 0) {
          throw new Error(
            `System instruction file is empty: ${SYSTEM_INSTRUCTION_PATH}`
          );
        }
        return trimmed;
      }
    );
    cachedSystemInstruction.catch(() => {
      cachedSystemInstruction = null;
    });
  }
  return cachedSystemInstruction;
}

export interface QueryGeminiOptions {
  /** Override the default Gemini model. */
  model?: string;
  /**
   * Override the default system instruction (loaded from QuerryPrompt.txt).
   * Pass `null` to send the request with no system instruction at all.
   */
  systemInstruction?: string | null;
}

export interface ExtractTextFromImageOptions {
  /** Override the default Gemini model. */
  model?: string;
  /**
   * Override the extraction instruction sent alongside the image.
   */
  prompt?: string;
}

const DEFAULT_OCR_PROMPT =
  "Extract every line of text visible in this receipt image. " +
  "Return only the raw text, preserving the original line breaks, " +
  "with one line per item. Do not add commentary, headings, or markdown.";

/**
<<<<<<< HEAD
=======
 * Diagnostic metadata returned alongside the OCR text from
 * `extractTextFromImageDebug`. Useful for surfacing what actually happened
 * inside the Gemini call when something goes wrong.
 */
export interface ExtractTextDebugMeta {
  model: string;
  mimeType: string;
  imageBase64Length: number;
  approxImageBytes: number;
  promptChars: number;
  elapsedMs: number;
  responseText: string | undefined;
  finishReason: string | undefined;
  promptFeedback: unknown;
  candidateCount: number;
  usageMetadata: unknown;
}

export interface ExtractTextDebugResult {
  text: string;
  meta: ExtractTextDebugMeta;
}

/**
>>>>>>> 8dada4f3ad8c5210735473dfbb693a76cd6f8d58
 * Send an image to Gemini and return the plain-text OCR result.
 *
 * @param imageBase64 Base64-encoded image bytes (no data-URL prefix).
 * @param mimeType    MIME type of the image, e.g. `image/jpeg` or `image/png`.
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  options: ExtractTextFromImageOptions = {}
): Promise<string> {
<<<<<<< HEAD
=======
  const { text } = await extractTextFromImageDebug(imageBase64, mimeType, options);
  return text;
}

/**
 * Same as `extractTextFromImage` but also returns diagnostic metadata (model
 * used, byte size, elapsed ms, raw response, finish reason, prompt feedback).
 *
 * Use this from `/api/parse-receipt?debug=1` or the `test:gemini-image` script
 * when the plain call returns nothing useful. It never throws for an empty
 * response — it just returns `text = ""` so the caller can inspect `meta`.
 */
export async function extractTextFromImageDebug(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  options: ExtractTextFromImageOptions = {}
): Promise<ExtractTextDebugResult> {
>>>>>>> 8dada4f3ad8c5210735473dfbb693a76cd6f8d58
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new Error(
      "extractTextFromImage: imageBase64 must be a non-empty string."
    );
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
<<<<<<< HEAD
    throw new Error("extractTextFromImage: mimeType must be a non-empty string.");
  }

  const client = getClient();

  const response = await client.models.generateContent({
    model: options.model ?? DEFAULT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: options.prompt ?? DEFAULT_OCR_PROMPT },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
  });

  const text = response.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("extractTextFromImage: Gemini returned an empty response.");
  }
  return text.trim();
=======
    throw new Error(
      "extractTextFromImage: mimeType must be a non-empty string."
    );
  }
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(
      `extractTextFromImage: unsupported mimeType "${mimeType}". ` +
        `Gemini accepts: ${[...SUPPORTED_IMAGE_MIME_TYPES].join(", ")}. ` +
        `If your browser is sending an empty type for .HEIC files, use ` +
        `inferImageMimeType(file.type, file.name, firstBytes) before calling this function.`
    );
  }

  const client = getClient();
  const model = options.model ?? DEFAULT_MODEL;
  const prompt = options.prompt ?? DEFAULT_OCR_PROMPT;

  const started = Date.now();
  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const hint = KNOWN_MULTIMODAL_MODELS.has(model)
      ? ""
      : ` (note: "${model}" is not in the known-good multimodal model list — try "gemini-2.5-flash")`;
    throw new Error(
      `Gemini generateContent failed for model "${model}": ${raw}${hint}`
    );
  }
  const elapsedMs = Date.now() - started;

  const text = typeof response.text === "string" ? response.text.trim() : "";
  const candidates = (response as unknown as {
    candidates?: Array<{ finishReason?: string }>;
    promptFeedback?: unknown;
    usageMetadata?: unknown;
  }).candidates;

  const meta: ExtractTextDebugMeta = {
    model,
    mimeType,
    imageBase64Length: imageBase64.length,
    // base64 encodes 3 bytes as 4 chars; ignore padding for a rough estimate
    approxImageBytes: Math.floor((imageBase64.length * 3) / 4),
    promptChars: prompt.length,
    elapsedMs,
    responseText: response.text,
    finishReason: candidates?.[0]?.finishReason,
    promptFeedback: (response as unknown as { promptFeedback?: unknown })
      .promptFeedback,
    candidateCount: candidates?.length ?? 0,
    usageMetadata: (response as unknown as { usageMetadata?: unknown })
      .usageMetadata,
  };

  return { text, meta };
}

export interface GeminiConfigCheck {
  ok: boolean;
  hasApiKey: boolean;
  apiKeyLength: number;
  defaultModel: string;
  defaultModelIsKnown: boolean;
  warnings: string[];
}

/**
 * Cheap sanity check for the current Gemini configuration.
 * Does NOT hit the network — inspect this first when the endpoint misbehaves.
 */
export function checkGeminiConfig(): GeminiConfigCheck {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const hasApiKey = apiKey.length > 0;
  const defaultModelIsKnown = KNOWN_MULTIMODAL_MODELS.has(DEFAULT_MODEL);

  const warnings: string[] = [];
  if (!hasApiKey) {
    warnings.push(
      "GEMINI_API_KEY is not set. Add it to .env (server-side only)."
    );
  }
  if (!defaultModelIsKnown) {
    warnings.push(
      `DEFAULT_MODEL "${DEFAULT_MODEL}" is not in the known-good multimodal list. ` +
        `Consider "gemini-2.5-flash" for stable OCR support.`
    );
  }

  return {
    ok: hasApiKey && warnings.length === 0,
    hasApiKey,
    apiKeyLength: apiKey.length,
    defaultModel: DEFAULT_MODEL,
    defaultModelIsKnown,
    warnings,
  };
>>>>>>> 8dada4f3ad8c5210735473dfbb693a76cd6f8d58
}

/**
 * Send a single string prompt to the Gemini API and return the plain-text response.
 *
 * The default system instruction is loaded from `QueryPrompt.txt` at the repo root.
 * Intended for server-side use only (Next.js route handlers, server actions, etc.).
 */
export async function queryGemini(
  prompt: string,
  options: QueryGeminiOptions = {}
): Promise<string> {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("queryGemini: prompt must be a non-empty string.");
  }

  const client = getClient();

  const systemInstruction =
    options.systemInstruction === undefined
      ? await loadDefaultSystemInstruction()
      : options.systemInstruction;

  const response = await client.models.generateContent({
    model: options.model ?? DEFAULT_MODEL,
    contents: prompt,
    ...(systemInstruction ? { config: { systemInstruction } } : {}),
  });

  let text = response.text;
  console.log("unparsed: \n", text);
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("queryGemini: Gemini returned an empty response.");
  }
  // Gemini is prompted (see QueryPrompt.txt) to return one item per line in the
  // form "ITEM - DAYS". Capture the item name (possibly multiple words) and the
  // trailing integer day count; ignore any line that doesn't match.
  const LINE_RE = /^\s*(.+?)\s*[-\u2013\u2014]\s*(\d+)\s*$/;
  const results: [string, number][] = [];
  for (const line of text.split("\n")) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    results.push([m[1], Number(m[2])]);
  }
  return JSON.stringify({
    firstWords: results.map(([word]) => word),
    maxInts: results.map(([, num]) => num),
  });
}
