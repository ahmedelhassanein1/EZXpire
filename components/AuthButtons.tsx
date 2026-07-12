"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

type AuthButtonsProps = {
  /** Compact controls for the app header */
  variant?: "page" | "header";
};

/**
 * Sign in / sign out controls.
 * Header: link to /login or Sign Out. Login page: GitHub sign-in button.
 */
export function AuthButtons({ variant = "page" }: AuthButtonsProps) {
  const { data: session, status } = useSession();
  const compact = variant === "header";

  if (status === "authenticated" && session?.user) {
    return (
      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        }
      >
        {session.user.name ? (
          <p className={`truncate text-ink/80 ${compact ? "max-w-[7rem] text-xs" : "text-sm"}`}>
            {session.user.name}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={
            compact
              ? "rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10"
              : "w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10 sm:w-auto"
          }
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-leaf/10"
      >
        {status === "loading" ? "…" : "Sign In"}
      </Link>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {status === "loading" ? (
        <p className="text-sm text-ink/50" aria-live="polite">
          Checking session…
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl: "/" })}
        disabled={status === "loading"}
        className="w-full rounded-full bg-leaf px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-70"
      >
        Sign In with GitHub
      </button>
    </div>
  );
}
