# GM Intelligence — Spec A: Chassis + Social Observer

**Date:** 2026-04-15
**Status:** Draft — awaiting user approval
**Author:** Manu + Claude
**Related:**
- `memory/v1-narrator-intrigue.md` (narrator rule, public-only, never viewer-relative)
- `apps/game-server/src/machines/game-master.ts` (existing GM actor)
- `apps/game-server/src/machines/observations/inactivity.ts` (existing first module)
- `apps/game-server/src/machines/cartridges/prompts/confession-machine.ts` (shape precedent for Spec C)
- Spec B (deferred) — LLM content layer; stub committed as part of this work
- Spec C (deferred) — Confession phase; stub committed as part of this work

## Why

Playtest data shows two engagement failures:

1. **Players don't know other players are playing.** The game feels empty between bursts of activity. No ambient presence signal tells you the table is live.
2. **Days feel same/passive/repetitive.** The GM today is a scheduler + inactivity-eliminator. It does not narrate, nudge, or react to what's happening.

The intent of GM Intelligence is to bring a reality-show-host Game Master character to life — a narrator that surfaces activity, nudges quiet players with context, and creates mild drama / FOMO / mischief without breaking the privacy contract players have with their DMs.

This spec covers **Spec A only**:

- A **chassis upgrade** to the existing Game Master actor: module registry, action-dispatch registry, async pre-hook for D1 reads, finer lifecycle hooks.
- The first content module, **Social Observer**, template-driven, emitting public activity lines and private nudges.

**Explicitly deferred:**
- LLM-generated content → Spec B.
- Confession phase → Spec C.
- Cross-day callback lines (templates feel wooden for this; wait for Spec B).
- STATIC manifests (remain GM-less in Spec A).

## Guiding principles

- **Activity surfacing over drama.** The primary goal is presence signal; drama is a welcome side-effect.
- **Never name both DM partners together.** Absolute. Enforced at template type, emission-time check, and a regression test.
- **Obscure DM-derived references via bio descriptors.** Players learn they are being watched without learning who is being watched.
- **Name freely for non-DM-derived observations** (silver, perks, reconnects, arcade retries, online time, votes received). These are already public actions.
- **Additive chassis changes only.** Existing `inactivityModule` + its elimination behavior unchanged.
- **Everything deterministic in v1.** Seeded round-robin template selection. No stochastic output.

## Scope boundaries

**In scope:**
- Chassis: module registry, action-dispatch registry, async D1 pre-hook, new `onPhaseImminent` hook.
- Content: `socialObserver` module.
- Two new action types: `EMIT_TICKER_LINE`, `NUDGE_DM`.
- One new fact type: `GM_OBSERVATION` (journalable, tickered, pushed).
- New D1 read helpers in `d1-journal-queries.ts`.
- Migration of `inactivityModule` into the registry without behavior change.
- E2E + unit test coverage.
- DemoServer updated with the social-observer module registered.

**Out of scope:**
- LLM integration.
- Confession phase.
- Cross-day callback content.
- STATIC-manifest GM support.
- Client-side GM "thinking" indicator or "mute GM" toggle.

## Architecture

### Existing GM actor (unchanged structure)

`game-master.ts` defines an XState actor spawned once at `preGame` for DYNAMIC manifests only (`spawnGameMasterIfDynamic` at `l2-day-resolution.ts:39-60`). States: `pregame → tournament → postgame`. Events: `GAME_MASTER.RESOLVE_DAY`, `GAME_MASTER.DAY_ENDED`, `GAME_ENDED`, `FACT.RECORD`, `ADMIN.OVERRIDE_NEXT_DAY`. Long-lived; persisted via XState snapshot through the DO `snapshots` table. This shell remains.

### New chassis pieces

**Module registry.** A top-level `OBSERVATION_MODULES: ObservationModule<any>[]` array replaces the hard-coded `inactivityModule` singleton. Each module declares a stable `id`. State held in `GameMasterContext.moduleStates: Record<ModuleId, unknown>` — one bag, modules own their slot.

**Extended `ObservationModule` contract:**

