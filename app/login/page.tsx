"use client";

import { SessionProvider } from "next-auth/react";

import { AuthButtons } from "@/components/AuthButtons";

/**
 * Sign-in page (Person 1).
 * Centered layout; Tailwind only; no pantry logic.
 */
export default function LoginPage() {
  return (
    <SessionProvider>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Sign in to EZXpire
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/65">
          Save your pantry across devices and keep track of what expires soon.
        </p>
        <div className="mt-8 w-full max-w-xs">
          <AuthButtons />
        </div>
      </div>
    </SessionProvider>
  );
}
