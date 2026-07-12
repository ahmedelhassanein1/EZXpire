"use client";

import { useState } from "react";
import { ExpiryBadge } from "@/components/ExpiryBadge";
import {
  daysUntilExpiry,
  formatExpiryLabel,
  type PantryItem,
} from "@/lib/pantry-ui";

export type PantryItemUpdate = {
  name?: string;
  category?: string;
  expiresAt?: string;
};

type ItemRowProps = {
  item: PantryItem;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, patch: PantryItemUpdate) => Promise<void> | void;
};

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ItemRow({ item, onDelete, onUpdate }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category ?? "grocery");
  const [expiresOn, setExpiresOn] = useState(toDateInputValue(item.expiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setName(item.name);
    setCategory(item.category ?? "grocery");
    setExpiresOn(toDateInputValue(item.expiresAt));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    if (!onUpdate) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!expiresOn) {
      setError("Expiry date is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onUpdate(item.id, {
        name: name.trim(),
        category: category.trim() || "grocery",
        expiresAt: new Date(`${expiresOn}T12:00:00`).toISOString(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (editing && onUpdate) {
    return (
      <li className="space-y-2 border-b border-ink/10 py-3 last:border-b-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-leaf/30 focus:ring"
          aria-label="Item name"
        />
        <div className="flex flex-wrap gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-w-[8rem] flex-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-leaf/30 focus:ring"
            aria-label="Category"
            placeholder="category"
          />
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-leaf/30 focus:ring"
            aria-label="Expiry date"
          />
        </div>
        {error ? <p className="text-xs text-clay">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveEdit()}
            className="rounded-full bg-leaf px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancelEdit}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-ink/10"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-ink/45">
          Currently {formatExpiryLabel(item.expiresAt)} ({daysUntilExpiry(item.expiresAt)}d)
        </p>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-ink">{item.name}</p>
          <ExpiryBadge expiresAt={item.expiresAt} />
        </div>
        <p className="mt-1 text-sm text-ink/60">{formatExpiryLabel(item.expiresAt)}</p>
        {item.category ? (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/40">
            {item.category}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {onUpdate ? (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm font-medium text-leaf hover:underline"
            aria-label={`Edit ${item.name}`}
          >
            Edit
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-sm font-medium text-clay/90 hover:text-clay"
            aria-label={`Remove ${item.name}`}
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}