```ts
export interface ObservationModule<TState> {
  id: string;
  init(roster, ruleset): TState;
  loadContext?(args: { gameId: string; dayIndex: number; env: Env }): Promise<unknown>;
  onResolveDay(state, dayIndex, roster, ruleset, loadedContext?): { state; actions: GameMasterAction[] };
  onFact(state, fact): TState;
  onDayEnded(state, dayIndex, roster): TState;
  onPhaseImminent?(state, phase, roster, loadedContext?): { state; actions: GameMasterAction[] };
}
```

**Action-dispatch registry.** `processGameMasterActions` loses its `if (ELIMINATE)` branch and becomes a dispatcher:

```ts
export const GAME_MASTER_HANDLERS: Record<GameMasterActionType, ActionHandler> = {
  [GameMasterActionTypes.ELIMINATE]:        handleEliminate,
  [GameMasterActionTypes.EMIT_TICKER_LINE]: handleEmitTickerLine,
  [GameMasterActionTypes.NUDGE_DM]:         handleNudgeDm,
};
```

Adding a new action type = one entry in the map + a handler function. The existing pre-applied voting-elimination guard (`pendingElimination.eliminatedId` in `l2-day-resolution.ts:155-159`) stays, wrapped at the top of `handleEliminate`.

**Async pre-hook.** Before `dayLoop.morningBriefing` transitions, L2 invokes a new `fromPromise` actor `loadObservationContext` that iterates `OBSERVATION_MODULES`, calls `loadContext()` on those that implement it, and returns `Record<ModuleId, unknown>`. L2 stores the result on a transient context field and passes it through on `GAME_MASTER.RESOLVE_DAY`. The GM actor passes `loadedContext[id]` to each module's `onResolveDay`.

Failure modes:
- Promise rejection → log, proceed with `loadedContext = {}`. Modules MUST tolerate missing context.
- Hard timeout at 2s via `Promise.race` → same fallback.

**D1 query helper module.** `apps/game-server/src/d1-journal-queries.ts` — typed wrappers over `GameJournal` for:

- `dmFanout(gameId, dayIndex): Record<actorId, { partners: Set<string>; messageCount: number }>`
- `silverFanout(gameId, dayIndex): Record<actorId, { recipients: Set<string>; total: number }>`
- `perkUsage(gameId, dayIndex): Record<actorId, number>`
- `voteReceivedCounts(gameId, dayIndex): Record<targetId, number>`
- `dmInvitesUnread(gameId, dayIndex): Array<{ targetId: string; sentAt: number }>`

Reuses existing `idx_journal_game_type_actor` and `idx_journal_game_day` indexes. `querySpyDms` in `d1-persistence.ts` stays where it is; no refactor of the perk pathway.

**Phase-imminent hook.** A second trigger path orthogonal to daily cadence:

1. When L3 opens a phase with a close alarm (voting, prompt, dilemma, activity, group chat), it schedules a sibling DO alarm at `closeMs - reminderLeadMs` with task id `phase-imminent:<phaseId>`.
2. When the sibling alarm fires, L3 dispatches `GAME_MASTER.PHASE_IMMINENT { phase, phaseId, deadline }` up to L2.
3. L2 forwards to the GM actor. GM calls `module.onPhaseImminent` on every module that implements it.
4. If the phase closes early (everyone acted), the phase-exit action cancels the `phase-imminent:<phaseId>` task.
5. Handler guards: if the phase is no longer in `running`, log + skip; no harm.

`reminderLeadMs` lives in `Config.gm.socialObserver.phaseImminent.leadMs` keyed by schedule preset:
- `PLAYTEST`, `PLAYTEST_SHORT`, `COMPACT`, `DEFAULT` → 15 minutes
- `SPEED_RUN` → 3 minutes
- `SMOKE_TEST` → 90 seconds

**Short-phase guard.** If `reminderLeadMs >= (closeMs - openMs) * 0.5`, skip scheduling the sibling alarm — the lead exceeds half the phase duration and the reminder is useless. This prevents alarm storms on SMOKE_TEST where some phases are shorter than the configured lead.

### Data flow end-to-end

