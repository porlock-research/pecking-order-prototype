# Known Issues Index

Quick reference for all tracked issues. Each category has its own file.

## Active Issue Files

| File | Description | Open Issues |
|------|-------------|-------------|
| [client-bugs.md](client-bugs.md) | Client/UI bugs | 4 |
| [production-infra.md](production-infra.md) | Production hardening & infrastructure | 12 |
| [admin-tooling.md](admin-tooling.md) | Admin dashboard, lobby tooling, game status | 5 |
| [architecture-debt.md](architecture-debt.md) | Deep architectural concerns (deploy strategy, snapshots, scheduler) | 3 |
| [playtest-feedback.md](playtest-feedback.md) | Playtest 1 bugs, UX feedback, feature requests | 13 |

## Archive

| File | Description |
|------|-------------|
| [fixed-archive.md](fixed-archive.md) | All resolved issues (condensed, for reference) |

## Priority Summary

**CRITICAL:**
- BUG-015 — Deploy strategy for live games (no safe way to push code during active games)

**HIGH:**
- ADMIN-001 — DO snapshot uses legacy KV API, not queryable in Data Studio
- ADMIN-004 — Game status not synced between lobby and game server
- PROD-030 — Speed run mode creates false positives in local testing

**MEDIUM:**
- PROD-002 — High client disconnected rate (~56%)
- PROD-022 — Push notification remaining items (multi-device, batch queries)
- PROD-023 — L1 subscription callback monolithic observer
- PROD-025 — Axiom logs flat and hard to trace
- PROD-026 — Returning players see PWA install prompt + stale game shell
- PROD-028 — Game code entry lacks validation
- PROD-029 — Push for close/end events arrives too late
- ADMIN-002 — No admin journal replay / silver ledger
- PT1-BUG-002 — Message input field disappears intermittently
