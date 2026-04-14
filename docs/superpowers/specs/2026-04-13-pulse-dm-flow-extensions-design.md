# Pulse DM Flow Extensions — Design Spec

**Status:** Draft, pending approval
**Date:** 2026-04-13
**Branch target:** `feature/pulse-shell-phase1` (lands after `pulse-dm-polish`)
**Sibling spec:** `2026-04-13-pulse-dm-polish-design.md` (DM surface polish)

## Goal

Ship the two DM flows that Phase 1.5 intentionally deferred: add-member to an existing DM/group, and 1:1 → group promotion. Server already handles `ADD_MEMBER` — this is primarily UI wiring plus one small server refinement to the channel-type invariant.

## Scope

In scope:
1. Add-member entry point in DM sheet header (creator-only button, reuses `PickingBanner` UX).
2. 1:1 → group DM promotion behavior (server flips `type` from `DM` to `GROUP_DM` when membership exceeds 2).
3. UX continuity across the promotion (same channel ID, same chat log, header flips from partner name to "Group DM").

Out of scope:
- Rename group DM.
- Leave group.
- Remove member.
- Transfer creator ownership.
- DM read receipts, push dedup, motion polish.

## Architecture

**Server: extend `addMemberToChannel` to flip channel type on promotion.** Currently, adding a 3rd member to a DM channel leaves `type: 'DM'` with 3 members — a semantic violation (clients key hero UI off `type`). Change: at the end of the assign, compute `totalMembers = channel.memberIds.length + (channel.pendingMemberIds?.length ?? 0)`. If `channel.type === 'DM' && totalMembers > 2`, set `type: 'GROUP_DM'` in the new channel. Channel ID is stable (derived from original 2-member tuple); no ID migration.

**Client: reuse the picking-mode UX.** Phase 1.5 built a full picking-mode flow for group DM creation (header compose → PickingBanner → StartPickedCta). This spec adds an "add to existing channel" variant of the same flow, triggered from the DM sheet header rather than the compose button.

**Client: one new selector, `selectCanAddMemberTo(channelId)`.** Returns true iff `channel.createdBy === playerId && channel.capabilities.includes('INVITE_MEMBER')`. Used to gate the Add button visibility.

No new events, no new facts — `Events.Social.ADD_MEMBER` and `FactTypes.DM_INVITE_SENT` already exist and fire correctly.

---

## 1. Server: channel-type promotion

`apps/game-server/src/machines/actions/l3-social.ts`, `addMemberToChannel`:

```ts
addMemberToChannel: assign(({ context, event }: any) => {
  if (event.type !== Events.Social.ADD_MEMBER) return {};
  const { senderId, channelId, memberIds: newMemberIds, message } = event;
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (!channel) return {};

  const isInviteMode = context.requireDmInvite;
  const updatedMemberIds = isInviteMode
    ? channel.memberIds
    : [...channel.memberIds, ...newMemberIds];
  const updatedPendingIds = isInviteMode
    ? [...(channel.pendingMemberIds ?? []), ...newMemberIds]
    : channel.pendingMemberIds;

  const totalMembers = updatedMemberIds.length + (updatedPendingIds?.length ?? 0);
  const shouldPromote = channel.type === 'DM' && totalMembers > 2;

  channels[channelId] = {
    ...channel,
    memberIds: updatedMemberIds,
    pendingMemberIds: updatedPendingIds,
    ...(shouldPromote ? { type: 'GROUP_DM' as const } : {}),
  };

  let chatLog = context.chatLog;
  if (message) {
    const msg = buildChatMessage(senderId, message, channelId);
    chatLog = appendToChatLog(chatLog, msg);
  }

  return { channels, chatLog };
}),
```

Preserves: channel ID, `createdBy`, `createdAt`, capabilities (DM and GROUP_DM both have `CHAT`, `SILVER_TRANSFER`, `INVITE_MEMBER`; `NUDGE` cap stays on promoted channel — see caveat below).

**NUDGE cap in promoted channel.** The polish spec establishes `NUDGE` capability as the unified source of truth for both chip visibility and server authorization (`isNudgeAllowed` checks `channelHasCapability(..., 'NUDGE')`). When a 1:1 DM promotes to GROUP_DM, strip `NUDGE` from capabilities:

