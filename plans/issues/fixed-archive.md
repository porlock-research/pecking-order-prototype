# Fixed Issues Archive

Condensed summaries of all resolved issues. Full investigation notes preserved in git history (original `KNOWN_ISSUES.md`).

---

## Client/UI Bugs

| ID | Summary | Fix |
|----|---------|-----|
| BUG-001 | Game Master DMs missing from SYNC | Server: lazy-create DM channel in L3 for GM. Client: GM card in PeopleList + PlayerDrawer. |
| BUG-002 | Elimination reveal auto-dismisses (3s timer) | Removed auto-dismiss; all reveals require tap to dismiss. |
| BUG-003 | Header day number off by one | Server sends 1-based `dayIndex`; removed `+ 1` in Header.tsx. |
| BUG-006 | Immersive header layout cluttered, avatar misplaced | Avatar moved to right. Expanded section: status row + 3-column currency grid. |
| BUG-007 | Online indicator too subtle and inconsistent | Gold ring on PersonaAvatar when online. Applied across Header, PeopleList, PlayerDrawer, ChatBubble, FloatingInput. |
| BUG-009 | Irrelevant ticker messages in 1-on-1 DMs | usePlayerTimeline requires BOTH playerId and targetPlayerId in involvedPlayerIds. |
| BUG-010 | Admin panel shows all players as eliminated | Fixed `p.isAlive` (undefined) to `p.status`. |
| BUG-011 | Toast notifications redundant with ticker | Removed broadcast ticker-to-toast watcher; toasts only for targeted events (DM rejections, perk results). |
| BUG-014 | Duplicate wakeup tasks from L1 subscription | Removed reactive scheduling from L1 subscription. Manifest events pre-scheduled as individual PartyWhen tasks at init. (ADR-071) |

## Production Hardening

| ID | Summary | Fix |
|----|---------|-----|
| PROD-001 | Lobby worker CPU time limit exceeded (~14%) | R2 public access via `assets.peckingorder.ca`. Roster avatar URLs point directly to R2 CDN. (ADR-074, ADR-078) |
| PROD-005 | AUTH_SECRET compared with `===` (timing attack) | All 5 auth checks use `timingSafeEqual()` helper. (ADR-076) |
| PROD-006 | Game server compatibility_date 2024-02-07 | Updated to `2026-02-25`. (ADR-070) |
| PROD-007 | WebSocket connections don't use Hibernation API | Enabled `hibernate: true`. All in-memory state recovery addressed: goldCredited persisted, connectedPlayers rebuilt from attachments, sentPushKeys eliminated. (ADR-070) |
| PROD-009 | Snapshot persistence unawaited (fire-and-forget) | Acceptable tradeoff — CF output gate holds outgoing messages until pending writes complete. No action needed. |
| PROD-010 | connectedPlayers map lost on DO eviction | `serializeAttachment({ playerId })` on connect. `rebuildConnectedPlayers()` in onStart(). All WS reads fallback to deserializeAttachment(). (ADR-070) |
| PROD-012 | Alarm handler should be idempotent | Already idempotent via `lastProcessedTime` guard. Verified correct. |
| PROD-014 | No WebSocket message batching | Not urgent at 8 players. Revisit if scaling. |
| PROD-018 | Unconsumed response bodies in lobby (connection leak) | Added `res.body?.cancel()` to all 3 unconsumed fetch calls. (ADR-076) |
| PROD-019 | Cookie `secure` flag uses `process.env.NODE_ENV` | `secure: true` unconditionally. (ADR-069) |
| PROD-020 | Missing `Access-Control-Max-Age` CORS header | Added `Access-Control-Max-Age: 86400`. (ADR-076) |
| PROD-021 | No environment separation | Staging + production fully separated. Per-env wrangler configs, D1, R2, secrets, CI workflows. (ADR-069) |
| PROD-024 | PWA auth is game-scoped, no cross-game persistence | All services on `peckingorder.ca` subdomains. Session cookie with `domain: '.peckingorder.ca'`. (ADR-074) |
| PROD-027 | Service worker updates not applied until force-quit | `registerType: 'autoUpdate'`, `skipWaiting()`, `cleanupOutdatedCaches()`. |
