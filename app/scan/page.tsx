"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Person 4 owns this page as thin glue.
 * Wire Person 2 (`CameraCapture` / `runOcr`) and Person 3 (`ParsedItemsEditor`) here when ready.
 */
export default function ScanPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);

  const onFile = (file: File | null) => {
    setError(null);
    setParsedPreview(null);
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setOcrText(
      "(Person 2: plug CameraCapture + lib/ocr here. For now, type or paste receipt text below.)"
    );
  };

  const runGeminiParse = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ??
            "Person 3's /api/parse-receipt is not available yet. You can still edit text here."
        );
      }
      const data = await res.json();
      setParsedPreview(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-3xl text-ink">Scan receipt</h1>
        <p className="mt-2 text-sm text-ink/65">
          Capture a photo, run on-device OCR (Person 2), then structure items with Gemini (Person 3).
        </p>
      </section>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-leaf/40 bg-white/70 px-4 py-10 text-center shadow-sm">
        <span className="font-semibold text-leaf">Take or upload photo</span>
        <span className="text-xs text-ink/50">Uses the phone camera when available</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Receipt preview"
          className="max-h-64 w-full rounded-xl object-contain ring-1 ring-ink/10"
        />
      ) : null}

      {busy ? <p className="text-sm text-ink/50">Working…</p> : null}
      {error ? <p className="text-sm text-clay">{error}</p> : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">OCR text</label>
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-ink/10 bg-white/80 p-3 text-sm outline-none ring-leaf/30 focus:ring"
          placeholder="OCR output lands here…"
        />
      </div>

      <button
        type="button"
        disabled={busy || !ocrText.trim()}
        onClick={() => void runGeminiParse()}
        className="w-full rounded-full bg-leaf px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Structure with Gemini
      </button>

      {parsedPreview ? (
        <pre className="overflow-x-auto rounded-xl bg-ink p-3 text-xs text-mist">{parsedPreview}</pre>
      ) : null}

      <p className="text-xs text-ink/45">
        When Person 3 ships <code className="font-mono">ParsedItemsEditor</code>, swap the JSON
        preview for that editor and save via Person 1&apos;s pantry API.
      </p>

      <Link href="/" className="block text-center text-sm font-semibold text-leaf">
        Back to pantry
      </Link>
    </div>
  );
}
