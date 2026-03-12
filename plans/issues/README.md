# Known Issues Index

Quick reference for all tracked issues. Each category has its own file.

## Active Issue Files

| File | Description | Open Issues |
|------|-------------|-------------|
| [client-bugs.md](client-bugs.md) | Client/UI bugs + missing UI features + Vivid shell audit | 11 |
| [playtest-feedback.md](playtest-feedback.md) | Playtest 1 feedback + demo UI audit | 16 |
| [production-infra.md](production-infra.md) | Production hardening & infrastructure | 12 |
| [admin-tooling.md](admin-tooling.md) | Admin dashboard, lobby tooling, game status | 4 |
| [architecture-debt.md](architecture-debt.md) | Deep architectural concerns (deploy strategy, snapshots, scheduler) | 3 |

## Archive

| File | Description |
|------|-------------|
| [fixed-archive.md](fixed-archive.md) | All resolved issues (condensed, for reference) |

---

## Complete Open Issue Map

### CRITICAL
| ID | Category | Summary |
|----|----------|---------|
| BUG-015 | Architecture | No deploy strategy for live games — code push during active game loses state |
| BUG-016 | Client UI | Stage "HERE" avatar perpetual animation instability — never settles, blocks interaction |
| BUG-017 | Client UI | ~~BroadcastBar marquee text clipping~~ ✅ FIXED |

### HIGH — Must fix before next playtest
| ID | Category | Summary |
|----|----------|---------|
| BUG-014 | Client UI | ~~**Missing UI: DM accept/decline flow**~~ ✅ FIXED (ADR-096) |
| PT1-BUG-002 | Client Bug | Message input field disappears intermittently — no repro steps |
| DEMO-002 | Client UI | ~~Whispers picker: z-index bleed-through~~ ✅ FIXED |
| ADMIN-004 | Admin | Game status not synced between lobby and game server |
| PROD-030 | Testing | Speed run creates false positives — missed critical bugs before playtest |

### MEDIUM — Important for game quality
| ID | Category | Summary |
|----|----------|---------|
| PT1-BUG-001 | Client Bug | Opening conversation jumps back instead of latest message |
| DEMO-001 | Client UI | DM character counter shows 999999/999999 (demo seed data) |
| DEMO-003 | Client UI | ~~Whispers picker: header overlaps with broadcast bar~~ ✅ FIXED |
| DEMO-004 | Client UI | ~~New Group: "Create Group" button overlaps tab bar~~ ✅ FIXED |
| BUG-012 | Client Bug | iOS standalone PWA session persistence (largely mitigated) |
| BUG-015a | Client UI | ~~**Missing UI: voting explainer**~~ ✅ FIXED (ADR-098) |
| BUG-015b | Client UI | **Missing UI: economy explainer + transaction log** (selector ready) |
| BUG-018 | Client UI | ~~"Vivid" debug button visible in production tab bar~~ ✅ FIXED |
| BUG-019 | Client UI | DramaticReveal doesn't auto-dismiss — blocks interaction indefinitely |
| BUG-020 | Client UI | Empty Stage chat — no actionable empty state or guidance |
| BUG-021 | Client UI | Whispers empty state lacks guidance for new players |
| BUG-022 | Client UI | ~~NewConversationPicker disabled button nearly invisible~~ ✅ FIXED |
| PT1-UX-004 | UX | Voting interface confusing — `VOTE_TYPE_INFO` exists, needs cartridge integration |
| PT1-UX-005 | UX | Vote results not visible after voting — needs design (open vs purchasable) |
| PT1-UX-006 | UX | Mini game results confusing — CelebrationSequence needs clearer breakdown |
| PT1-UX-007 | UX | No rules / onboarding screen |
| PT1-UX-008 | UX | Silver economy opaque — needs transaction history UI |
| PT1-UX-010 | UX | Timeline unclear — when do events end? |
| PROD-002 | Infra | High client disconnected rate (~56%) |
| PROD-004 | Infra | Lobby→Game Server uses public fetch (should use service bindings) |
| PROD-015 | Infra | Code deploys disconnect all WebSocket clients |
| PROD-022 | Infra | Push notification remaining items (multi-device, batch) |
| PROD-023 | Infra | L1 subscription callback monolithic observer |
| PROD-025 | Infra | Axiom logs flat and hard to trace |
| PROD-026 | Infra | Returning players see PWA install prompt + stale game shell |
| PROD-028 | Infra | Game code entry flow lacks validation |
| PROD-029 | Infra | Push for close/end events arrives too late |
| ADMIN-002 | Admin | No admin journal replay / silver ledger |
| ADMIN-005 | Admin | No automatic cleanup of archived/completed games |
| PROD-016 | Architecture | L3 session state fragile on snapshot restore |

