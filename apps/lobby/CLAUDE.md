# Lobby (Next.js 15)

## Architecture

Next.js 15 on Cloudflare via OpenNext. Handles game creation, invites, admin dashboard.

## PII Handling

PlaytestSignups stores encrypted PII only (`email_encrypted`, `phone_encrypted`, `email_hash`). Plaintext `email`/`phone` columns were dropped (migration 0014). `PII_ENCRYPTION_KEY` env var is required. Crypto helpers in `lib/crypto.ts`.

**Never store plaintext PII. Always encrypt before writing to D1.**

## Commands

- `next dev` (port 3000)
- `next build`
- `npm run deploy` (opennextjs + wrangler)

## Key Patterns

- Lobby UI converts local time → UTC via `new Date(datetimeLocal).toISOString()` before sending to server.
- Player slots are 1-indexed (`p1`, `p2`, ...). Lobby creates slots starting at 1.
- Channel types: MAIN, DM, GROUP_DM, GAME_DM.
