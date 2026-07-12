"use client";

import { ExpiryBadge } from "@/components/ExpiryBadge";
import { formatExpiryLabel, type PantryItem } from "@/lib/pantry-ui";

type ItemRowProps = {
  item: PantryItem;
  onDelete?: (id: string) => void;
};

export function ItemRow({ item, onDelete }: ItemRowProps) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-ink">{item.name}</p>
          <ExpiryBadge expiresAt={item.expiresAt} />
        </div>
        <p className="mt-1 text-sm text-ink/60">{formatExpiryLabel(item.expiresAt)}</p>
        {item.category ? (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/40">{item.category}</p>
        ) : null}
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="shrink-0 text-sm font-medium text-clay/90 hover:text-clay"
          aria-label={`Remove ${item.name}`}
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}
