import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EZXpire",
  description: "Scan grocery receipts and track food expiry dates.",
  applicationName: "EZXpire",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6b4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-10 pt-6">
            <header className="mb-8 flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-leaf">
                    Fresh longer
                  </p>
                  <Link
                    href="/"
                    className="font-display text-4xl font-bold tracking-tight text-ink"
                  >
                    EZXpire
                  </Link>
                </div>
                <AuthButtons variant="header" />
              </div>
              <nav className="flex gap-2 text-sm font-semibold">
                <Link
                  href="/"
                  className="rounded-full bg-white/70 px-3 py-1.5 shadow-sm ring-1 ring-leaf/10"
                >
                  Pantry
                </Link>
                <Link
                  href="/scan"
                  className="rounded-full bg-leaf px-3 py-1.5 text-white shadow-sm"
                >
                  Scan
                </Link>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
