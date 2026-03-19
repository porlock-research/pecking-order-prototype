---
description: Monitor a playtest or local dev session — watches logs, Sentry, and Cloudflare for errors in real-time
disable-model-invocation: true
---

# Playtest / Dev Session Monitor

Start real-time monitoring of the Pecking Order game infrastructure. Detect issues proactively and flag them to the user.

## Setup

1. **Get Chrome context** — call `tabs_context_mcp` to discover existing tabs
2. **Open monitoring dashboards** in Chrome tabs:
   - Sentry: check for new errors in the pecking-order project
   - Cloudflare Workers dashboard: request volume, error rates, CPU time
3. **Start live log tailing** in background terminals:
   - Game server: `cd apps/game-server && npx wrangler tail --env staging`
   - Lobby: `cd apps/lobby && npx wrangler tail --env staging`
4. **Report ready** — tell the user monitoring is active and what you're watching

## What to Watch For

| Category | Pattern | Severity |
|---|---|---|
| Push failures | `[L1] [Push]` without `Result` | High |
| WebSocket disconnects | 4001 close codes, "Invalid Player ID" | High |
| DO evictions | Unexpected snapshot restores | High |
| D1 errors | Failed journal writes | High |
| Token issues | Expired tokens, purge errors | Critical |
| XState errors | Unhandled events, transition failures | High |
| CORS errors | Cross-origin failures | Medium |
| CPU limits | Worker CPU time exceeded | Medium |

## Key Log Prefixes

- `[L1]` — Durable Object / server.ts
- `[L2]` — XState orchestrator
- `[L3]` — XState daily session
- `[Push]` — Push notification delivery
- `[App]` — Client-side (Sentry only)

## Staging Domains

- Lobby: `staging-lobby.peckingorder.ca`
- Client: `staging-play.peckingorder.ca`
- API: `staging-api.peckingorder.ca`
- Assets: `staging-assets.peckingorder.ca`

## Behavior

- Flag issues proactively — don't wait to be asked
- Periodically check Sentry for new errors (every few minutes when asked)
- If you see a pattern of errors, summarize and recommend a fix
- Keep messages concise — the user is busy managing playtesters