```ts
const promotedCaps = shouldPromote
  ? (channel.capabilities ?? []).filter((c: ChannelCapability) => c !== 'NUDGE')
  : channel.capabilities;
```

Because the polish spec hardens `isNudgeAllowed` to check capabilities, stripping the cap now has real authorization teeth — a racing client can't fire NUDGE into a promoted channel even if it caches the pre-promotion capability list. Server becomes source of truth on next SYNC.

### Server test additions

`apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts`:
- Add one describe block: "Type promotion on ADD_MEMBER".
  - DM + ADD_MEMBER with 1 new member → type flips to GROUP_DM, NUDGE cap dropped.
  - DM + ADD_MEMBER with 2 new members (skipping 3-member intermediate) → promoted.
  - GROUP_DM + ADD_MEMBER → type stays GROUP_DM.
  - Invite-mode variant: members added to `pendingMemberIds`; promotion still fires if total > 2.

---

## 2. Client: Add-member entry point

### Entry point

`DmSheet` header (rendered by `DmHero` and `DmGroupHero`) gets an optional "+ Add" button, visible iff `selectCanAddMemberTo(channelId) === true`. Icon: `UserPlus` from `@solar-icons/react` (weight Bold per client conventions). Position: right side of header, mirrors other header affordances.

### Picking flow reuse

Tapping "+ Add" sets a new store field:

```ts
pickingMode: { kind: 'add-member', channelId: string } | { kind: 'new-dm' } | null
```

(Existing `pickingMode` was boolean; extend to discriminated union. Sibling polish spec does not touch this field — no conflict.)

