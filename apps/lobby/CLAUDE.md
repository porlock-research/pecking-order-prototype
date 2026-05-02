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

## Design Context

Lobby has its own design brief at **`apps/lobby/.impeccable.md`** — distinct from the repo-root `.impeccable.md` (which is for the Pulse shell). Use lobby's brief when invoking any `/impeccable:*` skill on a lobby page. The two surfaces are intentionally different: Pulse is calm + dramatic + recedes; lobby is loud + photo-driven + magazine-cover. Don't conflate them.

## Key Patterns

- Lobby UI converts local time → UTC via `new Date(datetimeLocal).toISOString()` before sending to server.
- Player slots are 1-indexed (`p1`, `p2`, ...). Lobby creates slots starting at 1.
- Channel types: MAIN, DM, GROUP_DM, GAME_DM.
