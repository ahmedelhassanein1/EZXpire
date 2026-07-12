import "server-only";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.5-flash";

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
  // Parse the response text line by line.
  // For each line, if it contains an integer, save [firstWord, maxIntOnThatLine] as a pair.
  // Collect all such pairs into an array.
  const results: [string, number][] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length === 0 || tokens[0] === "") continue;
    const numbersInLine = line.match(/-?\d+/g);
    if (numbersInLine) {
      const intNumbers = numbersInLine.map(Number);
      const maxInt = Math.max(...intNumbers);
      results.push([tokens[0], maxInt]);
    }
  }
  // Return as an object with two arrays: firstWords and corresponding max numbers.
  return JSON.stringify({
    firstWords: results.map(([word, _]) => word),
    maxInts: results.map(([_, num]) => num),
  });

}
