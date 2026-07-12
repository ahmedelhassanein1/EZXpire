"use client";

import { useEffect, useState } from "react";

type ReceiptPreviewProps = {
  imageFile: File;
  onRetake: () => void;
  className?: string;
};

export function ReceiptPreview({
  imageFile,
  onRetake,
  className = "",
}: ReceiptPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  if (!previewUrl) {
    return (
      <div
        className={`flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-gray-100 ${className}`}
        aria-busy="true"
      >
        <span className="text-sm text-gray-500">Loading preview…</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Receipt preview"
          className="aspect-[3/4] w-full object-contain"
        />
      </div>
      <button
        type="button"
        onClick={onRetake}
        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        Retake
      </button>
    </div>
  );
}
