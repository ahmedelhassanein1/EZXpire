# EZXpire

Mobile-friendly web app that scans grocery receipts and estimates food expiry dates.

## Problem

Grocery receipts tell you what you bought and what you paid — not how long each item will last. Food often gets forgotten in the fridge until it’s too late.

## Goals (v1)

- Capture a receipt photo on a phone
- Extract grocery line items from the receipt (OCR)
- Estimate expiry dates from the purchase date plus food-category heuristics / Gemini
- Show a simple pantry list with items that are expiring soon
- Remind users when expiry is close (in-app + browser/PWA push)

## Non-goals (for now)

- Native iOS/Android apps
- Barcode scanning
- Recipe suggestions
- Multi-user household sync
- ElevenLabs / voice features
- Email or SMS expiry notifications

## Locked decisions (v1)

- **OCR:** on-device via **Tesseract.js** (receipt image never leaves the browser for OCR)
- **AI assist:** **Gemini API only** — clean OCR text into structured line items and suggest categories/expiry (server-side only; key in `.env`)
- **Storage:** **MongoDB Atlas** (cloud pantry per user; sync across devices) — env keys added when auth/DB are wired
- **Accounts:** **Auth.js (NextAuth)** with a MongoDB adapter — env keys added when auth/DB are wired
- **Notifications:** **in-app + Web Push** (no email) — see below
- **Hosting:** **Vercel** (HTTPS for camera); Devpost links to the demo + GitHub only

## Hosting

- **Vercel** — host the live app; open the HTTPS URL on your phone to use it (camera needs HTTPS)
- **Devpost** — hackathon showcase page only; link the Vercel demo and GitHub repo (Devpost does not host the app)

## Notifications (expiry reminders)

Two layers; **no email**.

### Trigger

Items whose `expiresAt` falls within **2 days** (including “expires today”) are treated as “expiring soon.”

### 1. In-app

When the user opens the pantry:

- Sort / highlight items expiring within 2 days
- Show expiry badges (fresh / soon / expired)

Works without push permission; only visible while the app is open.

### 2. Browser / PWA Web Push

Real OS-level alerts when the browser (or installed PWA) can receive push:

1. User grants notification permission
2. App stores their **push subscription** in MongoDB (per user)
3. A daily **Vercel Cron** job scans pantry items nearing expiry
4. Server sends a Web Push message (“Milk expires tomorrow”)

Requires HTTPS (Vercel). On iPhone, push is most reliable when the app is **added to the Home Screen** (PWA).

### Env (added when push is wired)

```env
# Web Push (VAPID) — server-side only
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

# Protect the cron route (Vercel Cron sends this header)
CRON_SECRET=
```

## Env / secrets

Local secrets live in `.env` (never committed). `.env.example` lists required keys without values. `.gitignore` ignores `.env`.

**Current `.env` (Gemini only for now):**

```env
# Google Gemini (server-side only — used from Next.js API routes)
GEMINI_API_KEY=
```

`MONGODB_URI` / `AUTH_SECRET` / `VAPID_*` / `CRON_SECRET` will be added when those features are implemented. Server secrets must not use a `NEXT_PUBLIC_` prefix (except the public VAPID key if exposed to the client for subscribe).

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript** | Mobile-friendly React, API routes, easy Vercel deploy |
| UI | **Tailwind CSS** | Fast mobile layout without a heavy component library |
| OCR | **Tesseract.js** | Runs in the browser; free |
| AI | **Gemini API** | Structure OCR text + suggest expiry; key via `.env` |
| Auth | **Auth.js (NextAuth) + MongoDB adapter** | Accounts/sessions; works with Atlas |
| Database | **MongoDB Atlas** | Hosted document DB for users + pantry items |
| DB client | **official `mongodb` driver** | Simple CRUD from API routes |
| Expiry logic | **Gemini suggestions + static heuristic fallback** | AI when available; table if Gemini fails |
| Notifications | **In-app UI + Web Push** | Reminders without email; cron on Vercel |
| Scheduling | **Vercel Cron** | Daily scan for items expiring within 2 days |
| Camera | Browser **`getUserMedia` / file input** | Works on phone over HTTPS |
| Deploy | **Vercel** | Set the same env vars in the Vercel project settings |

## App flow

1. Sign in
2. Capture receipt photo
3. Tesseract.js OCR on device
4. Gemini API structures items
5. User reviews and edits items
6. API route saves to Atlas
7. Pantry / expiring-soon list (in-app)
8. (Optional) enable push → daily cron sends Web Push for close expiries

## Planned files

### Scaffold / config

- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript config
- `next.config.ts` — Next.js config
- `vercel.json` — cron schedule for expiry reminders
- `postcss.config.mjs` / `tailwind.config.ts` — Tailwind
- `.gitignore` — ignore `node_modules`, `.next`, `.env`, `.env*.local`
- `.env.example` — documented keys without secrets
- `.env` — local secrets including `GEMINI_API_KEY` (gitignored)

### App routes

- `app/layout.tsx` — root layout, session provider
- `app/page.tsx` — pantry home (auth-gated)
- `app/scan/page.tsx` — scan → OCR → Gemini → review → save
- `app/login/page.tsx` — sign-in UI
- `app/globals.css` — global styles
- `app/api/auth/[...nextauth]/route.ts` — Auth.js
- `app/api/parse-receipt/route.ts` — accepts OCR text; calls Gemini; returns structured items
- `app/api/pantry/route.ts` — list / create pantry items
- `app/api/pantry/[id]/route.ts` — update / delete item
- `app/api/push/subscribe/route.ts` — save / remove Web Push subscription for the signed-in user
- `app/api/cron/expiry-reminders/route.ts` — daily job: find soon-to-expire items and send push

### Other

- `lib/gemini.ts` — server helper using `GEMINI_API_KEY`
- `lib/push.ts` — Web Push send helper (VAPID)
- `public/sw.js` (or equivalent service worker) — receive push events
- Components for camera, OCR progress, parsed-item editor, pantry list, expiry badges, enable-notifications control
- `data/shelfLife.ts` — heuristic shelf-life table (fallback)

## Implementation order

1. Create `.gitignore`, `.env.example`, and local `.env` (Gemini key placeholder) — done
2. Scaffold Next.js + Tailwind; wire env vars
3. Auth.js + MongoDB Atlas; login; protect routes
4. Pantry API + list UI (including in-app “expiring soon”)
5. Tesseract OCR → Gemini parse API → review/edit → save
6. Web Push subscribe + Vercel Cron expiry reminders
7. Deploy to Vercel (add env vars there); polish mobile UX / PWA

## Team

See [TEAM.md](TEAM.md) for 4-person file ownership (to reduce merge conflicts).

## Status

Early planning. Env scaffolding is in place; app code not started yet.
