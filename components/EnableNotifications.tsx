"use client";

import { useCallback, useEffect, useState } from "react";

type EnableNotificationsProps = {
  className?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function EnableNotifications({ className }: EnableNotificationsProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "on" | "unsupported" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setStatus("on");
    }
  }, []);

  const enable = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) {
        throw new Error("Push is not configured (missing VAPID keys).");
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was denied.");
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      if (!saveRes.ok) {
        const body = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save push subscription.");
      }

      setStatus("on");
      setMessage("Reminders enabled for items expiring within 2 days.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not enable notifications.");
    }
  }, []);

  if (status === "unsupported") {
    return (
      <p className={`text-sm text-ink/50 ${className ?? ""}`}>
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={enable}
        disabled={status === "loading" || status === "on"}
        className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "on"
          ? "Expiry reminders on"
          : status === "loading"
            ? "Enabling…"
            : "Enable expiry reminders"}
      </button>
      {message ? <p className="mt-2 text-sm text-ink/60">{message}</p> : null}
    </div>
  );
}
