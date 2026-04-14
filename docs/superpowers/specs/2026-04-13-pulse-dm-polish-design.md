# Pulse DM Polish — Design Spec

**Status:** Draft, pending approval
**Date:** 2026-04-13
**Branch target:** `feature/pulse-shell-phase1` (continuation after Phase 1.5)
**Sibling spec:** `2026-04-13-pulse-dm-flow-extensions-design.md` (new DM flow UI)

## Goal

Close four small UX gaps and one infrastructure wiring task left open by Phase 1.5, all living in the existing DM sheet and Cast Strip surfaces. Ship as one focused session; implementation ~1 day.

## Scope

In scope:
1. `/silver`, `/nudge`, `/dm`, `/whisper`, `@mention` hint chips become capability-driven; wired into `DmInput`.
2. Out-of-DM-slots feedback: chip shake + toast on tap.
3. `@mention` tap → `openDM`.
4. `DmHero` image variant 404 fallback.
5. Status ring + typing indicator in DM sheet header.

Out of scope (either deferred, or covered by the sibling spec):
- Add-member-to-DM, 1:1 → group promotion — sibling spec.
- Push / toast dedup when sheet foregrounded — bug-class, fix when push ships.
- Narrator threshold validation — needs playtest data.
- Motion polish (elimination anims, silver economy particles) — separate "Pulse motion pass" spec after playtest.
- Rename / leave group, remove member, transfer ownership.

## Architecture

**Capabilities as the primary contract, with one deliberate exception.** `ChannelCapability` represents "what you can do in this channel" — unified UI affordance surfacing + server-side authorization for channel-scoped actions. Designed to absorb future game channels cleanly (new channel type → new caps → chips appear without UI code changes).

