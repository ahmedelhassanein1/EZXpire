"use client";

import { useRef } from "react";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function CameraCapture({
  onCapture,
  disabled = false,
  label = "Take photo",
  className = "",
}: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    onCapture(file);
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {label}
      </button>
    </>
  );
}
