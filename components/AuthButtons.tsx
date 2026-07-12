"use client";

import { signIn, signOut, useSession } from "next-auth/react";

/**
 * Sign in / sign out controls (Person 1).
 * Simple Tailwind styling for use on the login page and app shell.
 */
export function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "authenticated" && session?.user) {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {session.user.name ? (
          <p className="text-sm text-ink/80">{session.user.name}</p>
        ) : null}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10 sm:w-auto"
        >
          Sign Out
        </button>
      </div>
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
        Sign In
      </button>
    </div>
  );
}