Server-side additions:
1. Extend `ChannelCapability` union with `'NUDGE'` and `'WHISPER'`.
2. MAIN channel gets `['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER']`.
3. DM channel gets `['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']`.
4. GROUP_DM, GAME_DM unchanged.
5. Harden `isWhisperAllowed` to check `channelHasCapability(context.channels, 'MAIN', 'WHISPER')`. Whisper is always MAIN-scoped; this adds a consistency check (drop MAIN's WHISPER cap → whispers stop working) without requiring the event to carry `channelId`.

**NUDGE is player-scoped, not channel-scoped (deliberate exception).** `Events.Social.NUDGE` carries `{ senderId, targetId }` with no channel field. Nudges can be initiated from many surfaces (chat chip, DM chip, Cast Strip avatar tap, avatar popover in legacy shells) — channel-scoping would over-constrain the surface area. The `NUDGE` capability is therefore a **UI affordance flag only**: client chip visibility reads it, but `isNudgeAllowed` stays player-scoped (alive + rate-limit). Documented here so future devs don't assume cap = auth universally.

Client-side: one rule for all chips — capability-gated for action chips, channel-type-gated for navigational/keyboard chips. No parallel visibility tables.

**Accepted consequence:** server now authorizes `SEND_SILVER` with `channel: 'MAIN'`. No code path emits that today. Client discipline: `/silver` picker always resolves to a DM channel before firing. Enforced via test (see §1).

---

## 1. Capability-aware hint chips

### Server changes

**1. Capability union.** `packages/shared-types/src/index.ts`:

```ts
export type ChannelCapability =
  | 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS'
  | 'NUDGE'     // NEW — MAIN + 1:1 DM
  | 'WHISPER';  // NEW — MAIN only
```

**2. MAIN channel creation.** `apps/game-server/src/machines/l3-session.ts` — the MAIN initializer at line ~112:

```ts
capabilities: ['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER'] as const,
```

**3. DM channel creation.** `apps/game-server/src/machines/actions/l3-social.ts`, both branches of `createDmChannel`:

```ts
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE'],
```

`createGroupDmChannel` unchanged: `['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER']` — no NUDGE (1:1 semantics), no WHISPER.

**4. Harden whisper guard.** `isWhisperAllowed` currently checks sender/target alive and non-empty text; it does not consult the capability list. Add a cap check against MAIN (whispers are always MAIN-scoped — the event carries no channelId, and `processWhisper` hard-codes `'MAIN'` when building the message):

```ts
isWhisperAllowed: ({ context, event }: any) => {
  if (event.type !== Events.Social.WHISPER) return false;
  // Consistency check: if MAIN loses WHISPER capability, whispers are disabled.
  if (!channelHasCapability(context.channels, 'MAIN', 'WHISPER')) return false;
  // ...existing senderId/targetId/text checks unchanged
},
```

`isNudgeAllowed` is **not** modified — NUDGE is deliberately player-scoped per the Architecture note. NUDGE capability exists purely as a UI affordance.

**5. Test coverage (required before merge).**
- Channel creation tests: assert MAIN created with `NUDGE` + `WHISPER` caps; DM created with `NUDGE` cap.
- New test: drop MAIN's `WHISPER` cap mid-game (via test harness mutation) → `WHISPER` event rejected.
- Client test (`apps/client`): `/silver` picker flow from MAIN never emits `SEND_SILVER` with `channel: 'MAIN'` — always routes through a DM channelId.

### Client change

`HintChips.tsx` gains an optional props interface:

```ts
interface HintChipsProps {
  onSelect: (command: Command) => void;
  channelType: ChannelType;
  capabilities?: ChannelCapability[];
}
```

**Unified visibility rule.** Every chip resolves against one of two predicates:

| Chip | Kind | Rule |
|---|---|---|
| `/silver` | action | `capabilities.includes('SILVER_TRANSFER')` |
| `/nudge` | action | `capabilities.includes('NUDGE')` |
| `/whisper` | action | `capabilities.includes('WHISPER')` |
| `/dm` | navigational | `channelType === 'MAIN'` |
| `@mention` | keyboard | `channelType === 'GROUP_DM'` |

Resulting visibility per channel type (from the caps set in the Server Changes above):

| Channel | Visible chips |
|---|---|
| MAIN | `/silver`, `/nudge`, `/whisper`, `/dm` |
| DM (1:1) | `/silver`, `/nudge` |
| GROUP_DM | `/silver`, `@mention` |
| GAME_DM | (none unless game cartridge emits caps) |

Order stays fixed (`silver, nudge, dm, whisper, mention`); skipped chips don't render. When no chips pass, render nothing (not an empty row). Navigational/keyboard rules are channel-type-based because they're about *where you are*, not *what you can do* — they never map to authorization flags server-side.

### `DmInput` integration

`DmInput.tsx` currently renders a plain `<input>`. Wrap in a flex column with `HintChips` above the input, keyed off `channelType` and `capabilities` from the active channel (looked up via `useGameStore(s => s.channels[channelId])`). Chip tap behavior:

- **`/silver`**: open silver-send picker with recipient pre-filled (1:1 DM → partner; group → show member picker).
- **`/nudge`**: send nudge to partner immediately (1:1 only per NUDGE cap). Toast confirmation.
- **`@mention`** (group only): insert `@` at caret in the input, focus caret after.
- **`/dm`**: not applicable inside DM sheet (hidden by filter).
- **`/whisper`**: not applicable inside DM sheet (hidden by filter).

Existing `useCommandBuilder` hook handles silver-picker and nudge flows — reuse unchanged.

---

## 2. Out-of-slots shake + toast

Selector `selectDmSlotsRemaining` already exists. Add a derived selector:

```ts
selectChipSlotStatus(chipPlayerId: string): 'ok' | 'blocked'
```

Returns `'blocked'` when all of: remaining === 0, no existing channel with chipPlayerId, and chipPlayerId is alive. Otherwise `'ok'`.

`CastChip` consults the selector on tap. If `'blocked'`:
1. Apply `shake` animation (CSS keyframes, 300ms, `translateX` ±4px, three beats).
2. Fire `toast.error('Out of DM slots for today')` via `sonner` (already in dependency tree per client `CLAUDE.md`).
3. Do not call `openDM`.

Shake keyframes defined once in `shells/pulse/components/caststrip/CastChip.tsx` or a shared CSS file. No new store state.

Tapping a chip for a player you already have a DM with never blocks (reopens existing sheet — no slot consumption).

---

## 3. `@mention` tap → `openDM`

`MentionRenderer.tsx` already resolves `playerId` deterministically at parse time — it matches against full `personaName`, not just first name, and stores `part.playerId` alongside `part.value` during parse. The only missing piece is a tap handler on the rendered mention span.

Change: convert the styled `<span>` wrapping mention parts into a `<button>`:

```tsx
<button
  key={idx}
  onClick={() => openDM(part.playerId!)}
  style={{
    appearance: 'none',
    background: 'none',
    border: 'none',
    padding: 0,
    color: getPlayerColor(playerIndex),
    fontWeight: 700,
    cursor: 'pointer',
    font: 'inherit',
  }}
>
  {part.value}
</button>
```

Parent gets `openDM` from `usePulse()` context.

Edge cases:
- Mentioned player eliminated → open the DM anyway (unread history still valuable). Server guard rejects sends to eliminated players; UI surfaces the rejection via existing toast pipeline.
- No matching roster entry (parse found `@` but no name match) → already falls through to the non-mention text branch; button is never rendered for that case.

---

## 4. `DmHero` variant 404 fallback

`resolvePersonaVariant` points at `medium.png` / `full.png`. Extract a `PersonaImage` wrapper component:

```tsx
<PersonaImage
  personaId={id}
  preferredVariant="medium"
  fallbackChain={['headshot', 'initials']}
/>
```

Internally tracks the current variant via `useState`; `onError` advances to the next in `fallbackChain`. Last fallback (`'initials'`) renders a colored tile with persona initials and the player color. Used in `DmHero` and `DmGroupHero` both.

**Known-good variant cache.** To avoid re-flicker on second mount, keep a module-level `Map<personaId, variant>` of the first successful variant observed. New mounts initialize from the cache if present; first-load players still pay the one-shot 404 cost. Cleared only on page reload (no explicit invalidation).

```ts
const knownGoodVariant = new Map<string, string>();
// on successful load: knownGoodVariant.set(personaId, variant)
// on mount: const initial = knownGoodVariant.get(personaId) ?? preferredVariant
```

---

## 5. Status ring + typing indicator in DM sheet header

### Status ring (1:1 DM only)

New component `DmStatusRing.tsx` wraps the partner avatar in `DmHero`. Three states:

| State | Condition | Visual |
|-------|-----------|--------|
| `online` | `connectedPlayers.has(partnerId)` | solid ring in player color, full opacity |
| `typing` | `typingPlayers[partnerId] === channelId` | ring pulses at 1Hz, slightly thicker |
| `idle` | neither | ring at 30% opacity |

Single source of truth: `useGameStore(s => s.connectedPlayers)` + `useGameStore(s => s.typingPlayers)`. No debouncing in v1 — user accepted flicker as truthful signal (decision logged 2026-04-13).

Group DM hero does **not** show a ring (too visually noisy with 3+ avatars).

### Typing indicator

Generalize existing `TypingIndicator.tsx`:

```ts
interface TypingIndicatorProps {
  channelId: string; // 'MAIN' or a DM/group channel id
}
```

Filter logic changes from hardcoded `channel === 'MAIN'` to `channel === channelId`. Mount inside `DmSheet` above `DmInput` to mirror main-chat placement.

For group DM: indicator aggregates multiple typers ("Alice, Bob typing", or "3 typing"). Existing implementation already handles multi-typer formatting; only the filter changes.

---

## Selectors (additions)

```ts
selectChannelById(channelId: string): Channel | undefined
selectChipSlotStatus(chipPlayerId: string): 'ok' | 'blocked'
selectIsOnline(playerId: string): boolean
selectIsTypingInChannel(playerId: string, channelId: string): boolean
```

All memoized via `useShallow` where they return arrays/objects.

## Engine methods (additions)

None. Nudge / silver-send / mention-insert all route through existing engine methods (`nudge`, `sendSilver`, local state).

## Out of Phase 2.1 scope

- Group DM rename / leave / remove-member (not in backlog).
- DM read receipts.
- Custom chip ordering per player preference.
- Typing debounce / smoothing.

## Testing

- **Unit** (Vitest, `apps/client`):
  - `HintChips` visibility matrix — five channel-type × capability combinations.
  - `selectChipSlotStatus` — covers `ok`, `blocked`, existing-channel re-open cases.
  - `PersonaImage` fallback chain — mock `onError` for each variant.
  - `TypingIndicator` with non-MAIN `channelId`.
- **Server** (Vitest, `apps/game-server`): verify `createDmChannel` emits the new `NUDGE` cap; existing channel creation tests extend with one assertion each.
- **E2E** (Playwright) — deferred; covered in `finishing-a-development-branch` playtest.

## Risks

- **Capability union widening.** Adding `'NUDGE'` and `'WHISPER'` forces type refreshes across the monorepo; `npm run build` in each app pre-commit catches this. Exhaustive switch statements on `ChannelCapability` (if any) will error — grep `ChannelCapability` before building.
- **Silver-in-MAIN authorization.** Server now permits `SEND_SILVER` with `channel: 'MAIN'`. Accepted consequence of the unified model. Client test asserts the `/silver` picker never emits that event shape; if product ever wants silver-in-MAIN intentionally, no code change needed, just enable the flow client-side.
- **Pre-existing channels lose NUDGE affordance.** Channels created before this change lack the new caps. Pre-launch this is a non-issue (no prod traffic). If a staging game is mid-flight during rollout, those DMs silently lose the `/nudge` chip until a new DM is created. Document in the plan's rollout checklist.
- **Shake animation on `CastChip` may interact with layout.** Chip is `flex-shrink:0` in Cast Strip; `translateX` stays within bounds. Verify on dev server with real data before commit.
- **Flicker on status ring.** Accepted; revisit after playtest.
