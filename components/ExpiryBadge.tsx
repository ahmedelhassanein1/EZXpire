import { expiryStatus, type ExpiryStatus } from "@/lib/pantry-ui";

const STYLES: Record<ExpiryStatus, string> = {
  fresh: "bg-leaf/15 text-leaf ring-leaf/20",
  soon: "bg-citrus/20 text-[#8a5a00] ring-citrus/40",
  expired: "bg-clay/15 text-clay ring-clay/30",
};

const LABELS: Record<ExpiryStatus, string> = {
  fresh: "Fresh",
  soon: "Soon",
  expired: "Expired",
};

type ExpiryBadgeProps = {
  expiresAt: string;
};

export function ExpiryBadge({ expiresAt }: ExpiryBadgeProps) {
  const status = expiryStatus(expiresAt);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
