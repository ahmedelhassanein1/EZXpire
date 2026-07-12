import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve } from "node:path";

// @ts-expect-error See scripts/testGemini.ts — Node runs this with
// `--experimental-strip-types`, which requires the explicit `.ts` extension.
import { checkGeminiConfig, extractTextFromImageDebug } from "../lib/gemini.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function usage(): never {
  console.error("Usage: npm run test:gemini-image <path/to/image> [model]");
  console.error("Example: npm run test:gemini-image ./receipt.jpg gemini-2.5-flash");
  process.exit(2);
}

async function main(): Promise<void> {
  const inputArg = process.argv[2];
  const modelArg = process.argv[3];
  if (!inputArg) usage();

  const inputPath = resolve(process.cwd(), inputArg);
  const ext = extname(inputPath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "image/jpeg";

  console.log("--- Config sanity check ---");
  const config = checkGeminiConfig();
  console.log(JSON.stringify(config, null, 2));
  if (!config.hasApiKey) {
    console.error(
      "\nAborting: GEMINI_API_KEY is missing. Ensure .env has GEMINI_API_KEY=... " +
        "and that you ran with `--env-file=.env`."
    );
    process.exit(1);
  }
  if (config.warnings.length > 0) {
    console.warn(
      "\nWarnings above may explain a failure. Continuing anyway...\n"
    );
  }

  console.log(`\n--- Reading image: ${inputPath} (${mimeType}) ---`);
  const bytes = await readFile(inputPath);
  console.log(`Read ${bytes.byteLength} bytes.`);
  if (bytes.byteLength === 0) {
    throw new Error(`Image file is empty: ${inputPath}`);
  }
  const imageBase64 = bytes.toString("base64");
  console.log(`Base64 length: ${imageBase64.length}`);

  console.log("\n--- Calling Gemini (extractTextFromImageDebug) ---");
  if (modelArg) console.log(`Using model override: ${modelArg}`);

  try {
    const { text, meta } = await extractTextFromImageDebug(
      imageBase64,
      mimeType,
      modelArg ? { model: modelArg } : {}
    );
    console.log("\n--- Meta ---");
    console.log(JSON.stringify(meta, null, 2));
    console.log("\n--- Extracted text ---");
    console.log(text.length === 0 ? "(empty)" : text);
    console.log(`\n(done in ${meta.elapsedMs} ms)`);
  } catch (err) {
    console.error("\n--- Call failed ---");
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("testGeminiImage failed:", err);
  process.exit(1);
});
