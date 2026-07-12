"use client";

import { useMemo } from "react";
import { ItemRow, type PantryItemUpdate } from "@/components/ItemRow";
import { daysUntilExpiry, type PantryItem } from "@/lib/pantry-ui";

type PantryListProps = {
  items: PantryItem[];
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, patch: PantryItemUpdate) => Promise<void> | void;
};

export function PantryList({ items, onDelete, onUpdate }: PantryListProps) {
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => daysUntilExpiry(a.expiresAt) - daysUntilExpiry(b.expiresAt)
      ),
    [items]
  );

  const soonCount = sorted.filter((item) => {
    const days = daysUntilExpiry(item.expiresAt);
    return days >= 0 && days <= 2;
  }).length;

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-white/70 p-6 text-center shadow-sm ring-1 ring-ink/5">
        <p className="font-display text-xl text-ink">Your pantry is empty</p>
        <p className="mt-2 text-sm text-ink/60">Scan a receipt to add groceries.</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-ink/5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">Pantry</h2>
        <p className="text-sm text-ink/55">
          {soonCount > 0 ? `${soonCount} expiring soon` : "Nothing urgent"}
        </p>
      </div>
      <ul>
        {sorted.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
      </ul>
    </section>
  );
}