**Public line (`EMIT_TICKER_LINE`):**
1. Module emits action from `onResolveDay`.
2. `handleEmitTickerLine` raises `Events.Fact.RECORD` with `{ type: FactTypes.GM_OBSERVATION, actorId: 'GAME_MASTER', targetId?: playerId, payload: { text, kind, observedIds, push } }`. `push` is set per-row (see catalog); not a hard-coded default.
3. `isJournalable` includes `GM_OBSERVATION` → fact persists to `GameJournal` + runs `factToTicker` + runs `handleFactPush`.
4. `factToTicker` branch returns a `TickerMessage` with `category: TickerCategories.SOCIAL_NARRATION` (new — see below) and `text: payload.text` verbatim (templates pre-rendered).
5. `broadcastTicker` pushes `Events.Ticker.UPDATE` to connected clients.
6. `handleFactPush` inspects `payload.push`; sends a push only when `true`.
7. Pulse's `ChatView.tsx` narrator filter is extended: `narratorTickers` now matches `SOCIAL_INVITE || SOCIAL_NARRATION`. `NarratorLine.tsx` gains a new `kind: 'observation'` with a neutral accent color. Bolded names matching a roster `personaName` render with inline avatars; bio descriptors render bold but avatar-less. Classic/Vivid shells render the ticker line through their existing ticker paths — no additional shell work required for Spec A.

**New ticker category:** `TickerCategories.SOCIAL_NARRATION = 'SOCIAL.NARRATION'` added to `packages/shared-types/src/events.ts`. Pulse ChatView filter extended. No other shell changes.

**Private nudge (`NUDGE_DM`):**
1. Module emits action from `onResolveDay` or `onPhaseImminent`.
2. Handler checks L3 is in `running` (INJECT_PROMPT drops outside — `DECISIONS.md:1046-1050`). If not, log + skip.
3. Handler sends `Events.Admin.INJECT_TIMELINE_EVENT { action: 'INJECT_PROMPT', payload: { text, targetId } }` into L2.
4. L2 forwards to L3. Existing handler at `l3-session.ts:368-424` creates/reuses the GM-DM channel for `(GAME_MASTER_ID, targetId)` and raises `DM_SENT` with `actorId: 'GAME_MASTER'`.
5. `DM_SENT` is already journalable, already pushes, already appears in the recipient's chat. No new plumbing.

## Social Observer module

### Observation catalog (public lines)

All thresholds live in `Config.gm.socialObserver`. Module scores each candidate observation, picks top N (default 6) per day, emits as `EMIT_TICKER_LINE` actions in `onResolveDay`.

| # | Kind | Trigger (default) | Names | DM-derived? | Push default |
|---|---|---|---|---|---|
| 1 | `DM_FANOUT` | distinct DM partners today ≥ 4 | Obscured | Yes | false |
| 2 | `DM_BURST` | total DM messages sent today ≥ 20 | Obscured | Yes | false |
| 3 | `SILVER_FANOUT` | distinct silver recipients today ≥ 3 | Named | No | false |
| 4 | `SILVER_BURST` | total silver sent today ≥ 100 | Named | No | true |
| 5 | `PERK_BURST` | perks used today ≥ 2 | Named | No | true |
| 6 | `RECONNECT_LOOP` | distinct session opens today ≥ 5 | Named | No | false |
| 7 | `ARCADE_RETRY` | same arcade attempts today ≥ 3 | Named | No | false |
| 8 | `VOTE_OUTLIER` | votes received in a voting cartridge ≥ ceil(alive/2), **evaluated after voting closes** | Named | No | true |

**`ONLINE_MARATHON` removed from v1.** Would require session duration (connect + disconnect + accumulation), not just connect counts. Revisit in a follow-up spec once presence duration tracking is modeled.

**Push-default rationale.** Ambient observations (`DM_FANOUT`, `DM_BURST`, `SILVER_FANOUT`, `RECONNECT_LOOP`, `ARCADE_RETRY`) render in the ticker but don't push; players see them when they open the app. Rare, high-signal observations (`SILVER_BURST`, `PERK_BURST`, `VOTE_OUTLIER`) push. Even worst-case with all kinds firing and hitting the daily cap, push count is bounded at ~3/day for GM observations — on top of the existing DM/vote/phase pushes. Nudges always push; they are GM-addressed DMs whose delivery vehicle is the push.

