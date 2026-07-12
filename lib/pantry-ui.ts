/** UI-facing pantry shape expected from Person 1's `/api/pantry`. */
export type PantryItem = {
  id: string;
  name: string;
  category?: string;
  purchasedAt?: string;
  expiresAt: string;
};

export type ExpiryStatus = "fresh" | "soon" | "expired";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntilExpiry(expiresAt: string, now = new Date()): number {
  const end = new Date(expiresAt);
  const start = new Date(now);
  end.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function expiryStatus(expiresAt: string, now = new Date()): ExpiryStatus {
  const days = daysUntilExpiry(expiresAt, now);
  if (days < 0) return "expired";
  if (days <= 2) return "soon";
  return "fresh";
}

export function formatExpiryLabel(expiresAt: string, now = new Date()): string {
  const days = daysUntilExpiry(expiresAt, now);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days}d`;
}

/** Demo items used when Person 1's pantry API is not available yet. */
export function demoPantryItems(now = new Date()): PantryItem[] {
  const iso = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };

  return [
    { id: "demo-1", name: "Organic spinach", category: "produce", expiresAt: iso(1) },
    { id: "demo-2", name: "Whole milk", category: "dairy", expiresAt: iso(2) },
    { id: "demo-3", name: "Sourdough bread", category: "bakery", expiresAt: iso(4) },
    { id: "demo-4", name: "Greek yogurt", category: "dairy", expiresAt: iso(-1) },
    { id: "demo-5", name: "Canned chickpeas", category: "pantry", expiresAt: iso(120) },
  ];
}
