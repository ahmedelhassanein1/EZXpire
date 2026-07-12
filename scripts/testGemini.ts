import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// @ts-expect-error Node runs this with `--experimental-strip-types`, which
// requires the explicit `.ts` extension; tsc (without
// `allowImportingTsExtensions`) rejects it. The script is not part of the
// Next.js build, so this cost is contained.
import { queryGemini } from "../lib/gemini.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

async function main(): Promise<void> {
  const inputPath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(REPO_ROOT, "testText.txt");

  const prompt = (await readFile(inputPath, "utf8")).trim();
  if (prompt.length === 0) {
    throw new Error(`Input file is empty: ${inputPath}`);
  }

  console.log(`--- Prompt (${inputPath}) ---`);
  console.log(prompt);
  console.log("--- Gemini response ---");

  const started = Date.now();
  const response = await queryGemini(prompt);
  const elapsedMs = Date.now() - started;

  console.log(response);
  console.log(`\n(done in ${elapsedMs} ms)`);
}

main().catch((err) => {
  console.error("testGemini failed:", err);
  process.exit(1);
});
