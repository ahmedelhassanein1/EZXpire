/**
 * On-device OCR via Tesseract.js. Import only from client components or
 * call inside browser-only code paths (workers do not run during SSR).
 */

type OcrProgressCallback = (progress: number) => void;

/** Map Tesseract status steps to a single 0–1 progress range. */
const STATUS_PROGRESS: Record<string, { start: number; end: number }> = {
  "loading tesseract core": { start: 0, end: 0.1 },
  "initializing tesseract": { start: 0.1, end: 0.2 },
  "loading language traineddata": { start: 0.2, end: 0.5 },
  "initializing api": { start: 0.5, end: 0.6 },
  "recognizing text": { start: 0.6, end: 1 },
};

function mapTesseractProgress(status: string, stepProgress: number): number {
  const range = STATUS_PROGRESS[status];
  if (!range) return stepProgress;
  return range.start + stepProgress * (range.end - range.start);
}

/**
 * Extract text from a receipt image using on-device OCR.
 *
 * @param imageFile - Photo captured or selected by the user
 * @param onProgress - Optional callback receiving overall progress from 0 to 1
 * @returns Raw OCR text from the image
 */
export async function runOcr(
  imageFile: File,
  onProgress?: OcrProgressCallback,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", undefined, {
    logger: (message) => {
      if (!onProgress || message.progress === undefined) return;
      onProgress(mapTesseractProgress(message.status, message.progress));
    },
  });

  try {
    onProgress?.(0);
    const {
      data: { text },
    } = await worker.recognize(imageFile);
    onProgress?.(1);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}