When `pickingMode.kind === 'add-member'`, the existing `PickingBanner` renders with:
- Title: "Add to conversation"
- Currently-selected members from the channel shown as **locked chips** (disabled, can't be deselected).
- All other alive players shown as selectable chips.
- `StartPickedCta` label: "Add N" (where N = new picks).
- Confirm emits `Events.Social.ADD_MEMBER` with only the newly-picked IDs (not the locked ones).

Cancel returns `pickingMode` to `null` and closes the banner — sheet stays open.

### Engine

`useGameEngine` gets one method:

```ts
addMembersToChannel(channelId: string, memberIds: string[], message?: string): void
```

Wraps `ws.send({ type: Events.Social.ADD_MEMBER, channelId, memberIds, message })`. Optimistic local update: selector-driven; no manual store patch needed because SYNC will reconcile on server accept.

### Rejection handling

Server emits `Events.Rejection.CHANNEL` with reason `'UNAUTHORIZED'` if the caller isn't `createdBy`. Client maps the rejection to `toast.error('Only the creator can add members')`. Reuse existing rejection toast pipeline from Phase 1.5.

---

## 3. 1:1 → group UX continuity

When a user is in a 1:1 DM with Alice and adds Bob:

1. **Optimistic**: confirm tap fires `ADD_MEMBER`, `pickingMode` clears.
2. **Server accepts**: SYNC delivers channel with `type: 'GROUP_DM'`, `memberIds: [me, Alice, Bob]` (or Bob pending, depending on invite mode).
3. **Client re-render**: `DmSheet` detects `channel.type === 'GROUP_DM'` and swaps `DmHero` for `DmGroupHero`. No sheet close/reopen.
4. **Header label**: flips from "Alice" to a computed title (see Group DM title below).
5. **Narrator line**: a new inline italic line appears in the chat feed — "You added Bob to this chat" (inviter's view) or "Alice added you to this chat" (invitee's view). Derived from `DM_INVITE_SENT` fact with explicit `kind` disambiguation (see below). No new fact type.

### Group DM title — computed member names

`DmGroupHero` shows a comma-joined member-name string instead of literal "Group DM":

- 2-member (shouldn't occur post-promotion, but defensive): `"Alice"` (just the other person — identical to 1:1 fallback).
- 3-member: `"Alice, Bob"` (everyone except you).
- 4-member: `"Alice, Bob, Carol"`.
- 5+ members: `"Alice, Bob +3"` (first two, then overflow count).

Selector: `selectGroupDmTitle(channelId)` reads `channel.memberIds`, filters out `playerId`, resolves display names via roster (first name only for brevity), truncates to first two + overflow count. ~12 lines. Matches the mental model from any mainstream group chat app. User-set custom titles are out of scope.

### Narrator-line disambiguation

`DM_INVITE_SENT` fact fires in two contexts today: initial DM/GROUP_DM creation (from `createDmChannel` / `createGroupDmChannel`), and `ADD_MEMBER` (from `recordAddMemberFact`). The narrator needs to distinguish them to render the right line.

**Fix:** add `kind: 'initial' | 'add_member'` to the fact payload. `recordAddMemberFact` sets `kind: 'add_member'`; existing initial-invite emitters set `kind: 'initial'`. Client narrator renderer reads `kind`:

```ts
payload: {
  channelId: string;
  memberIds: string[];
  kind: 'initial' | 'add_member'; // NEW
}
```

Narrator line templates:
- `kind: 'initial'` → "You started a chat with Alice" / "Alice invited you to a chat"
- `kind: 'add_member'` → "You added Bob to this chat" / "Alice added you to this chat"

Migration: no persisted facts to rewrite (facts are in-memory per-game, recomputed on game replay). Old code paths absent the field get the default `'initial'` at render time (`kind ?? 'initial'`).

### Pending-member state

In invite mode (`requireDmInvite === true`), Bob appears in `pendingMemberIds`. For other members of the channel (including the inviter), `DmGroupHero` shows Bob's avatar at reduced opacity with a "Pending" pill. Reuses the existing `DmPendingState` visual vocabulary — verify during implementation that `DmGroupHero` accepts a pending-members slot; if not, add one.

For Bob himself, the channel appears in his `selectPendingInvitesForMe` output — existing Phase 1.5 invite-accept flow handles his side with no changes.

---

## Selectors (additions)

```ts
selectCanAddMemberTo(channelId: string): boolean
selectAvailableAddTargets(channelId: string): string[] // alive players not already in channel
```

## Store fields (changes)

```ts
// Before (Phase 1.5)
pickingMode: boolean;

// After (this spec)
pickingMode:
  | null
  | { kind: 'new-dm' }
  | { kind: 'add-member'; channelId: string };
```

Migration: existing boolean-`true` callsites map to `{ kind: 'new-dm' }`, `false` to `null`. Update `selectPickingMode` and all consumers in one pass.

**Pre-change audit step:** before the shape change, grep the entire repo for `pickingMode` and list every callsite. Shape-migration commit touches all of them atomically. Expected locations (based on Phase 1.5): `useGameStore.ts` (definition + actions), `selectors.ts` (selectPickingMode), `PulseHeader` / `ComposeButton`, `PickingBanner`, `StartPickedCta`, `PulseShell` (routing). ~5–8 sites. If the grep reveals more, pause and assess before proceeding.

## Engine methods (additions)

```ts
addMembersToChannel(channelId: string, memberIds: string[], message?: string): void
```

## Risks

- **Creator-only rule surprises users.** Players may expect any group member to invite. Documenting in narrator lines (no client-side onboarding text). Revisit if playtest shows confusion.
- **NUDGE cap stripping on promotion**: if a player had an in-flight `/nudge` chip tap when promotion lands, the send should still succeed server-side (guard is on `isNudgeAllowed`, not `NUDGE` cap). Capability is a chip-visibility concern, not an authorization concern. Verify during implementation.
- **`pickingMode` shape migration** touches Phase 1.5 callsites. Grep the codebase; ~5 callsites expected. Single atomic commit.
- **Race between ADD_MEMBER and a cartridge starting in the channel**: impossible because cartridges run in MAIN-like contexts only; DM channels never host cartridges.

## Testing

- **Server unit** (Vitest): new "Type promotion on ADD_MEMBER" describe block — see §1.
- **Client unit**:
  - `selectCanAddMemberTo` — creator / non-creator / missing capability cases.
  - `pickingMode` migration — all callsites produce the new shape.
- **E2E** — deferred; playtest covers the two-user add-member flow end-to-end.

## Sequencing

Lands after `pulse-dm-polish` on the same branch. The polish spec introduces the `NUDGE` capability; this spec depends on that cap already existing in the union (for the strip-on-promotion logic). Implementation order:

1. Polish spec: Plan A
2. Polish spec: implement + build + commit
3. Flow extensions spec: Plan B
4. Flow extensions spec: implement + build + commit
5. Consolidated multi-player playtest of both specs (Task 9 from Phase 1.5 — still outstanding).
6. If playtest green: merge `feature/pulse-shell-phase1` → `main`.