**Selection algorithm:**
1. Collect all candidates. Each gets an `intensity` score (count above threshold, normalized 0–1 per kind).
2. Apply per-kind cooldown: skip if `lastEmittedKinds[kind]` fired within last 2 days.
3. Sort by intensity descending.
4. Apply global cap: take top `maxLinesPerDay` (default 6).
5. Record `lastEmittedKinds[kind] = dayIndex` for each emitted.

**Templates.** Each kind has a bank of 4–6 template variants. Selection is seeded round-robin (`rng = seeded(gameId + kind + dayIndex)`) so playtests are reproducible.

Example banks:

```ts
DM_FANOUT: [
  ({ descriptor, count }) => `Someone's been making the rounds. ${count} different conversations — and they all know her as **${descriptor}**.`,
  ({ descriptor, count }) => `${count} DMs open at once. The one you'd know as **${descriptor}** isn't slowing down.`,
  // ...
];

SILVER_FANOUT: [
  ({ actorName, count }) => `**${actorName}** is spreading silver — ${count} different recipients today.`,
  ({ actorName, count }) => `${count} recipients and counting. **${actorName}** is generous today.`,
  // ...
];
```

**Type-level safety for DM observations:**

```ts
type DmObservationTemplate    = (d: { descriptor: string; count: number }) => string;
type NamedObservationTemplate = (d: { actorName: string; count: number }) => string;
```

DM templates cannot accept a playerId — making accidental name leaks a compile error.

### Nudge catalog (private)

Two categories:

**(a) Behavioral nudges — fire at `onResolveDay` (morning briefing).** One per player per day max.

| Kind | Condition |
|---|---|
| `SILENCE` | zero journalable facts as actor for ≥ 4h (configurable) |
| `NO_DM` | no `DM_SENT` as actor today, DMs currently open |
| `SILVER_HOARDER` | below silver median AND zero `SILVER_TRANSFER` as actor |
| `UNREAD_INVITE` | `DM_INVITE_SENT` received ≥ 3h ago without response |

**(b) Phase-imminent nudges — fire via `onPhaseImminent` hook.** Orthogonal to daily cap; idempotent per `(phaseId, playerId)`.

| Kind | Condition |
|---|---|
| `VOTE_MISSING` | voting open, player has no `VOTE_CAST` |
| `PROMPT_MISSING` | prompt/confession cartridge active, no submission |
| `DILEMMA_MISSING` | dilemma active, no choice made |
| `ACTIVITY_MISSING` | game/activity active, no `GAME_ROUND` by player |
| `GROUP_CHAT_SILENT` | group chat phase open ≥ X min, zero posts by player |

**Template examples:**

```ts
SILENCE: [
  () => `Feels empty where you are. What's happening on your end?`,
  () => `The quiet is loud. Where'd you go?`,
];
VOTE_MISSING: [
  () => `Vote closes soon. You haven't weighed in.`,
  () => `Don't sit this one out. The vote's still waiting on you.`,
];
```

**Rate-limit rules (module-level, enforced in emission):**
- Per-player daily cap: one behavioral nudge per player per day.
- Per-kind cooldown: no same nudge kind to same player for 3 days.
- Phase-imminent idempotency: `phaseNudgesFired[phaseId][playerId] = true`, cleared on `onDayEnded`.
- Phase-imminent nudges ignore the daily cap — a player can receive SILENCE in the morning and VOTE_MISSING in the afternoon.

### Bio descriptor system (`obscureDmPartner`)

Lives in `observations/helpers/obscure-dm-partner.ts`.

```ts
export function obscureDmPartner(
  playerId: string,
  roster: Record<string, SocialPlayer>,
  rng: SeededRng
): string
```

Selection order:

1. If `roster[playerId].persona.gmDescriptors` is a non-empty array of strings → pick one via `rng`. *(New optional field added to persona schema. Personas without it fall through.)*
2. Else, if `roster[playerId].qaAnswers` is non-empty → pick a random `qaEntry` via `rng`, extract a fragment from `qaEntry.answer` using the following exact pipeline:
   1. Take `answer`. Split on sentence-ending punctuation (`.!?`); keep the first sentence.
   2. Split that on commas; keep the first clause.
   3. Trim whitespace. Tokenize on whitespace.
   4. Drop leading tokens while the lowercased token is in the stop-set `{i, my, the, a, an, this, that, it, its, i'm, i've, well, so, and, but, honestly, maybe, usually, sometimes, always, never}`.
   5. If the remaining sequence is fewer than 3 tokens, fall through to step 3 (generic bank).
   6. Cap at 7 tokens. Lowercase the first remaining token (cosmetic consistency). Preserve the rest verbatim.
   7. If the first remaining token is recognized as a verb form (ends in `-ing`, `-ed`, or is in the small bank `{like, love, hate, prefer, enjoy, avoid, fear, trust}`), prepend `"the one who "`. Otherwise prepend `"the "`.
   8. Final check: if the fragment contains any roster `personaName` as a substring (case-insensitive), discard and fall through to the generic bank. Prevents a bio that references another player from leaking that player's name.
3. Else → fall back to a generic bank (`"a quiet one"`, `"someone new"`, `"one of the newer faces"`).

**Never uses `personaName`** regardless of path.

**Deterministic** on `(gameId, dayIndex, playerId)` so the same game-day references a player the same way across lines — consistency feels authored.

**Emission-time safety net.** `socialObserver` attaches `observedIds: string[]` to every `GM_OBSERVATION` fact. Before emit, if the kind is DM-derived (`DM_FANOUT`, `DM_BURST`) AND `observedIds.length > 1`, refuse to emit and log `gm-observer skip obscure-rule-violated`. Catches future template authors who might accidentally include a second id.

### Module state shape

```ts
interface SocialObserverState {
  lastNudgeAt:       Record<playerId, number>;       // epoch ms
  lastNudgeKind:     Record<playerId, NudgeKind>;
  lastEmittedKinds:  Record<ObservationKind, number>; // dayIndex
  sessionCounts:     Record<playerId, number>;        // today; reset onDayEnded
  arcadeRetries:     Record<playerId, Record<gameId, number>>; // today; reset onDayEnded
  phaseNudgesFired:  Record<phaseId, Record<playerId, true>>;  // cleared onDayEnded
}
```

All `Record<string, T>` — JSON-safe for snapshot restore. No Maps or Sets.

**Daily-scoped fields** (`sessionCounts`, `arcadeRetries`, `phaseNudgesFired`) cleared in `onDayEnded`.

**Cross-day fields** (`lastNudgeAt`, `lastNudgeKind`, `lastEmittedKinds`) persist.

### Config

New block in `packages/shared-types/src/config.ts`:

```ts
gm: {
  socialObserver: {
    enabled: true,
    thresholds: {
      dmFanoutPartners: 4,
      dmBurstMessages: 20,
      silverFanoutRecipients: 3,
      silverBurstTotal: 100,
      perkBurstCount: 2,
      reconnectLoopCount: 5,
      arcadeRetryCount: 3,
      voteOutlierFraction: 0.5,
      silenceHours: 4,
      unreadInviteHours: 3,
      groupChatSilentMinutes: 10,
    },
    caps: {
      maxLinesPerDay: 6,
      maxNudgesPerPlayerPerDay: 1,
      kindCooldownDays: 2,
      nudgeKindCooldownDays: 3,
    },
    phaseImminent: {
      leadMs: {
        SMOKE_TEST: 90_000,
        SPEED_RUN: 180_000,
        PLAYTEST: 900_000,
        PLAYTEST_SHORT: 900_000,
        COMPACT: 900_000,
        DEFAULT: 900_000,
      },
    },
  },
}
```

All magic numbers live here. Module code references `Config.gm.socialObserver.*` exclusively.

### Ruleset flag

`PeckingOrderRuleset.gm.enableSocialObserver: boolean` (default `true` for DYNAMIC manifests). Admins can disable per-game for baseline playtests. **STATIC manifests ignore the flag** — no GM actor is spawned there (spawn guard in `l2-day-resolution.ts:41`), and lifting that constraint is out of scope for Spec A.

## Guardrails enforcement

The "never name both DM partners" rule is enforced with three layers of redundancy:

1. **Type-level** — DM-kind templates accept only `(descriptor, count)` tuples. Playerid inputs are a compile error.
2. **Emission-level check** — `socialObserver` inspects `observedIds` before emit; DM-kind + >1 id refuses emit.
3. **Regression test** — e2e spec asserts neither DM partner's `personaName` appears in the ticker text of a `DM_FANOUT` observation.

## Observability

Structured logging using the existing `log(level, component, event, data?)` helper:

- `gm-observer emit { kind, actorId, targetId, dayIndex, intensity, push }`
- `gm-observer nudge { kind, playerId, reason, phaseId? }`
- `gm-observer skip { kind, reason: 'rate-limited' | 'cap' | 'obscure-violated' | 'phase-not-running' }`
- `gm-chassis load-context { durationMs, moduleCount, errored?: string[] }`

Prepped Axiom queries (documented in `docs/reports/gm-observer-dashboard.md`):

- Emissions by kind per day per game
- Nudges by kind per day per game
- Skip reasons (should-be-rare: `obscure-violated`)
- Per-player push rate — guardrail against notification fatigue

## Files

### New

- `apps/game-server/src/d1-journal-queries.ts`
- `apps/game-server/src/machines/actions/game-master-handlers.ts`
- `apps/game-server/src/machines/actions/phase-imminent.ts`
- `apps/game-server/src/machines/observations/social-observer.ts`
- `apps/game-server/src/machines/observations/helpers/obscure-dm-partner.ts`
- `apps/game-server/src/machines/observations/social-observer-templates.ts`
- `apps/game-server/src/machines/__tests__/social-observer.test.ts`
- `apps/game-server/src/machines/__tests__/obscure-dm-partner.test.ts`
- `apps/game-server/src/machines/__tests__/game-master-handlers.test.ts`
- `apps/game-server/src/__tests__/d1-journal-queries.test.ts`
- `e2e/tests/gm-observer.spec.ts`
- `docs/reports/gm-observer-dashboard.md`

### Modified

- `apps/game-server/src/machines/game-master.ts` — iterate registry, use `moduleStates`, accept `loadedContext` on `RESOLVE_DAY`, wire `onPhaseImminent`
- `apps/game-server/src/machines/observations/types.ts` — extended contract
- `apps/game-server/src/machines/observations/inactivity.ts` — declare `id: 'inactivity'`, migrate state into `moduleStates`
- `apps/game-server/src/machines/actions/l2-day-resolution.ts` — `loadObservationContext` invoke, handler-map loop in `processGameMasterActions`
- `apps/game-server/src/machines/l2-orchestrator.ts` — invoke pre-hook before `morningBriefing`; handle `PHASE_IMMINENT`
- `apps/game-server/src/machines/l3-session.ts` — schedule + cancel `phase-imminent:<phaseId>` alarms on phase entry/exit; dispatch `PHASE_IMMINENT` on alarm fire
- `apps/game-server/src/scheduling.ts` — task id scheme for phase-imminent alarms, plus a `cancelPhaseImminent(phaseId)` helper that removes the row from the `tasks` SQLite table (the public PartyWhen API is limited; use the existing `(scheduler as any).querySql(...)` pattern documented in CLAUDE.md)
- `apps/game-server/src/ticker.ts` — `GM_OBSERVATION` branch in `factToTicker`
- `apps/game-server/src/d1-persistence.ts` — add `GM_OBSERVATION` to `JOURNALABLE_TYPES`
- `apps/game-server/src/push-triggers.ts` — `GM_OBSERVATION` branch in `handleFactPush` (respects `payload.push`)
- `apps/game-server/src/demo/` — **currently does not spawn a GM actor** (verified: no `inactivity` or `GameMaster` references in `demo-machine.ts`, `demo-server.ts`, `demo-sync.ts`, `demo-seed.ts`). Spec A leaves demo behavior unchanged unless a follow-up explicitly wants demo games to showcase GM content. If that's desired, the plan should add a separate task to spawn GM in demo and seed a fact stream large enough to trip thresholds.
- `apps/game-server/src/machines/__tests__/game-master.test.ts` — extensions for registry + `moduleStates` round-trip + pre-hook failure path
- `apps/game-server/src/__tests__/journalable-facts.test.ts` — include `GM_OBSERVATION`
- `apps/game-server/src/__tests__/ticker.test.ts` — `GM_OBSERVATION` branch
- `packages/shared-types/src/events.ts` — `FactTypes.GM_OBSERVATION`; `FactTypes.PRESENCE_CONNECT` (non-journalable, internal-only — see Presence data source section); `TickerCategories.SOCIAL_NARRATION`
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — extend `narratorTickers` filter to include `SOCIAL_NARRATION`; route to `NarratorLine` with `kind='observation'`
- `apps/client/src/shells/pulse/components/chat/NarratorLine.tsx` — add `kind: 'observation'` with neutral accent color
- `packages/shared-types/src/index.ts` — `GameMasterActionTypes.EMIT_TICKER_LINE`, `NUDGE_DM`; `PeckingOrderRuleset.gm.enableSocialObserver`; `Persona.gmDescriptors?: string[]`
- `packages/shared-types/src/config.ts` — `Config.gm.socialObserver` block
- `apps/lobby/app/` — persona import path to accept optional `gmDescriptors` field (no UI changes required in v1; admin can edit via JSON)

## Migration

Additive only. No D1 schema migration.

**Snapshot compatibility shim.** Existing games have `GameMasterContext.inactivityState` as a top-level field. On first snapshot restore after deploy, detect old shape and rewrite to `moduleStates: { inactivity: <oldValue> }`. Ship the shim for one release window; remove in the following release.

**Explicit test:** `game-master.test.ts` rehydrates a hand-crafted old-shape snapshot and asserts the shim produces the new shape without data loss.

## Testing

### Unit (Vitest, mirroring `inactivity.test.ts`)

- `social-observer.test.ts`:
  - `init` returns empty state shape
  - `onFact` increments `sessionCounts` on PRESENCE_CONNECT fact (or equivalent onFact trigger — see "Presence data source" below)
  - `onFact` increments `arcadeRetries` on `GAME_ROUND` for same arcade
  - `onResolveDay` with injected `loadedContext` fixture emits `EMIT_TICKER_LINE` for each row 1–9 when thresholds met
  - `onResolveDay` emits no actions when thresholds unmet
  - `onResolveDay` respects per-kind cooldown
  - `onResolveDay` respects global `maxLinesPerDay` cap
  - Per-player daily nudge cap prevents a second nudge same day
  - Per-kind nudge cooldown prevents repeat within 3 days
  - `onDayEnded` resets daily-scoped state
  - `onPhaseImminent` emits nudges only for non-actors
  - `onPhaseImminent` idempotent — second call for same phaseId emits nothing
- `obscure-dm-partner.test.ts`:
  - Picks from `gmDescriptors` when present
  - Falls back to Q&A fragment when bank absent
  - Falls back to generic bank when Q&A absent
  - Never returns `personaName`
  - Deterministic on `(gameId, dayIndex, playerId)`
- `game-master-handlers.test.ts`:
  - `handleEliminate` keeps the pre-applied pending-elimination guard behavior
  - `handleEmitTickerLine` raises `Events.Fact.RECORD` with correct `GM_OBSERVATION` shape
  - `handleNudgeDm` dispatches `INJECT_PROMPT` when L3 `running`
  - `handleNudgeDm` logs + skips when L3 not `running`
  - Obscure-rule defensive check: DM-kind with `observedIds.length > 1` refuses to emit
- `d1-journal-queries.test.ts`:
  - Each query's SQL binds correctly against a miniflare D1 or hand-authored mock
  - Empty-day case returns empty aggregates

### Integration (game-master actor)

- `game-master.test.ts` extensions:
  - Registry iterates both modules in order
  - `moduleStates` persists through XState snapshot round-trip
  - `loadObservationContext` rejection → GM proceeds with empty context
  - Two modules emitting actions in the same day → both handled in dispatch order

### L2

- `loadObservationContext` invokes before `morningBriefing` transitions
- `processGameMasterActions` dispatches via handler map
- Phase-imminent alarm scheduled on phase open
- Phase-imminent alarm cancelled on early phase close

### E2E (Playwright)

- `gm-observer.spec.ts`:
  - SMOKE_TEST game; drive DM fanout from one player above threshold; advance to next day
  - Assert ticker shows a `DM_FANOUT` line with obscured descriptor
  - Assert neither DM partner's `personaName` appears in that ticker text
  - Open voting, one player abstains through the reminder window; assert that player receives a `VOTE_MISSING` GM DM

### Regression

- `inactivity.test.ts` unchanged; must still pass — elimination pipeline behavior invariant.
- Snapshot compat shim test (above).

## Presence data source (decision)

Session reconnect + online duration are not in `GameJournal` today. Two options considered:

- **(i) Emit non-journalable `PRESENCE_CONNECT` fact** from L1 on each connection; `socialObserver.onFact` counts. No D1 write. Lives in module state only. Daily-scoped — resets `onDayEnded`.
- **(ii) Expose read API on L1 (`getSessionCountsToday`)** called by the pre-hook.

**Selected: (i).** Lighter. No L1→L2 coupling beyond what already exists. Single-direction data flow (facts flow up, as everything else does). Stateless on DO restart is acceptable — observations are daily, and restarts are rare enough that first-day-after-restart under-counting is not a concern.

Implementation: in `server.ts` connection handler, when WS opens, push `PRESENCE_CONNECT` fact into the machine tree (not journalable). The `isJournalable` gate keeps it out of D1.

## Risks

1. **Snapshot compat shim** is easy to mis-author. Dedicated test + explicit review.
2. **Phase-imminent alarm cleanup** — if an L3 phase exits without cancelling its sibling alarm, the alarm fires into a closed phase. Handler guards by checking L3 state is `running`, but garbage accumulates in the `tasks` table. Cleanup MUST run in every phase-exit action. Include an integration test that exits a phase early and asserts the alarm row is gone.
3. **`loadObservationContext` latency** — if D1 is slow on a given day, morning briefing delays. 2s `Promise.race` cap mitigates; fallback proceeds with empty context.
4. **Notification fatigue** — `GM_OBSERVATION` pushes on by default. Dashboard monitors per-player per-day push count; if median exceeds target, tune `maxLinesPerDay` down.
5. **Template repetition feeling canned** — 4–6 variants per kind plus per-kind 2-day cooldown. If still feels repetitive after playtest, Spec B's LLM layer resolves.
6. **DYNAMIC-only constraint** — noted; Spec A ships without STATIC support. Reversible by removing the `manifest.kind !== 'DYNAMIC'` guard in a future spec if needed.

## Rollout

- Ship behind `Config.gm.socialObserver.enabled = true` for DYNAMIC. Per-game override via ruleset flag.
- Start with **conservative thresholds** (higher bars → fewer emissions) so first playtest doesn't firehose. Tune down with real data.
- Axiom dashboard live before first playtest.
- Spec B / Spec C stubs committed with TODO markers and links back here.

## Definition of done

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Playwright e2e `gm-observer.spec.ts` green
- [ ] Snapshot compat shim test passes
- [ ] DemoServer state confirmed unchanged, OR (if user wants) a separate "showcase in demo" task landed
- [ ] `docs/reports/gm-observer-dashboard.md` committed with Axiom queries
- [ ] Spec B (LLM) stub committed at `docs/superpowers/specs/2026-04-15-gm-intelligence-spec-b-llm-stub.md`
- [ ] Spec C (Confession) stub committed at `docs/superpowers/specs/2026-04-15-gm-intelligence-spec-c-confession-stub.md`
- [ ] Memory entry `project_gm_intelligence.md` written; `project_pulse_shell.md` cross-linked
- [ ] Guardrail rule in `.claude/guardrails/` documenting the "never name both DM partners" enforcement layers
