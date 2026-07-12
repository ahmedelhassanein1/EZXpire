"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EnableNotifications } from "@/components/EnableNotifications";
import { PantryList } from "@/components/PantryList";
import type { PantryItemUpdate } from "@/components/ItemRow";
import { demoPantryItems, type PantryItem } from "@/lib/pantry-ui";

function normalizeItems(payload: unknown): PantryItem[] {
  if (!Array.isArray(payload)) return [];
  const items: PantryItem[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? item._id ?? "");
    const name = String(item.name ?? "");
    const expiresAt = String(item.expiresAt ?? "");
    if (!id || !name || !expiresAt) continue;
    items.push({
      id,
      name,
      category: item.category ? String(item.category) : undefined,
      purchasedAt: item.purchasedAt ? String(item.purchasedAt) : undefined,
      expiresAt,
    });
  }
  return items;
}

export default function HomePage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pantry");
      if (!res.ok) throw new Error("pantry unavailable");
      const data = await res.json();
      const list = normalizeItems(Array.isArray(data) ? data : data.items);
      setItems(list);
      setSource("api");
    } catch {
      setItems(demoPantryItems());
      setSource("demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (source !== "api") return;
    try {
      await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    } catch {
      // Keep optimistic UI; list reloads on next visit.
    }
  };

  const onUpdate = async (id: string, patch: PantryItemUpdate) => {
    if (source !== "api") {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                name: patch.name ?? item.name,
                category: patch.category ?? item.category,
                expiresAt: patch.expiresAt ?? item.expiresAt,
              }
            : item
        )
      );
      return;
    }

    const res = await fetch(`/api/pantry/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: string; name?: string; category?: string; expiresAt?: string; _id?: string }
      | null;

    if (!res.ok) {
      throw new Error(body?.error ?? "Failed to update item");
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const expiresAt =
          body?.expiresAt != null
            ? String(body.expiresAt)
            : patch.expiresAt ?? item.expiresAt;
        return {
          ...item,
          name: body?.name ? String(body.name) : patch.name ?? item.name,
          category: body?.category
            ? String(body.category)
            : patch.category ?? item.category,
          expiresAt,
        };
      })
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-3xl leading-tight text-ink">What&apos;s expiring?</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
          Items within 2 days show as Soon. Enable push reminders so you get an alert even when
          the app is closed.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-ink/50">Loading pantry…</p>
      ) : (
        <>
          {source === "demo" ? (
            <p className="rounded-xl bg-citrus/15 px-3 py-2 text-xs text-[#6d4800] ring-1 ring-citrus/30">
              Showing demo items until Person 1&apos;s{" "}
              <code className="font-mono">/api/pantry</code> is available.
            </p>
          ) : null}
          <PantryList items={items} onDelete={onDelete} onUpdate={onUpdate} />
        </>
      )}

      <EnableNotifications />

      <Link
        href="/scan"
        className="flex w-full items-center justify-center rounded-full bg-leaf px-4 py-3 text-sm font-semibold text-white shadow-sm"
      >
        Scan a receipt
      </Link>
    </div>
  );
}
