"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CameraCapture } from "@/components/CameraCapture";

type ParsedShape = {
  firstWords: string[];
  maxInts: number[];
};

type DraftItem = {
  id: string;
  name: string;
  days: number;
};

function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function draftsFromParsed(parsed: ParsedShape | null | undefined): DraftItem[] {
  if (!parsed?.firstWords?.length) return [];
  const names = parsed.firstWords;
  const days = parsed.maxInts ?? [];
  return names.map((name, i) => ({
    id: `draft-${i}-${name}`,
    name: String(name).trim(),
    days: Number.isFinite(days[i]) ? Math.max(0, Number(days[i])) : 7,
  })).filter((item) => item.name.length > 0);
}

/**
 * Scan flow: image → /api/parse-receipt → review drafts → POST /api/pantry.
 */
export default function ScanPage() {
  const { status: authStatus } = useSession();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const signedIn = authStatus === "authenticated";

  const onCapture = (file: File) => {
    setError(null);
    setSaveMessage(null);
    setOcrText("");
    setDrafts([]);
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
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile, imageFile.name || "receipt.jpg");

      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as
        | { text?: string; parsed?: ParsedShape; parseError?: string; error?: string }
        | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to parse receipt");
      }

      setOcrText(body?.text?.trim() || "");
      const nextDrafts = draftsFromParsed(body?.parsed);
      setDrafts(nextDrafts);

      if (body?.parseError && nextDrafts.length === 0) {
        setError(`Text extracted, but item parse failed: ${body.parseError}`);
      } else if (nextDrafts.length === 0) {
        setError(
          "No structured items returned. Check QueryPrompt / Gemini parse, or add items manually later."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<DraftItem>) => {
    setDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((item) => item.id !== id));
  };

  const addManualItem = () => {
    setError(null);
    setSaveMessage(null);
    setDrafts((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${prev.length}`,
        name: "",
        days: 7,
      },
    ]);
  };

  const saveToPantry = async () => {
    if (!signedIn) {
      setError("Sign in first so items can be saved to your pantry.");
      return;
    }
    const toSave = drafts.filter((d) => d.name.trim().length > 0);
    if (toSave.length === 0) {
      setError("Add at least one item with a name before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const purchaseDate = todayIso();
    let saved = 0;
    const failures: string[] = [];

    for (const draft of toSave) {
      try {
        const res = await fetch("/api/pantry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            category: "grocery",
            purchaseDate,
            expiresAt: addDaysIso(draft.days),
          }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          failures.push(`${draft.name}: ${body?.error ?? res.statusText}`);
          continue;
        }
        saved += 1;
      } catch (err) {
        failures.push(
          `${draft.name}: ${err instanceof Error ? err.message : "save failed"}`
        );
      }
    }

    setSaving(false);

    if (saved > 0) {
      setSaveMessage(`Saved ${saved} item${saved === 1 ? "" : "s"} to your pantry.`);
      setDrafts((prev) => prev.filter((d) => !d.name.trim()));
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" · "));
    }
  };

  const canSave = useMemo(
    () =>
      signedIn &&
      drafts.some((d) => d.name.trim().length > 0) &&
      !busy &&
      !saving,
    [signedIn, drafts, busy, saving]
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-3xl text-ink">Scan receipt</h1>
        <p className="mt-2 text-sm text-ink/65">
          Extract items from a photo, review them, then save to your pantry.
        </p>
      </section>

      {!signedIn ? (
        <p className="rounded-xl bg-citrus/15 px-3 py-2 text-xs text-[#6d4800] ring-1 ring-citrus/30">
          You&apos;re not signed in. You can still extract text, but{" "}
          <Link href="/login" className="font-semibold underline">
            sign in
          </Link>{" "}
          is required to save items to the pantry.
        </p>
      ) : null}

      <CameraCapture
        onCapture={onCapture}
        disabled={busy || saving}
        label="Take or upload photo"
        className="!bg-leaf hover:!bg-leaf/90 focus-visible:!ring-leaf"
      />

      <label className="block">
        <span className="mb-1 block text-xs text-ink/50">Or choose a file</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy || saving}
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
      {saveMessage ? <p className="text-sm text-leaf">{saveMessage}</p> : null}

      <button
        type="button"
        disabled={busy || saving || !imageFile}
        onClick={() => void runParseReceipt()}
        className="w-full rounded-full bg-leaf px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Extract items from image
      </button>

      <button
        type="button"
        disabled={busy || saving}
        onClick={addManualItem}
        className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10 disabled:opacity-50"
      >
        Add item manually
      </button>

      {drafts.length > 0 ? (
        <section className="space-y-3 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-ink/5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl text-ink">Review items</h2>
            <p className="text-xs text-ink/50">{drafts.length} ready</p>
          </div>
          <ul className="space-y-3">
            {drafts.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 border-b border-ink/10 pb-3 last:border-0">
                <input
                  value={item.name}
                  onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                  className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-leaf/30 focus:ring"
                  aria-label="Item name"
                  placeholder="Item name"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink/55">Days until expiry</label>
                  <input
                    type="number"
                    min={0}
                    value={item.days}
                    onChange={(e) =>
                      updateDraft(item.id, { days: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-20 rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm outline-none ring-leaf/30 focus:ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeDraft(item.id)}
                    className="ml-auto text-sm font-medium text-clay"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy || saving}
            onClick={addManualItem}
            className="w-full rounded-full border border-dashed border-leaf/40 bg-mist/50 px-4 py-2.5 text-sm font-semibold text-leaf"
          >
            + Add another item
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void saveToPantry()}
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to pantry"}
          </button>
        </section>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">Raw extracted text</label>
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={6}
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
