# EZXpire

Mobile-friendly web app that scans grocery receipts and estimates food expiry dates.

## Problem

Grocery receipts tell you what you bought and what you paid — not how long each item will last. Food often gets forgotten in the fridge until it’s too late.

## Goals (v1)

- Capture a receipt photo on a phone
- Extract grocery line items from the receipt (OCR)
- Estimate expiry dates from the purchase date plus food-category heuristics
- Show a simple pantry list with items that are expiring soon

## Non-goals (for now)

- Native iOS/Android apps
- Barcode scanning
- Recipe suggestions
- Multi-user household sync

## Hosting

- **Vercel** — host the live app; open the HTTPS URL on your phone to use it (camera needs HTTPS)
- **Devpost** — hackathon showcase page only; link the Vercel demo and GitHub repo (Devpost does not host the app)

## Open decisions

- **Storage:** local-only on the device vs accounts and cloud sync
- **OCR:** on-device (free/offline) vs cloud OCR (higher accuracy, API cost)

## Status

Early planning. This repo currently contains project notes only.
