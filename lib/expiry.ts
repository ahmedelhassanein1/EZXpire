import "server-only";

import { categorize, getShelfLifeDays } from "@/data/shelfLife";
import { queryGemini } from "@/lib/gemini";

/**
 * Where a given expiry estimate came from. `"gemini"` means the LLM returned a
 * matching entry; `"shelfLife"` means we fell back to the keyword-based table
 * in `data/shelfLife.ts`; `"default"` means neither had a good answer and we
 * used the generic default.
 */
export type ExpirySource = "gemini" | "shelfLife" | "default";

export interface ExpiryEstimate {
  name: string;
  days: number;
  source: ExpirySource;
}

interface GeminiParseShape {
  firstWords: string[];
  maxInts: number[];
}

function tryParseGemini(raw: string): GeminiParseShape | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as GeminiParseShape).firstWords) &&
      Array.isArray((parsed as GeminiParseShape).maxInts)
    ) {
      return parsed as GeminiParseShape;
    }
  } catch {
    // fall through
  }
  return null;
}

function firstToken(name: string): string {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * Estimate shelf life (in days) for each item name.
 *
 * Calls Gemini once with all items joined by newlines, then per input item:
 *   1. If Gemini returned a matching entry (case-insensitive first-word match),
 *      use `{ days, source: "gemini" }`.
 *   2. Otherwise, use the shelf-life table. If categorization succeeded, mark
 *      `source: "shelfLife"`; if it fell back to the `"default"` category,
 *      mark `source: "default"`.
 *
 * If the Gemini call throws, every item falls back to the shelf-life path.
 */
export async function estimateExpiries(
  itemNames: string[]
): Promise<ExpiryEstimate[]> {
  if (itemNames.length === 0) return [];

  let geminiEntries: Map<string, number> | null = null;
  try {
    const prompt = itemNames.join("\n");
    const raw = await queryGemini(prompt);
    const parsed = tryParseGemini(raw);
    if (parsed) {
      geminiEntries = new Map();
      const count = Math.min(parsed.firstWords.length, parsed.maxInts.length);
      for (let i = 0; i < count; i += 1) {
        const key = firstToken(parsed.firstWords[i]!);
        const value = parsed.maxInts[i]!;
        if (key.length > 0 && Number.isFinite(value)) {
          geminiEntries.set(key, value);
        }
      }
    }
  } catch (err) {
    console.warn(
      "estimateExpiries: Gemini call failed, falling back to shelf-life table.",
      err
    );
  }

  return itemNames.map((name) => {
    const key = firstToken(name);
    if (geminiEntries && key.length > 0 && geminiEntries.has(key)) {
      return { name, days: geminiEntries.get(key)!, source: "gemini" };
    }
    const category = categorize(name);
    return {
      name,
      days: getShelfLifeDays(name),
      source: category === "default" ? "default" : "shelfLife",
    };
  });
}