### LOW — Nice to have
| ID | Category | Summary |
|----|----------|---------|
| DEMO-005 | Client UI | ~~Whispers picker: DM/Group buttons bleed through~~ ✅ FIXED |
| DEMO-006 | Client UI | Cast tab: inconsistent card layout for #4 vs podium (#1-3) |
| BUG-004 | Client UI | Cartridge enter animation missed on late join |
| BUG-005 | Client UI | ~~Completed phase timeline cards lack visual polish~~ ✅ FIXED (ADR-098) |
| BUG-008 | Client UI | Group chat creation UI needs redesign for non-classic shells |
| BUG-015c | Client UI | **Missing UI: player activity indicators** (data ready) |
| BUG-023 | Client UI | ~~Player Detail "More coming soon..." placeholder~~ ✅ FIXED |
| BUG-024 | Client UI | ~~Cast "ELIMINATED" badge has no visual container~~ ✅ FIXED |
| BUG-025 | Client UI | ~~No safe area padding on BroadcastBar~~ ✅ FIXED |
| BUG-026 | Client UI | Dashboard "No events scheduled yet." unclear for ADMIN games |
| BUG-027 | Client UI | ~~BroadcastBar currency pills have no labels~~ ✅ FIXED |
| PT1-UX-001 | UX | Gold not communicated alongside silver in mini games |
| PT1-UX-009 | UX | Player activity/engagement visibility wanted |
| PROD-003 | Infra | Storage operations volume (6k/24h, no delta) |
| PROD-008 | Infra | Hand-written Env interface (should use wrangler types) |
| PROD-011 | Infra | D1 writes unawaited (partially mitigated) |
| PROD-013 | Infra | RPC methods available but unused |
| ADMIN-003 | Admin | D1 Players table not updated during gameplay |
| PROD-017 | Architecture | PartyWhen alarm scheduling partially opaque |

### Recently Fixed (not yet archived)
| ID | Summary |
|----|---------|
| ADMIN-001 | DO snapshot KV→SQL migration (ADR-092) |
| BUG-013 | Scheduler alarms lost on DO restart (ADR-093) |
| PT1-BUG-003 | Admin panel accessible to non-admin players |
| PT1-UX-002 | Alive players sorted by silver |
| PT1-UX-003 | Character bios visible in game |

---

## Clustering: Shared Root Causes

**Whispers Picker Overlay (DEMO-002/003/004/005)** — Single fix: add opaque background to overlay wrapper in VividShell.tsx. All four issues stem from the picker panel using semi-transparent backgrounds (`bg-skin-panel/40`, `bg-glass`) with no solid backdrop.

**Missing UI for backend features (BUG-014, BUG-015a/b/c)** — Backend + store selectors exist, need client components. Could batch these into a "UI integration" sprint.

**Playtest UX feedback (PT1-UX-004/005/006/007/008/010)** — All need design decisions before implementation. Could batch the design phase.

**BroadcastBar polish (BUG-017/025/027)** — Three issues in the same component: marquee clipping, safe area padding, unlabeled currency pills. Single pass fix.

**Empty states (BUG-020/021/026)** — Stage chat, Whispers, and Dashboard all need contextual empty states. Could batch as a "first-run experience" pass.

**Vivid shell audit (BUG-016 through BUG-027)** — 12 new issues from Playwright audit at 390×844 mobile viewport. 2 critical, 5 medium, 5 low.
