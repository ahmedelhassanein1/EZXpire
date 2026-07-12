"use client";

type OcrProgressProps = {
  /** Overall OCR progress from 0 to 1. */
  progress: number;
  label?: string;
  className?: string;
};

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function OcrProgress({
  progress,
  label = "Reading receipt…",
  className = "",
}: OcrProgressProps) {
  const normalized = clampProgress(progress);
  const percent = Math.round(normalized * 100);

  return (
    <div className={`space-y-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-500">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="sr-only">
        {label} {percent} percent complete
      </span>
    </div>
  );
}
