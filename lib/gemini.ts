import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
 * or generic `Content-Type`.
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
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
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
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(
      bytes[8],
      bytes[9],
      bytes[10],
      bytes[11]
    );
    if (["heic", "heix", "heim", "heis", "hevc", "hevx"].includes(brand)) {
      return "image/heic";
    }
    if (["mif1", "msf1", "heif"].includes(brand)) {
      return "image/heif";
    }
  }
  return null;
}

/** Project-root path — works on Vercel when the file is in the deploy + traced. */
const SYSTEM_INSTRUCTION_PATH = resolve(process.cwd(), "QueryPrompt.txt");

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
    cachedSystemInstruction = readFile(SYSTEM_INSTRUCTION_PATH, "utf8")
      .then((contents) => {
        const trimmed = contents.trim();
        if (trimmed.length === 0) {
          throw new Error(
            `System instruction file is empty: ${SYSTEM_INSTRUCTION_PATH}`
          );
        }
        return trimmed;
      })
      .catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Could not read QueryPrompt.txt from ${SYSTEM_INSTRUCTION_PATH}. ` +
            `Keep the file at the repo root (exact casing) and redeploy. (${detail})`
        );
      });
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
   * Override the default system instruction (loaded from QueryPrompt.txt).
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
 * Diagnostic metadata returned alongside the OCR text from
 * `extractTextFromImageDebug`.
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
 * Send an image to Gemini and return the plain-text OCR result.
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  options: ExtractTextFromImageOptions = {}
): Promise<string> {
  const { text } = await extractTextFromImageDebug(
    imageBase64,
    mimeType,
    options
  );
  if (!text) {
    throw new Error("extractTextFromImage: Gemini returned an empty response.");
  }
  return text;
}

/**
 * Same as `extractTextFromImage` but also returns diagnostic metadata.
 * Does not throw for an empty response — returns `text = ""` so callers can
 * inspect `meta`.
 */
export async function extractTextFromImageDebug(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  options: ExtractTextFromImageOptions = {}
): Promise<ExtractTextDebugResult> {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new Error(
      "extractTextFromImage: imageBase64 must be a non-empty string."
    );
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
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
  const candidates = (
    response as unknown as {
      candidates?: Array<{ finishReason?: string }>;
      promptFeedback?: unknown;
      usageMetadata?: unknown;
    }
  ).candidates;

  const meta: ExtractTextDebugMeta = {
    model,
    mimeType,
    imageBase64Length: imageBase64.length,
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
 * Does NOT hit the network.
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
}

/**
 * Send a single string prompt to the Gemini API and return structured
 * perishable items as JSON: `{ firstWords, maxInts }`.
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

  const text = response.text;
  console.log("unparsed: \n", text);
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("queryGemini: Gemini returned an empty response.");
  }

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
