"use client";

import { useState } from "react";
import Link from "next/link";
import { CameraCapture } from "@/components/CameraCapture";

/**
 * Scan flow: capture/upload image → POST /api/parse-receipt (image) → show text.
 */
export default function ScanPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCapture = (file: File) => {
    setError(null);
    setOcrText("");
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const runParseReceipt = async () => {
    if (!imageFile) {
      setError("Upload or take a receipt photo first.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile, imageFile.name || "receipt.jpg");

      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to parse receipt");
      }

      setOcrText(body?.text?.trim() || "");
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
          Upload a receipt photo. Gemini reads the image via{" "}
          <code className="font-mono text-xs">/api/parse-receipt</code>.
        </p>
      </section>

      <CameraCapture
        onCapture={onCapture}
        disabled={busy}
        label="Take or upload photo"
        className="!bg-leaf hover:!bg-leaf/90 focus-visible:!ring-leaf"
      />

      <label className="block">
        <span className="mb-1 block text-xs text-ink/50">Or choose a file</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-leaf file:shadow-sm"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) onCapture(file);
          }}
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

      {busy ? <p className="text-sm text-ink/50">Reading receipt with Gemini…</p> : null}
      {error ? <p className="text-sm text-clay">{error}</p> : null}

      <button
        type="button"
        disabled={busy || !imageFile}
        onClick={() => void runParseReceipt()}
        className="w-full rounded-full bg-leaf px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Extract text from image
      </button>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">Extracted text</label>
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-ink/10 bg-white/80 p-3 text-sm outline-none ring-leaf/30 focus:ring"
          placeholder="Text from the receipt appears here after extraction…"
        />
      </div>

      <Link href="/" className="block text-center text-sm font-semibold text-leaf">
        Back to pantry
      </Link>
    </div>
  );
}
