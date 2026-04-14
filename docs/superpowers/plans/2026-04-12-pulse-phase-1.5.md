# Pulse Shell Phase 1.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **User preference on record: no subagents for implementation on this branch — user prefers to drive code changes directly in the main session.** So the "subagent-driven" path is disabled here; executor should use inline execution with user-approved milestones.

**Goal:** Close the Pulse Phase 1 DM gaps by replacing tabs/presence-bar/ticker with a Cast Strip (priority-sorted persona chips) + Unified DM sheet + Social panel, driven by client-only store/selector additions. No required server changes.

**Architecture:** Single primary surface (chat) + two overlay sheets (DM sheet, Social panel). Cast Strip is the people surface replacing HERE presence bar. Social panel (opened via ☰ header button) hosts Standings + Conversations + Pending Invites. Compose (✎ header button) drives a unified picking-mode flow for 1:1 and group DM creation. Ticker is deleted; its social content moves to inline italic "narrator lines" in the chat feed. One interaction rule: tap any persona anywhere → open that DM.

**Tech Stack:** React 19 + TypeScript, Zustand (`useGameStore`), partysocket (`useGameEngine`), Framer Motion (AnimatePresence + transitions), @solar-icons/react and Phosphor Fill icons, inline styles keyed off `--pulse-*` CSS variables. No Tailwind in this shell.

**Authoritative spec:** `docs/superpowers/specs/2026-04-12-pulse-dm-cast-strip-design.md`
**Interactive prototype (pixel-level visual source of truth):** `docs/reports/pulse-mockups/11-cast-strip-v2.html` — serve via `cd docs/reports/pulse-mockups && python3 -m http.server 8765` and open http://localhost:8765/11-cast-strip-v2.html before each UI task; replicate values (paddings, borders, colors) directly.

**Out of scope (deferred — do NOT implement):** Cartridge full-screen overlay grammar, 1:1→group promotion UI, add-member-to-DM flow, group rename/leave, Phase 2 relationship hints, Phase 3 GM Intelligence, Phase 4 catch-up/deep-linking, light-theme validation, swipe-right reply gesture, motion polish (parallax, vignettes, particles).

---

## Pre-Task-1 Amendments (from 2026-04-13 review)

Four amendments and one open decision must be addressed before starting Task 1.

### Amendment 1: Namespace localStorage by (gameId, playerId)

`po-pulse-lastRead` as a single key would collide across games — playing game B with the same channelIds as game A would inherit A's read timestamps. Fix: key as `po-pulse-lastRead:${gameId}:${playerId}`. Because gameId/playerId aren't known at store-create time, switch to a `hydrateLastRead(gameId, playerId)` action called from `PulseShell` after both are populated. See updated Task 1.2 / 1.3.

### Amendment 2: Memoize the Cast Strip selector

`selectCastStripEntries` builds a fresh array on every call. Without referential stability, every store update re-renders the strip. Fix: wrap consumer access with `useShallow` from `zustand/react/shallow` so identical chip lists short-circuit the re-render. Applied in Task 3.3 (CastStrip).

### Amendment 3: Move deleted Phase 1 files to `_legacy/` until Task 9 green

Don't `rm` the files in Task 8 — move them under `apps/client/src/shells/pulse/_legacy/` (gitignored not, just unimported). Delete only after Task 9 playtest passes and the user explicitly approves. Cheap safety net if a regression surfaces. Applied in Task 8.

### Amendment 4: Drop the `pendingDmInvitesLocal` field reference

The original File Structure mentioned a `pendingDmInvitesLocal` field that's not implemented in Task 1. Removed — invites are derived live via `selectPendingInvitesForMe`, no shadow field needed.

### Open Decision: chat-avatar tap behavior

**Tension:** Spec §7 says "tap a persona anywhere → opens their DM," including chat message avatars. Phase 1 ships an `AvatarPopover` (Silver / DM / Nudge) bound to chat avatars. Two visual affordances of the same shape (a portrait) doing different things will confuse users.

**Option A (spec-honoring, default):** Retire `AvatarPopover` for chat avatars. Tap → opens DM. Silver/Nudge available exclusively via `/silver` and `/nudge` slash commands (already implemented). Net: -1 component, +1 consistency, slight muscle-memory shift for existing playtesters.

**Option B (preserve popover):** Cast Strip chips also show popover with DM as the primary action. Cost: extra friction on the central interaction; spec §7 violated; popover-tap-on-chip jars on small chips.

**Recommendation:** Option A. Implementation lives in Task 4 (when DmSheet wiring lands). Flagged for your sign-off before Task 4.

### Phase 2 Backlog (file as separate spec/plan)

Surfaced by the review — out of Phase 1.5 scope but real needs:
- Add-member-to-existing-DM (§3c of original DM addendum)
- 1:1 → group promotion (server already supports this; client UI missing)
- Push notification / in-app toast dedup when sheet is foregrounded
- Status ring + typing indicator in DM sheet header (cheap; consider promoting if Task 4 has slack)
- Narrator-line threshold validation (current: 2 = scheming, 4+ = alliance, coral/purple/gold) — observe real games before locking in

**User workflow constraints:**
- Ask before merging or pushing. Never push/merge without explicit approval.
- Always run `npm run build` in `apps/client` (and any touched app) before committing. Fix all type errors.
- Verify dev-server working directory before each manual test — `lsof -i :5173 :8787 | grep LISTEN` → `lsof -p <pid> | grep cwd`. Must match this branch's worktree. Restart from the correct directory if wrong.
- Clear `po_pwa_*` and `po_token_*` cookies/localStorage before first nav in each fresh test session to avoid reconnect loops.
- Commit style matches the current branch: imperative mood, scoped `feat(pulse):` / `refactor(pulse):` / `chore(pulse):` prefixes, include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.
- At the end of each milestone (each numbered top-level task below), STOP and ask the user to run the multi-player playtest before moving on. User prefers focused single-issue sessions.

---

## File Structure

### Create (apps/client/src/shells/pulse/components/)

```
caststrip/
  CastStrip.tsx            Priority-sorted horizontal strip. Renders self chip first, then ordered persona + group chips. Owns scroll-snap, picking-mode banner anchor.
  CastChip.tsx             Individual 72×100 persona chip. Renders state vocabulary (online/unread/typing/pending/leader/self/offline) via edges, glows, badges. Tap → open DM.
  GroupChip.tsx            72×100 group chip with two overlapping mini-portraits + "GROUP" micro-label. Tap → open group DM.
  PickingBanner.tsx        Coral banner shown above the strip in picking mode. Shows "Pick 1 to chat · 2+ for a group (N slots left)" + Cancel chip.
  StartPickedCta.tsx       Floating bottom-center CTA: "Start chat with {Name}" / "Start group with N". Triggers create flow on tap.

dm-sheet/
  DmSheet.tsx              Full-height overlay sheet (top:40, scrim behind). Slide-in from right. Owns close handler + dismiss-on-scrim-tap. Routes between DmHero/DmGroupHero/DmPendingState/DmWaitingBanner/DmEmptyState.
  DmHero.tsx               1:1 persona hero block: 280px image + gallery dots (headshot/medium/full) + bottom meta (name, stereotype, tags, leader crown). Non-scrolling header block.
  DmGroupHero.tsx          Group variant: horizontal-collage of member portraits, group name + "N members" + member color pills.
  DmBioQuote.tsx           Italic pull-quote block with coral quote mark + "{Name} · Pre-game interview" subline. Omitted if no bio.
  DmEmptyState.tsx         Centered italic "Break the ice" copy between privacy line and input.
  DmPendingState.tsx       Recipient view: blurred message preview card + Accept (coral full-width) / Decline (muted inline) buttons.
  DmWaitingBanner.tsx      Sender view: "Waiting for {Name} to accept…" banner + Cancel invite link above disabled input.
  DmMessages.tsx           Scrolling message list inside the sheet. Renders chat log for the channel. Triggers markChannelRead on mount + on incoming msg while visible.
  DmInput.tsx              Input + /silver /nudge /whisper hint chips inside the sheet. Placeholder "Message {Name}…". Supports DM-slash-context (target defaults to partner).

social-panel/
  SocialPanel.tsx          Full-height sheet opened via ☰. Drag handle + standings hero + pending-invites section + conversations list. Scrim dismiss.
  Podium.tsx               #2/#1/#3 flex layout, order:1/2/3. #1 larger (flex:2, 140px img, crown medallion, gold halo). Tap → open DM.
  StandingsRest.tsx        Ranks 4+ compact rows. Current player row coral-tinted. Tap row → open DM.
  ConversationsList.tsx    Rows for 1:1 + group DM threads. Portrait(s) + name + preview + timestamp + unread pip. Sort by last-message desc. Tap → open DM.
  InviteRow.tsx            Pending invite row: portrait + "{Name} wants to DM you" + stereotype + Accept (green) / Decline (muted) buttons.

header/
  ComposeButton.tsx        Header ✎ button. 34×34. Pencil icon + slot-counter pip (e.g. 2/3). Tap → enter picking mode. Muted class when slots depleted.
  PanelButton.tsx          Header ☰ button. 34×34. Three-line icon + unread-count pip (coral). Tap → open Social panel.
  PulseHeader.tsx           Header row: [Day N · time] + ComposeButton + PanelButton.

chat/
  NarratorLine.tsx         Inline italic 11px centered system line. Color variants: coral (talking), purple (scheming), gold (alliance). Renders within ChatView message list.
```

### Modify

```
apps/client/src/shells/pulse/PulseShell.tsx
  - Remove TabBar, remove activeTab state
  - Replace <Ticker /> + <PulseBar /> header with <PulseHeader /> + <CastStrip /> + <PulseBar />
  - Remove old DMView + GroupDMView open/close pattern, replace with <DmSheet> driven by openDM / dmTarget
  - Add SocialPanel open state + <SocialPanel />
  - Add pickingMode state (from store, not local) + picking banner + picking CTA wiring
  - Keep AvatarPopover / SendSilverSheet / NudgeConfirmation for now (avatar popover still triggers them from main-chat message taps)
  - Remove {activeTab === 'chat' ? <ChatView /> : <CastGrid />} — always render ChatView

apps/client/src/shells/pulse/components/PulseBar.tsx
  - DELETE lines 22-188 (HERE presence fallback block and the `if (pills.length === 0)` branch that renders it)
  - When pills.length === 0, return null — Cast Strip owns presence now

apps/client/src/shells/pulse/components/Ticker.tsx
  - DELETE FILE ENTIRELY

apps/client/src/shells/pulse/components/chat/ChatView.tsx
  - Add support for rendering NarratorLine inline in the message list
  - Interleave narrator lines with chat messages by timestamp
  - Source narrator lines from a new store selector (selectNarratorLines) derived from facts

apps/client/src/shells/pulse/components/dm/DMView.tsx
  - Can be deleted after DmSheet replaces it (confirm no external refs first)
  - Same for GroupDMView.tsx

apps/client/src/store/useGameStore.ts
  - Add GameState fields: lastReadTimestamp, pickingMode
  - Add actions: markChannelRead, hydrateLastRead, startPicking, cancelPicking, togglePicked
  - Add selectors (exported top-level): selectUnreadForChannel, selectTotalDmUnread, selectCastStripEntries, selectIsLeader, selectStandings, selectPendingInvitesForMe, selectOutgoingInvites, selectDmSlotsRemaining
  - Persist lastReadTimestamp to localStorage under key `po-pulse-lastRead:${gameId}:${playerId}` (namespaced — amendment 1)

apps/client/src/hooks/useGameEngine.ts
  - Add acceptDm(channelId) → sends Events.Social.ACCEPT_DM { channelId }
  - Add declineDm(channelId) → sends Events.Social.DECLINE_DM { channelId }
  - Export both from the hook return

apps/client/src/shells/pulse/components/input/PulseInput.tsx
  - No structural changes; keep slash command system as-is for main chat
  - Ensure when DmSheet is open, the main PulseInput is occluded (DM sheet has its own input)
```

### Delete

- `apps/client/src/shells/pulse/components/Ticker.tsx` (entire file)
- Ticker-related CSS (if any — grep `ticker` inside `pulse-theme.css`)
- Lines 22-188 of `apps/client/src/shells/pulse/components/PulseBar.tsx` (HERE presence block)
- `apps/client/src/shells/pulse/components/dm/DMView.tsx` and `GroupDMView.tsx` once `DmSheet` fully subsumes them (deferred to the last cleanup task — confirm no refs first)

### No server changes required

The server is ready:
- `Events.Social.ACCEPT_DM` and `Events.Social.DECLINE_DM` already exist in `packages/shared-types/src/events.ts:30-31`.
- `dmStats.slotsUsed` already flows through SYNC.
- `Channel.pendingMemberIds` already populated for invite flow.
- `selectPendingChannels` and `selectSentInviteChannels` already exist in `useGameStore.ts:168-182`.

Optional future addition (deferred — do NOT implement unless user requests): `GROUP_CHANNEL_CREATED` fact for richer narrator lines. Phase 1.5 narrator lines will key off existing `DM_INVITE_ACCEPTED` and `CREATE_CHANNEL`-derived channels.

---

## Task Ordering

The user's requested order, with each milestone independently browser-verifiable:

1. **Task 1** — Store + selectors (client-only "server-side-equivalent" groundwork)
2. **Task 2** — Engine wiring for acceptDm / declineDm
3. **Task 3** — Cast Strip (replace HERE block; static sort, tap = open placeholder modal)
4. **Task 4** — Unified DM sheet (hero + messages + input, wired to Cast Strip taps)
5. **Task 5** — Social panel (standings + conversations + invites)
6. **Task 6** — Compose button + picking mode (unified 1-vs-2+ create flow)
7. **Task 7** — Narrator lines inline + ticker deletion + PulseBar presence block deletion
8. **Task 8** — Shell rewiring cleanup + DMView/GroupDMView removal
9. **Task 9** — Multi-player integration test pass + regression check

**Stop and ask before moving from one top-level Task to the next.** Each Task ends with a multi-player browser playtest.

---

## Task 1: Store & Selectors

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`

**Why first:** Every downstream UI component reads from these selectors. Landing this cleanly first keeps later tasks focused on rendering, not plumbing.

- [ ] **Step 1.1: Add new GameState fields and actions to the interface**

In `apps/client/src/store/useGameStore.ts` around line 34-103 (interface `GameState`), add these fields just above the `// Actions` comment:

```typescript
  // Pulse Phase 1.5 additions
  lastReadTimestamp: Record<string, number>;       // channelId → ts of last-seen message
  pickingMode: {
    active: boolean;
    selected: string[];                             // playerIds
  };
```

And these actions just below the existing actions block:

```typescript
  markChannelRead: (channelId: string) => void;
  startPicking: () => void;
  cancelPicking: () => void;
  togglePicked: (playerId: string) => void;
```

- [ ] **Step 1.2: Initialize the new state inside the store `create` body**

In the `create<GameState>((set) => ({ ... }))` block (around line 345+), add the initial values alongside existing ones (after `lastSeenFeedTimestamp`). Start empty — hydrated on mount once gameId/playerId are known (see Step 1.3 hydrateLastRead):

```typescript
  lastReadTimestamp: {},
  pickingMode: { active: false, selected: [] },
```

- [ ] **Step 1.3: Add the new action implementations**

Still inside the `create` body, add these implementations near the other actions. `markChannelRead` and `hydrateLastRead` both namespace the localStorage key by `${gameId}:${playerId}` (amendment 1 — prevents cross-game collision):

```typescript
  hydrateLastRead: (gameId, playerId) => set(() => {
    try {
      const raw = localStorage.getItem(`po-pulse-lastRead:${gameId}:${playerId}`);
      return { lastReadTimestamp: raw ? JSON.parse(raw) : {} };
    } catch { return { lastReadTimestamp: {} }; }
  }),
  markChannelRead: (channelId) => set((state) => {
    const next = { ...state.lastReadTimestamp, [channelId]: Date.now() };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-pulse-lastRead:${state.gameId}:${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { lastReadTimestamp: next };
  }),
  startPicking: () => set({ pickingMode: { active: true, selected: [] } }),
  cancelPicking: () => set({ pickingMode: { active: false, selected: [] } }),
  togglePicked: (playerId) => set((state) => {
    const sel = state.pickingMode.selected;
    const next = sel.includes(playerId) ? sel.filter(id => id !== playerId) : [...sel, playerId];
    return { pickingMode: { active: true, selected: next } };
  }),
```

Also add the new action types to the `GameState` interface's actions block:

```typescript
  hydrateLastRead: (gameId: string, playerId: string) => void;
```

- [ ] **Step 1.4: Add the selectors**

Append these exported selectors near the other top-level `selectXxx` exports (below `selectShouldAutoOpenDashboard` around line 343):

```typescript
// ------- Pulse Phase 1.5 selectors -------

export interface CastStripEntry {
  kind: 'self' | 'player' | 'group';
  id: string;                               // playerId for self/player, channelId for group
  player?: SocialPlayer;
  memberIds?: string[];
  priority: number;                         // 0=self, 1=pending, 2=unread, 3=typing, 4=silver-fresh, 5=online, 6=idle-group, 7=offline
  unreadCount: number;
  hasPendingInviteFromThem: boolean;        // they invited you
  hasOutgoingPendingInvite: boolean;        // you invited them, not yet accepted
  isTypingToYou: boolean;
  isOnline: boolean;
  isLeader: boolean;
}

export const selectUnreadForChannel = (channelId: string) => (state: GameState): number => {
  const last = state.lastReadTimestamp[channelId] ?? 0;
  return state.chatLog.filter(m => m.channelId === channelId && m.timestamp > last && m.playerId !== state.playerId).length;
};

export const selectTotalDmUnread = (state: GameState): number => {
  const pid = state.playerId;
  if (!pid) return 0;
  const dmChannelIds = Object.values(state.channels)
    .filter(ch => (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) && ch.memberIds.includes(pid))
    .map(ch => ch.id);
  return dmChannelIds.reduce((sum, cid) => {
    const last = state.lastReadTimestamp[cid] ?? 0;
    return sum + state.chatLog.filter(m => m.channelId === cid && m.timestamp > last && m.playerId !== pid).length;
  }, 0);
};

export const selectStandings = (state: GameState): { id: string; player: SocialPlayer; rank: number }[] => {
  return Object.entries(state.roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .sort((a, b) => b[1].silver - a[1].silver || a[1].personaName.localeCompare(b[1].personaName))
    .map(([id, p], i) => ({ id, player: p, rank: i + 1 }));
};

export const selectIsLeader = (playerId: string) => (state: GameState): boolean => {
  const standings = selectStandings(state);
  return standings.length > 0 && standings[0].id === playerId;
};

export const selectPendingInvitesForMe = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(ch => (ch.pendingMemberIds || []).includes(pid));
};

export const selectOutgoingInvites = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(ch => ch.createdBy === pid && (ch.pendingMemberIds || []).length > 0);
};

export const selectDmSlotsRemaining = (state: GameState): { used: number; total: number; remaining: number } => {
  const { used, total } = selectDmSlots(state);
  return { used, total, remaining: Math.max(0, total - used) };
};

export const selectCastStripEntries = (state: GameState): CastStripEntry[] => {
  const pid = state.playerId;
  if (!pid) return [];
  const leaderId = selectStandings(state)[0]?.id;
  const pendingFromChannels = selectPendingInvitesForMe(state);
  const pendingByInviterId: Record<string, true> = {};
  for (const ch of pendingFromChannels) {
    const inviterId = ch.createdBy;
    if (inviterId && inviterId !== pid) pendingByInviterId[inviterId] = true;
  }
  const outgoingPendingByRecipientId: Record<string, true> = {};
  for (const ch of selectOutgoingInvites(state)) {
    for (const rid of ch.pendingMemberIds || []) outgoingPendingByRecipientId[rid] = true;
  }

  const entries: CastStripEntry[] = [];

  // Self pinned
  const selfPlayer = state.roster[pid];
  if (selfPlayer) {
    entries.push({
      kind: 'self', id: pid, player: selfPlayer, priority: 0,
      unreadCount: 0, hasPendingInviteFromThem: false, hasOutgoingPendingInvite: false,
      isTypingToYou: false, isOnline: state.onlinePlayers.includes(pid),
      isLeader: leaderId === pid,
    });
  }

  // Alive players (not self, not eliminated)
  for (const [id, p] of Object.entries(state.roster)) {
    if (id === pid) continue;
    if (p.status !== 'ALIVE') continue;
    // Channel with this player, if any (1:1 DM)
    const oneOnOneChannel = Object.values(state.channels).find(ch =>
      ch.type === ChannelTypes.DM && ch.memberIds.includes(pid) && ch.memberIds.includes(id)
    );
    const unread = oneOnOneChannel ? selectUnreadForChannel(oneOnOneChannel.id)(state) : 0;
    const isTyping = oneOnOneChannel ? state.typingPlayers[id] === oneOnOneChannel.id : false;
    const isOnline = state.onlinePlayers.includes(id);
    const pending = !!pendingByInviterId[id];
    const outgoingPending = !!outgoingPendingByRecipientId[id];

    let priority: number;
    if (pending) priority = 1;
    else if (unread > 0) priority = 2;
    else if (isTyping) priority = 3;
    else if (isOnline) priority = 5;
    else priority = 7;

    entries.push({
      kind: 'player', id, player: p, priority,
      unreadCount: unread, hasPendingInviteFromThem: pending, hasOutgoingPendingInvite: outgoingPending,
      isTypingToYou: isTyping, isOnline, isLeader: leaderId === id,
    });
  }

  // Group DM channels the player is a member of
  for (const ch of Object.values(state.channels)) {
    if (ch.type !== ChannelTypes.GROUP_DM) continue;
    if (!ch.memberIds.includes(pid)) continue;
    const unread = selectUnreadForChannel(ch.id)(state);
    entries.push({
      kind: 'group', id: ch.id, memberIds: ch.memberIds,
      priority: unread > 0 ? 2 : 6,
      unreadCount: unread, hasPendingInviteFromThem: false, hasOutgoingPendingInvite: false,
      isTypingToYou: false, isOnline: false, isLeader: false,
    });
  }

  // Sort: priority asc; within priority: unread desc then name asc
  entries.sort((a, b) => {
    if (a.kind === 'self') return -1;
    if (b.kind === 'self') return 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    const an = a.player?.personaName || '';
    const bn = b.player?.personaName || '';
    return an.localeCompare(bn);
  });

  return entries;
};
```

- [ ] **Step 1.5: Confirm type check passes**

Run from `apps/client`:

```bash
npx tsc --noEmit
```

Expected: no errors. If `ChannelTypes` is not imported at the top of the file, it's already imported (line 2). Confirm `Channel` is imported too.

- [ ] **Step 1.6: Commit**

```bash
cd /Users/manu/Projects/pecking-order
git add apps/client/src/store/useGameStore.ts
git commit -m "$(cat <<'EOF'
feat(pulse): store fields + selectors for Phase 1.5

Adds lastReadTimestamp (localStorage-persisted), pickingMode state and
actions, plus selectors for cast strip entries, standings, leader check,
unread counts, pending invites (both directions), and slot-remaining.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Engine — acceptDm / declineDm

**Files:**
- Modify: `apps/client/src/hooks/useGameEngine.ts`

- [ ] **Step 2.1: Add the two method bodies**

In `apps/client/src/hooks/useGameEngine.ts`, just after `sendWhisper` (line 171) and before `createGroupDm`, add:

```typescript
  const acceptDm = (channelId: string) => {
    socket.send(JSON.stringify({ type: Events.Social.ACCEPT_DM, channelId }));
  };

  const declineDm = (channelId: string) => {
    socket.send(JSON.stringify({ type: Events.Social.DECLINE_DM, channelId }));
  };
```

- [ ] **Step 2.2: Add both names to the hook's return object**

In the `return { ... }` block at the bottom (line 201+), add `acceptDm,` and `declineDm,` alongside `sendWhisper,`:

```typescript
  return {
    socket,
    sendMessage,
    sendFirstMessage,
    addMember,
    sendSilver,
    sendToChannel,
    createGroupDm,
    sendVoteAction,
    sendGameAction,
    sendActivityAction,
    sendPerk,
    sendReaction,
    sendNudge,
    sendWhisper,
    acceptDm,
    declineDm,
    sendTyping,
    stopTyping,
  };
```

- [ ] **Step 2.3: Type check**

```bash
cd /Users/manu/Projects/pecking-order/apps/client && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 2.4: Update the PulseContext GameEngine type — sanity check**

Confirm `apps/client/src/shells/types.ts` uses `ReturnType<typeof useGameEngine>` so `acceptDm`/`declineDm` auto-propagate. Run:

```bash
cd /Users/manu/Projects/pecking-order && grep -n "useGameEngine" apps/client/src/shells/types.ts
```

Expected: `GameEngine = ReturnType<typeof useGameEngine>` (or equivalent). If not, fix the type in types.ts so engine methods flow through to `usePulse()`.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/manu/Projects/pecking-order
git add apps/client/src/hooks/useGameEngine.ts
git commit -m "$(cat <<'EOF'
feat(pulse): engine wrappers for ACCEPT_DM / DECLINE_DM

Thin wrappers over the existing server events from ADR-096 so the
Pulse DM sheet and Social panel can accept/decline pending invites.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cast Strip

**Prototype reference:** open http://localhost:8765/11-cast-strip-v2.html in a browser before starting. Replicate chip dimensions, paddings, edge colors, shadows, and the gradient wash from this HTML file.

**Files:**
- Create: `apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx`
- Create: `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`
- Create: `apps/client/src/shells/pulse/components/caststrip/GroupChip.tsx`

- [ ] **Step 3.1: Create `CastChip.tsx` for a persona entry**

`apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`:

```typescript
import { useMemo } from 'react';
import type { CastStripEntry } from '../../../../store/useGameStore';
import { getPlayerColor } from '../colors';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { useGameStore } from '../../../../store/useGameStore';

interface Props {
  entry: CastStripEntry;
  onTap: (entry: CastStripEntry) => void;
  pickingMode: boolean;
  picked: boolean;
  pickable: boolean;
}

export function CastChip({ entry, onTap, pickingMode, picked, pickable }: Props) {
  const { player, isOnline, isTypingToYou, hasPendingInviteFromThem, unreadCount, isLeader } = entry;
  const roster = useGameStore(s => s.roster);
  const colorIdx = useMemo(() => Object.keys(roster).indexOf(entry.id), [roster, entry.id]);
  const color = getPlayerColor(colorIdx);
  const avatar = resolveAvatarUrl(player?.avatarUrl);

  const isSelf = entry.kind === 'self';
  const dimmed = !isOnline && !isSelf && !hasPendingInviteFromThem;
  const disabledInPicking = pickingMode && !pickable;

  // Edge/glow based on state
  let edgeColor: string | null = null;
  let glowColor: string | null = null;
  let pulse = false;
  if (hasPendingInviteFromThem) {
    edgeColor = '#ff8c42'; glowColor = 'rgba(255,140,66,0.55)'; pulse = true;
  } else if (unreadCount > 0) {
    edgeColor = 'var(--pulse-accent)'; glowColor = 'rgba(255,59,111,0.35)';
  } else if (isTypingToYou) {
    edgeColor = 'var(--pulse-accent)'; glowColor = null;
  } else if (isOnline) {
    edgeColor = 'rgba(46,204,113,0.6)';
  }

  return (
    <button
      onClick={() => onTap(entry)}
      disabled={disabledInPicking}
      style={{
        position: 'relative',
        width: 72, height: 100,
        flexShrink: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        borderRadius: 14,
        cursor: disabledInPicking ? 'not-allowed' : 'pointer',
        opacity: dimmed ? 0.45 : (disabledInPicking ? 0.4 : 1),
        filter: dimmed ? 'saturate(0.6)' : 'none',
        scrollSnapAlign: 'start',
        transition: 'transform 0.12s ease, opacity 0.3s ease, filter 0.3s ease',
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          overflow: 'hidden',
          background: '#222',
          boxShadow: glowColor ? `0 0 12px ${glowColor}` : 'none',
          border: edgeColor ? `2.5px solid ${edgeColor}` : '2px solid transparent',
          animation: pulse ? 'pulse-breathe 1.4s ease-in-out infinite' : undefined,
        }}
      >
        {avatar && <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {/* Name bar */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '14px 6px 5px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          color: color, fontSize: 11, fontWeight: 700, textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          letterSpacing: 0.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {player?.personaName}
        </div>
      </div>

      {/* Self outline + YOU tag */}
      {isSelf && (
        <>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            border: '2px solid var(--pulse-accent)', pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--pulse-accent)', color: '#fff',
            fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
            padding: '1px 5px', borderRadius: 6,
            textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>You</span>
        </>
      )}

      {/* Leader crown medallion (top-left) — only #1, not self-only */}
      {isLeader && !isSelf && (
        <span style={{
          position: 'absolute', top: 4, left: 4,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(255,215,0,0.6)',
          border: '1.5px solid rgba(255,215,0,0.8)',
        }}>
          <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffd700" />
          </svg>
        </span>
      )}

      {/* Pending invite pill */}
      {hasPendingInviteFromThem && (
        <span style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
          background: '#ff8c42', color: '#fff',
          fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
          padding: '2px 6px', borderRadius: 8,
          textTransform: 'uppercase', animation: 'pulse-breathe 1.4s ease-in-out infinite',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>Invite</span>
      )}

      {/* Unread count badge */}
      {unreadCount > 0 && !hasPendingInviteFromThem && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--pulse-accent)', color: '#fff',
          minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--pulse-bg)',
        }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}

      {/* Typing badge */}
      {isTypingToYou && (
        <span style={{
          position: 'absolute', bottom: -3, right: -3,
          background: 'var(--pulse-accent)', borderRadius: 10,
          padding: '2px 5px', display: 'flex', gap: 2,
          border: '2px solid var(--pulse-bg)',
        }}>
          {[0, 1, 2].map(d => (
            <span key={d} style={{
              width: 3, height: 3, borderRadius: '50%', background: '#fff',
              animation: `pulse-breathe 0.9s ease-in-out ${d * 0.15}s infinite`,
            }} />
          ))}
        </span>
      )}

      {/* Picking mode: checkmark when picked */}
      {pickingMode && picked && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--pulse-accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '3px solid var(--pulse-bg)', fontSize: 12, fontWeight: 900,
        }}>✓</span>
      )}
      {pickingMode && picked && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          border: '3px solid var(--pulse-accent)', pointerEvents: 'none',
        }} />
      )}
    </button>
  );
}
```

- [ ] **Step 3.2: Create `GroupChip.tsx`**

`apps/client/src/shells/pulse/components/caststrip/GroupChip.tsx`:

```typescript
import type { CastStripEntry } from '../../../../store/useGameStore';
import { useGameStore } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';

interface Props {
  entry: CastStripEntry;
  onTap: (entry: CastStripEntry) => void;
}

export function GroupChip({ entry, onTap }: Props) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const others = (entry.memberIds || []).filter(id => id !== playerId).slice(0, 2);
  const firstNames = (entry.memberIds || [])
    .filter(id => id !== playerId)
    .map(id => roster[id]?.personaName?.split(' ')[0] ?? '')
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  const edgeColor = entry.unreadCount > 0 ? 'var(--pulse-accent)' : 'rgba(255,255,255,0.1)';
  const glow = entry.unreadCount > 0 ? '0 0 12px rgba(255,59,111,0.35)' : 'none';

  return (
    <button
      onClick={() => onTap(entry)}
      style={{
        position: 'relative', width: 72, height: 100,
        flexShrink: 0, padding: 0, border: 'none', background: 'transparent',
        borderRadius: 14, cursor: 'pointer', scrollSnapAlign: 'start',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
        background: '#222', border: `2px solid ${edgeColor}`, boxShadow: glow,
        display: 'flex',
      }}>
        {others.map((id) => {
          const avatar = resolveAvatarUrl(roster[id]?.avatarUrl);
          return (
            <div key={id} style={{ flex: 1, position: 'relative' }}>
              {avatar && <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          );
        })}
        {/* Group micro-label */}
        <span style={{
          position: 'absolute', top: 3, right: 3,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          fontSize: 7, fontWeight: 800, letterSpacing: 0.4,
          padding: '1px 4px', borderRadius: 4, textTransform: 'uppercase',
        }}>Group</span>
        {/* Name bar */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '14px 6px 5px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 700, textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{firstNames}</div>
      </div>
      {entry.unreadCount > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--pulse-accent)', color: '#fff',
          minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--pulse-bg)',
        }}>{entry.unreadCount > 9 ? '9+' : entry.unreadCount}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 3.3: Create `CastStrip.tsx`**

`apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx`:

```typescript
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectCastStripEntries, type CastStripEntry } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { CastChip } from './CastChip';
import { GroupChip } from './GroupChip';

export function CastStrip() {
  // Amendment 2: useShallow short-circuits re-renders when the derived chip
  // array is structurally identical to the previous one. Without this, every
  // unrelated store update (typing events, messages, etc.) rebuilds the strip.
  const entries = useGameStore(useShallow(selectCastStripEntries));
  const pickingMode = useGameStore(s => s.pickingMode);
  const togglePicked = useGameStore(s => s.togglePicked);
  const { openDM, openSocialPanel } = usePulse();

  const handleTap = (entry: CastStripEntry) => {
    if (pickingMode.active) {
      if (entry.kind === 'self') return;            // can't pick self
      if (entry.kind === 'group') return;           // groups not pickable in v1
      togglePicked(entry.id);
      return;
    }
    if (entry.kind === 'self') {
      openSocialPanel();
      return;
    }
    openDM(entry.id, entry.kind === 'group');
  };

  if (entries.length === 0) return null;

  return (
    <div style={{
      padding: '14px 0 16px',
      background: `
        radial-gradient(ellipse at top, rgba(255,59,111,0.07), transparent 60%),
        linear-gradient(to bottom, var(--pulse-surface), var(--pulse-bg))
      `,
      borderBottom: '1px solid var(--pulse-border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      position: 'relative', zIndex: 2,
    }}>
      <div style={{
        display: 'flex', gap: 10, padding: '0 14px',
        overflowX: 'auto', overflowY: 'visible',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {entries.map(entry => {
          const pickable = pickingMode.active && entry.kind === 'player';
          const picked = pickingMode.selected.includes(entry.id);
          if (entry.kind === 'group') {
            return <GroupChip key={entry.id} entry={entry} onTap={handleTap} />;
          }
          return (
            <CastChip key={entry.id} entry={entry}
              onTap={handleTap}
              pickingMode={pickingMode.active}
              picked={picked}
              pickable={pickable || entry.kind === 'self' ? false : pickable}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Wire `openSocialPanel` and `openDM(id, isGroup)` into PulseContext, and hydrate lastRead**

Modify `apps/client/src/shells/pulse/PulseShell.tsx`:

1. Update `PulseContext` type to add `openSocialPanel: () => void;` and change `openDM` signature to `openDM: (id: string, isGroup?: boolean) => void;`.
2. Add local state `const [socialPanelOpen, setSocialPanelOpen] = useState(false);` and `const [dmIsGroup, setDmIsGroup] = useState(false);`.
3. Add `const openSocialPanel = useCallback(() => setSocialPanelOpen(true), []);`.
4. Update `openDM` body: `const openDM = useCallback((id: string, isGroup = false) => { setDmTarget(id); setDmIsGroup(isGroup); }, []);`.
5. Add both to the context provider value.
6. Import and render `<CastStrip />` BETWEEN the ticker and the PulseBar. (Ticker will be deleted in a later task — keep it for now to avoid regressions mid-milestone.)
7. Hydrate the namespaced lastRead store (amendment 1). Add near the top of the component:

```typescript
const gameId = useGameStore(s => s.gameId);
const hydrateLastRead = useGameStore(s => s.hydrateLastRead);
useEffect(() => {
  if (gameId && playerId) hydrateLastRead(gameId, playerId);
}, [gameId, playerId, hydrateLastRead]);
```

(Add `useEffect` to the React import.)

- [ ] **Step 3.5: Build + manual test (tap-to-placeholder-log)**

Temporarily, in `PulseShell.tsx`, before the full DM sheet exists, stub `openDM` to `console.log('openDM', id, isGroup)` and `openSocialPanel` to `console.log('openSocialPanel')`. This unblocks visual testing of the strip.

Build + run:

```bash
cd /Users/manu/Projects/pecking-order/apps/client && npm run build
```

Expected: clean build. If Ticker or PulseBar render duplicate presence, it's acceptable mid-milestone (deleted later).

- [ ] **Step 3.6: Multi-player playtest — strip visibility & ordering**

Before testing, verify dev-server CWD:

```bash
lsof -i :5173 :8787 | grep LISTEN
# for each pid: lsof -p <pid> | grep cwd
```

Must match `/Users/manu/Projects/pecking-order` (main repo or the canonical worktree the user designates — ask if unsure). Clear `po_pwa_*` / `po_token_*` cookies before first nav.

Create a test game with `shell=pulse`. Join as 2+ players in separate `isolatedContext` pages via `mcp__chrome-devtools__new_page`. Verify:
- Self chip is first with coral outline + "YOU" tag
- Other alive players all appear
- Online players have soft green edge; offline dimmed
- Leader (highest silver) has a gold crown medallion
- Tap a non-self chip → console logs `openDM {id} false`
- Tap self → console logs `openSocialPanel`

Report the result. Ask user to confirm before moving on.

- [ ] **Step 3.7: Commit**

```bash
git add apps/client/src/shells/pulse/components/caststrip/ apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "$(cat <<'EOF'
feat(pulse): Cast Strip — priority-sorted persona + group chips

Introduces CastStrip + CastChip + GroupChip, replacing the HERE presence
bar. Renders self-pinned, then priority-sorted persona entries driven
by selectCastStripEntries. State vocabulary covers online, unread,
typing, leader, pending invite, and offline — only pending pulses.

DM and Social panel wiring is stubbed pending Task 4 + 5.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**STOP — ask user to confirm milestone before moving to Task 4.**

---

## Task 4: Unified DM Sheet

**Prototype reference:** `11-cast-strip-v2.html` includes the DM sheet layout. Match it.

**Files:**
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmBioQuote.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmEmptyState.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmPendingState.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmWaitingBanner.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmMessages.tsx`
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx`

- [ ] **Step 4.1: Create `DmBioQuote.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmBioQuote.tsx
interface Props { bio: string | undefined; name: string; }

export function DmBioQuote({ bio, name }: Props) {
  if (!bio || !bio.trim()) return null;
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--pulse-border)' }}>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <span style={{
          position: 'absolute', top: -4, left: 0,
          fontSize: 28, color: 'var(--pulse-accent)', fontFamily: 'Georgia, serif',
          lineHeight: 1,
        }}>&ldquo;</span>
        <div style={{
          fontStyle: 'italic', fontSize: 14, color: 'var(--pulse-text-1)',
          lineHeight: 1.4,
        }}>{bio}</div>
        <div style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
          color: 'var(--pulse-text-3)', marginTop: 6,
        }}>{name} · Pre-game interview</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Create `DmEmptyState.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmEmptyState.tsx
interface Props { isGroup: boolean; targetName: string; groupNames?: string; }

export function DmEmptyState({ isGroup, targetName, groupNames }: Props) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <div style={{
        fontStyle: 'italic', fontSize: 13, color: 'var(--pulse-text-3)', lineHeight: 1.5, maxWidth: 280,
      }}>
        {isGroup
          ? <>Your group with {groupNames}. No messages yet. Say something to get it started.</>
          : <>No messages yet with {targetName}. Break the ice.</>
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 4.3: Create `DmHero.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx
import { useState } from 'react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl, resolvePersonaVariant } from '../../../../utils/personaImage';
import { getPlayerColor } from '../colors';

interface Props {
  player: SocialPlayer;
  playerId: string;
  colorIdx: number;
  rank: number | null;
  isLeader: boolean;
  isOnline: boolean;
  onClose: () => void;
}

export function DmHero({ player, colorIdx, rank, isLeader, isOnline, onClose }: Props) {
  const color = getPlayerColor(colorIdx);
  const [variant, setVariant] = useState<'headshot' | 'medium' | 'full'>('headshot');
  const src =
    variant === 'headshot'
      ? resolveAvatarUrl(player.avatarUrl)
      : resolvePersonaVariant(player.avatarUrl, variant);

  return (
    <div style={{ position: 'relative', width: '100%', height: 280, background: '#111', overflow: 'hidden' }}>
      {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {/* Back button */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, left: 10,
        width: 38, height: 38, borderRadius: 19,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', fontSize: 20, fontWeight: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }} aria-label="Close DM">‹</button>

      {/* Gallery dots */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        display: 'flex', gap: 6,
      }}>
        {(['headshot', 'medium', 'full'] as const).map(v => (
          <button key={v} onClick={() => setVariant(v)} aria-label={`Show ${v}`} style={{
            width: 8, height: 8, borderRadius: '50%',
            border: 'none', padding: 0, cursor: 'pointer',
            background: variant === v ? '#fff' : 'rgba(255,255,255,0.35)',
          }} />
        ))}
      </div>

      {/* Leader crown */}
      {isLeader && (
        <span style={{
          position: 'absolute', top: 14, left: 60,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(255,215,0,0.7)',
          border: '1.5px solid rgba(255,215,0,0.9)',
        }}>
          <svg width="16" height="12" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffd700" />
          </svg>
        </span>
      )}

      {/* Bottom scrim + meta */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 800, color, letterSpacing: -0.3,
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        }}>{player.personaName}</div>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
          color: 'rgba(255,255,255,0.75)', marginTop: 2,
        }}>{player.stereotype || ''}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {isOnline && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(46,204,113,0.25)', color: '#2ecc71',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71' }} />
              Online
            </span>
          )}
          {rank !== null && (
            <span style={{
              background: isLeader ? 'rgba(255,215,0,0.2)' : 'rgba(255,59,111,0.2)',
              color: isLeader ? '#ffd700' : 'var(--pulse-accent)',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>#{rank} · {player.silver} silver</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.4: Create `DmGroupHero.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx
import type { SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../colors';

interface Props {
  members: { id: string; player: SocialPlayer; colorIdx: number }[];
  onClose: () => void;
}

export function DmGroupHero({ members, onClose }: Props) {
  const names = members.slice(0, 3).map(m => m.player.personaName.split(' ')[0]).join(', ');
  const suffix = members.length > 3 ? ` +${members.length - 3}` : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: 280, background: '#111', overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {members.map(m => {
          const src = resolveAvatarUrl(m.player.avatarUrl);
          return (
            <div key={m.id} style={{ flex: 1, borderRight: '2px solid var(--pulse-bg)' }}>
              {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          );
        })}
      </div>

      <button onClick={onClose} style={{
        position: 'absolute', top: 10, left: 10,
        width: 38, height: 38, borderRadius: 19,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
        fontSize: 20, cursor: 'pointer',
      }} aria-label="Close group DM">‹</button>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
          {names}{suffix}
        </div>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
          color: 'rgba(255,255,255,0.75)', marginTop: 2,
        }}>{members.length} members</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {members.slice(0, 4).map(m => {
            const color = getPlayerColor(m.colorIdx);
            return (
              <span key={m.id} style={{
                background: `${color}33`, color,
                padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              }}>{m.player.personaName.split(' ')[0]}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.5: Create `DmMessages.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmMessages.tsx
import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';

interface Props { channelId: string; }

export function DmMessages({ channelId }: Props) {
  const chatLog = useGameStore(s => s.chatLog);
  const markChannelRead = useGameStore(s => s.markChannelRead);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo<ChatMessage[]>(
    () => chatLog.filter(m => m.channelId === channelId).sort((a, b) => a.timestamp - b.timestamp),
    [chatLog, channelId]
  );

  useEffect(() => {
    // Mark read whenever this sheet is mounted with messages visible.
    markChannelRead(channelId);
  }, [channelId, messages.length, markChannelRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {messages.map(m => (
        <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, color: 'var(--pulse-text-3)', marginBottom: 2 }}>
            {m.personaName}
          </div>
          <div style={{ fontSize: 14, color: 'var(--pulse-text-1)' }}>{m.content}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4.6: Create `DmInput.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx
import { useState } from 'react';
import { usePulse } from '../../PulseShell';

interface Props { channelId: string | null; recipientIds: string[]; placeholderName: string; disabled?: boolean; }

export function DmInput({ channelId, recipientIds, placeholderName, disabled }: Props) {
  const { engine } = usePulse();
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim() || disabled) return;
    if (channelId) {
      engine.sendToChannel(channelId, text.trim());
    } else {
      engine.sendFirstMessage(recipientIds, text.trim());
    }
    setText('');
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--pulse-bg)', borderRadius: 20, padding: '6px 8px 6px 14px',
        opacity: disabled ? 0.5 : 1,
      }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          disabled={disabled}
          placeholder={`Message ${placeholderName}…`}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
        <button onClick={submit} disabled={disabled || !text.trim()} style={{
          background: 'var(--pulse-accent)', color: '#fff',
          border: 'none', borderRadius: 16, padding: '6px 14px',
          fontWeight: 700, cursor: 'pointer',
          opacity: (disabled || !text.trim()) ? 0.5 : 1,
        }}>Send</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.7: Create `DmPendingState.tsx` and `DmWaitingBanner.tsx`**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmPendingState.tsx
import { usePulse } from '../../PulseShell';

interface Props { channelId: string; inviterName: string; onClose: () => void; }

export function DmPendingState({ channelId, inviterName, onClose }: Props) {
  const { engine } = usePulse();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{
        background: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)',
        borderRadius: 14, padding: 20, textAlign: 'center',
        filter: 'blur(0.4px)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>
          {inviterName} sent you a message
        </div>
      </div>
      <button onClick={() => { engine.acceptDm(channelId); }} style={{
        width: '100%', background: 'var(--pulse-accent)', color: '#fff', border: 'none',
        padding: '12px 16px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
      }}>Accept</button>
      <button onClick={() => { engine.declineDm(channelId); onClose(); }} style={{
        width: '100%', background: 'transparent', color: 'var(--pulse-text-3)', border: 'none',
        padding: '4px', fontSize: 13, cursor: 'pointer',
      }}>Decline</button>
    </div>
  );
}
```

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmWaitingBanner.tsx
interface Props { targetName: string; }
export function DmWaitingBanner({ targetName }: Props) {
  return (
    <div style={{
      background: 'rgba(255,140,66,0.12)', color: '#ff8c42',
      borderTop: '1px solid rgba(255,140,66,0.3)', borderBottom: '1px solid rgba(255,140,66,0.3)',
      padding: '10px 14px', fontSize: 12, fontWeight: 600,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>Waiting for {targetName} to accept…</span>
    </div>
  );
}
```

- [ ] **Step 4.8: Create `DmSheet.tsx` — the root overlay**

```typescript
// apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import { DmHero } from './DmHero';
import { DmGroupHero } from './DmGroupHero';
import { DmBioQuote } from './DmBioQuote';
import { DmMessages } from './DmMessages';
import { DmInput } from './DmInput';
import { DmEmptyState } from './DmEmptyState';
import { DmPendingState } from './DmPendingState';
import { DmWaitingBanner } from './DmWaitingBanner';
import { selectStandings, selectIsLeader } from '../../../../store/useGameStore';

interface Props {
  targetId: string;            // playerId (1:1) or channelId (group)
  isGroup: boolean;
  onClose: () => void;
}

export function DmSheet({ targetId, isGroup, onClose }: Props) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId) as string;
  const channels = useGameStore(s => s.channels);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const standings = useGameStore(selectStandings);

  const channel = useMemo(() => {
    if (isGroup) return channels[targetId] ?? null;
    return Object.values(channels).find(ch =>
      ch.type === ChannelTypes.DM && ch.memberIds.includes(playerId) && ch.memberIds.includes(targetId)
    ) ?? null;
  }, [channels, targetId, isGroup, playerId]);

  const incomingPending = channel && !isGroup && (channel.pendingMemberIds || []).includes(playerId);
  const outgoingPending = channel && !isGroup
    && channel.createdBy === playerId
    && (channel.pendingMemberIds || []).some(id => id !== playerId);

  // 1:1
  const targetPlayer = !isGroup ? roster[targetId] : null;
  const targetColorIdx = !isGroup ? Object.keys(roster).indexOf(targetId) : -1;
  const targetRank = !isGroup ? (standings.find(s => s.id === targetId)?.rank ?? null) : null;
  const leader = useGameStore(selectIsLeader(targetId));
  const targetIsOnline = !isGroup && onlinePlayers.includes(targetId);

  // Group
  const groupMembers = isGroup && channel
    ? channel.memberIds.filter(id => id !== playerId).map(id => ({
        id, player: roster[id], colorIdx: Object.keys(roster).indexOf(id),
      })).filter(m => m.player)
    : [];

  return (
    <>
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: 80,
        }}
      />
      {/* Sheet */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: 81, overflow: 'hidden',
        }}
      >
        {/* Hero */}
        {isGroup && groupMembers.length > 0
          ? <DmGroupHero members={groupMembers} onClose={onClose} />
          : targetPlayer && (
              <DmHero player={targetPlayer} playerId={targetId} colorIdx={targetColorIdx}
                rank={targetRank} isLeader={leader} isOnline={targetIsOnline} onClose={onClose} />
            )}

        {/* Bio quote (1:1 only) */}
        {!isGroup && targetPlayer && <DmBioQuote bio={(targetPlayer as any).bio} name={targetPlayer.personaName} />}

        {/* Privacy line */}
        <div style={{
          padding: '8px 16px', fontSize: 10, color: 'var(--pulse-text-3)',
          textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1,
          borderBottom: '1px solid var(--pulse-border)',
        }}>Private conversation</div>

        {incomingPending && channel && (
          <DmPendingState channelId={channel.id} inviterName={targetPlayer?.personaName ?? 'Someone'} onClose={onClose} />
        )}

        {!incomingPending && (
          <>
            {channel
              ? <DmMessages channelId={channel.id} />
              : <DmEmptyState
                  isGroup={isGroup}
                  targetName={targetPlayer?.personaName ?? ''}
                  groupNames={groupMembers.map(m => m.player.personaName.split(' ')[0]).join(', ')}
                />
            }

            {outgoingPending && targetPlayer && <DmWaitingBanner targetName={targetPlayer.personaName} />}

            <DmInput
              channelId={channel?.id ?? null}
              recipientIds={isGroup ? (channel?.memberIds ?? []).filter(id => id !== playerId) : [targetId]}
              placeholderName={isGroup ? 'group' : (targetPlayer?.personaName ?? '')}
              disabled={!!outgoingPending}
            />
          </>
        )}
      </motion.div>
    </>
  );
}
```

- [ ] **Step 4.9: Wire DmSheet into PulseShell**

In `apps/client/src/shells/pulse/PulseShell.tsx`:

1. Import `DmSheet` from `./components/dm-sheet/DmSheet`.
2. Remove the existing `{dmTarget && <DMView ... />}` block.
3. Replace with:

```tsx
<AnimatePresence>
  {dmTarget && (
    <DmSheet
      key={`${dmTarget}-${dmIsGroup}`}
      targetId={dmTarget}
      isGroup={dmIsGroup}
      onClose={() => { setDmTarget(null); setDmIsGroup(false); }}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 4.10: Build + type check**

```bash
cd /Users/manu/Projects/pecking-order/apps/client && npm run build
```

Expected: clean.

- [ ] **Step 4.11: Multi-player playtest — DM sheet**

Ask user to playtest with A and B:
- A taps B's chip on the Cast Strip → DM sheet slides in, shows B's hero, bio quote, empty-state copy
- A types a message, sends → appears in the DM feed, shows up on B's Cast Strip as unread
- B taps A's chip → DM sheet opens for A, message visible, unread pip clears
- Gallery dots swap persona variants
- Scrim tap closes sheet
- Reopen → message still there

Ask user to confirm before commit + moving on.

- [ ] **Step 4.12: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm-sheet/ apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "$(cat <<'EOF'
feat(pulse): unified DM sheet (hero + messages + input)

Introduces DmSheet as a full-height overlay replacing the previous
DMView/GroupDMView. The sheet includes the persona hero (with gallery
variant swap), bio pull-quote, privacy line, messages, empty-state,
pending-invite accept/decline, and outgoing-waiting banner. Group
variant renders member collage + color pills.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**STOP — ask user to confirm milestone before moving to Task 5.**

---

## Task 5: Social Panel

**Files:**
- Create: `apps/client/src/shells/pulse/components/social-panel/SocialPanel.tsx`
- Create: `apps/client/src/shells/pulse/components/social-panel/Podium.tsx`
- Create: `apps/client/src/shells/pulse/components/social-panel/StandingsRest.tsx`
- Create: `apps/client/src/shells/pulse/components/social-panel/ConversationsList.tsx`
- Create: `apps/client/src/shells/pulse/components/social-panel/InviteRow.tsx`
- Create: `apps/client/src/shells/pulse/components/header/PanelButton.tsx`

- [ ] **Step 5.1: `Podium.tsx`**

```typescript
// apps/client/src/shells/pulse/components/social-panel/Podium.tsx
import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../colors';
import { usePulse } from '../../PulseShell';

export function Podium() {
  const standings = useGameStore(selectStandings).slice(0, 3);
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();

  if (standings.length === 0) return null;
  const [first, second, third] = [standings[0], standings[1], standings[2]];

  const slot = (entry: typeof first | undefined, rank: 1 | 2 | 3) => {
    if (!entry) return <div style={{ flex: rank === 1 ? 2 : 1 }} />;
    const colorIdx = Object.keys(roster).indexOf(entry.id);
    const color = getPlayerColor(colorIdx);
    const isFirst = rank === 1;
    return (
      <button onClick={() => openDM(entry.id)} style={{
        flex: isFirst ? 2 : 1, order: rank === 2 ? 1 : rank === 1 ? 2 : 3,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: isFirst ? 150 : 84 }}>
          <img src={resolveAvatarUrl(entry.player.avatarUrl) || ''} alt=""
            style={{
              width: '100%', height: isFirst ? 140 : 74,
              objectFit: 'cover', borderRadius: 10,
              border: isFirst ? '2px solid #ffd700' : '1px solid var(--pulse-border)',
              boxShadow: isFirst ? '0 0 18px rgba(255,215,0,0.4)' : 'none',
            }}
          />
          {isFirst && (
            <span style={{
              position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.8)', border: '1.5px solid rgba(255,215,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="12" viewBox="0 0 14 10" aria-hidden>
                <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffd700" />
              </svg>
            </span>
          )}
        </div>
        <div style={{ fontSize: isFirst ? 14 : 11, fontWeight: 700, color, textAlign: 'center' }}>
          {entry.player.personaName.split(' ')[0]}
        </div>
        <div style={{ fontSize: isFirst ? 12 : 10, color: '#ffd700', fontWeight: 700 }}>
          {entry.player.silver} silver
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '24px 16px 12px', justifyContent: 'center' }}>
      {slot(second, 2)}
      {slot(first, 1)}
      {slot(third, 3)}
    </div>
  );
}
```

- [ ] **Step 5.2: `StandingsRest.tsx`**

```typescript
// apps/client/src/shells/pulse/components/social-panel/StandingsRest.tsx
import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../colors';
import { usePulse } from '../../PulseShell';

export function StandingsRest() {
  const standings = useGameStore(selectStandings).slice(3);
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const { openDM } = usePulse();
  if (standings.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 16px 12px' }}>
      {standings.map(entry => {
        const colorIdx = Object.keys(roster).indexOf(entry.id);
        const color = getPlayerColor(colorIdx);
        const isSelf = entry.id === playerId;
        return (
          <button key={entry.id} onClick={() => openDM(entry.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
            background: isSelf ? 'rgba(255,59,111,0.12)' : 'transparent',
            border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ width: 22, fontSize: 11, color: 'var(--pulse-text-3)', fontWeight: 700 }}>#{entry.rank}</span>
            <img src={resolveAvatarUrl(entry.player.avatarUrl) || ''} alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color }}>{entry.player.personaName}</span>
            <span style={{ fontSize: 12, color: '#ffd700', fontWeight: 700 }}>{entry.player.silver}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5.3: `InviteRow.tsx`**

```typescript
// apps/client/src/shells/pulse/components/social-panel/InviteRow.tsx
import type { Channel, SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { usePulse } from '../../PulseShell';

interface Props { channel: Channel; inviter: SocialPlayer; }

export function InviteRow({ channel, inviter }: Props) {
  const { engine } = usePulse();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px',
      background: 'var(--pulse-surface)', border: '1px solid rgba(255,140,66,0.3)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <img src={resolveAvatarUrl(inviter.avatarUrl) || ''} alt=""
          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
            {inviter.personaName} wants to DM you
          </div>
          <div style={{ fontSize: 10, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {inviter.stereotype || ''} · just now
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => engine.acceptDm(channel.id)} style={{
          flex: 1, background: '#2ecc71', color: '#fff', border: 'none',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}>Accept</button>
        <button onClick={() => engine.declineDm(channel.id)} style={{
          flex: 1, background: 'var(--pulse-bg)', color: 'var(--pulse-text-3)',
          border: '1px solid var(--pulse-border)',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Decline</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.4: `ConversationsList.tsx`**

```typescript
// apps/client/src/shells/pulse/components/social-panel/ConversationsList.tsx
import { useGameStore, selectDmThreads, selectUnreadForChannel } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../colors';
import { usePulse } from '../../PulseShell';

export function ConversationsList() {
  const threads = useGameStore(selectDmThreads);
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();

  if (threads.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>
      No conversations yet.
    </div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {threads.map(t => {
        const last = t.messages[t.messages.length - 1];
        const preview = last?.content?.slice(0, 60) ?? '';
        const time = last ? new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const unread = useGameStore.getState().lastReadTimestamp[t.channelId]
          ? selectUnreadForChannel(t.channelId)(useGameStore.getState()) : (last ? 1 : 0);
        if (t.isGroup) {
          const members = (t.memberIds || []).map(id => roster[id]).filter(Boolean);
          const name = members.slice(0, 3).map(m => m.personaName.split(' ')[0]).join(', ');
          return (
            <button key={t.channelId} onClick={() => openDM(t.channelId, true)} style={rowStyle}>
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                {members.slice(0, 2).map((m, i) => (
                  <img key={i} src={resolveAvatarUrl(m.avatarUrl) || ''} alt=""
                    style={{
                      position: 'absolute', width: 26, height: 26, borderRadius: 6, objectFit: 'cover',
                      top: i === 0 ? 0 : 10, left: i === 0 ? 0 : 10,
                      border: '2px solid var(--pulse-bg)',
                    }}
                  />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--pulse-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--pulse-text-3)' }}>{time}</span>
                {unread > 0 && <span style={pipStyle}>{unread}</span>}
              </div>
            </button>
          );
        }
        const partner = roster[t.partnerId];
        if (!partner) return null;
        const color = getPlayerColor(Object.keys(roster).indexOf(t.partnerId));
        return (
          <button key={t.channelId} onClick={() => openDM(t.partnerId)} style={rowStyle}>
            <img src={resolveAvatarUrl(partner.avatarUrl) || ''} alt=""
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{partner.personaName}</div>
              <div style={{ fontSize: 11, color: 'var(--pulse-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--pulse-text-3)' }}>{time}</span>
              {unread > 0 && <span style={pipStyle}>{unread}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 16px', background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--pulse-border)',
  cursor: 'pointer', textAlign: 'left', width: '100%',
};
const pipStyle: React.CSSProperties = {
  background: 'var(--pulse-accent)', color: '#fff',
  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
};
```

Note: the inline `useGameStore.getState()` call inside `.map()` for unread is a simplification. If lint/TSX balks or re-render behavior is problematic, hoist to `const lastReadTimestamp = useGameStore(s => s.lastReadTimestamp);` at the top and compute unread imperatively. Replace only if lint flags it.

- [ ] **Step 5.5: `SocialPanel.tsx`**

```typescript
// apps/client/src/shells/pulse/components/social-panel/SocialPanel.tsx
import { motion } from 'framer-motion';
import { useGameStore, selectPendingInvitesForMe, selectStandings } from '../../../../store/useGameStore';
import { Podium } from './Podium';
import { StandingsRest } from './StandingsRest';
import { InviteRow } from './InviteRow';
import { ConversationsList } from './ConversationsList';

interface Props { onClose: () => void; }

export function SocialPanel({ onClose }: Props) {
  const pendingInvites = useGameStore(selectPendingInvitesForMe);
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const standings = useGameStore(selectStandings);
  const myRank = standings.find(s => s.id === playerId)?.rank ?? null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: 80,
        }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: 81, overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ width: 40, height: 4, background: 'var(--pulse-border)', borderRadius: 2 }} />
        </div>
        <div style={{
          background: 'radial-gradient(ellipse at top, rgba(255,215,0,0.08), transparent 60%), var(--pulse-surface)',
          borderBottom: '1px solid var(--pulse-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pulse-text-1)' }}>Standings</span>
            {myRank && (
              <span style={{ fontSize: 11, color: 'var(--pulse-accent)', fontWeight: 700, background: 'rgba(255,59,111,0.15)', padding: '3px 9px', borderRadius: 10 }}>
                You · #{myRank}
              </span>
            )}
          </div>
          <Podium />
          <StandingsRest />
        </div>

        {pendingInvites.length > 0 && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'var(--pulse-text-3)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Pending Invites
              <span style={{ background: 'var(--pulse-accent)', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>{pendingInvites.length}</span>
            </div>
            {pendingInvites.map(ch => {
              const inviter = roster[ch.createdBy];
              if (!inviter) return null;
              return <InviteRow key={ch.id} channel={ch} inviter={inviter} />;
            })}
          </div>
        )}

        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
            color: 'var(--pulse-text-3)',
          }}>Conversations</div>
        </div>
        <ConversationsList />
      </motion.div>
    </>
  );
}
```

- [ ] **Step 5.6: `PanelButton.tsx`**

```typescript
// apps/client/src/shells/pulse/components/header/PanelButton.tsx
import { useGameStore, selectTotalDmUnread, selectPendingInvitesForMe } from '../../../../store/useGameStore';

interface Props { onClick: () => void; }

export function PanelButton({ onClick }: Props) {
  const unread = useGameStore(selectTotalDmUnread);
  const invites = useGameStore(selectPendingInvitesForMe).length;
  const total = unread + invites;

  return (
    <button onClick={onClick} aria-label="Open social panel" style={{
      position: 'relative', width: 34, height: 34,
      borderRadius: 8, border: '1px solid var(--pulse-border)',
      background: 'var(--pulse-surface)', color: 'var(--pulse-text-1)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="8" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="12" width="14" height="2" rx="1" fill="currentColor" />
      </svg>
      {total > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: 'var(--pulse-accent)', color: '#fff',
          fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
          minWidth: 16, textAlign: 'center', border: '2px solid var(--pulse-bg)',
        }}>{total > 9 ? '9+' : total}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 5.7: Wire PanelButton + SocialPanel into PulseShell**

In `PulseShell.tsx`:
1. Import `PanelButton` and `SocialPanel`.
2. Add a temporary top header row BEFORE CastStrip: `<div style={{ display:'flex', justifyContent:'flex-end', padding:'6px 12px', background:'var(--pulse-surface)', borderBottom:'1px solid var(--pulse-border)' }}><PanelButton onClick={openSocialPanel} /></div>` — this becomes the proper `PulseHeader` in Task 6.
3. Add `<AnimatePresence>{socialPanelOpen && <SocialPanel onClose={() => setSocialPanelOpen(false)} />}</AnimatePresence>`.

- [ ] **Step 5.8: Build + multi-player playtest**

```bash
cd /Users/manu/Projects/pecking-order/apps/client && npm run build
```

Playtest:
- Tap ☰ → panel slides up, scrim dims chat
- #1 player is visibly larger with crown + halo
- Ranks 4+ listed below podium
- Tap any rank row → closes panel, opens that DM
- In a game with `requireDmInvite` enabled (or by calling `sendFirstMessage` from A to B), B sees the invite row in Pending Invites; Accept/Decline work
- Tap scrim → panel closes

- [ ] **Step 5.9: Commit**

```bash
git add apps/client/src/shells/pulse/components/social-panel/ apps/client/src/shells/pulse/components/header/ apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "$(cat <<'EOF'
feat(pulse): Social panel — standings + invites + conversations

Adds SocialPanel opened via the header PanelButton. Contains a Standings
podium (larger #1 with crown and halo), remaining ranks list, Pending
Invites section with inline Accept/Decline, and a Conversations list
combining 1:1 and group DM threads.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**STOP — ask user to confirm milestone before moving to Task 6.**

---

## Task 6: Compose Button + Picking Mode

**Files:**
- Create: `apps/client/src/shells/pulse/components/header/ComposeButton.tsx`
- Create: `apps/client/src/shells/pulse/components/header/PulseHeader.tsx`
- Create: `apps/client/src/shells/pulse/components/caststrip/PickingBanner.tsx`
- Create: `apps/client/src/shells/pulse/components/caststrip/StartPickedCta.tsx`
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx`
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx` (integrate picking banner)

**Picking-mode interaction contract (addresses reviewer #8):** Tapping a chip in picking mode ONLY toggles selection — it does not open a DM. The bottom-sticky CTA is always the confirmation gate, with label `Start chat with {Name}` at 1 selected and `Start group with N` at 2+. Consistent confirmation; no mode switching. The existing `handleTap` in Task 3.3 already enforces this.

- [ ] **Step 6.1: `ComposeButton.tsx`**

```typescript
// apps/client/src/shells/pulse/components/header/ComposeButton.tsx
import { useGameStore, selectDmSlotsRemaining } from '../../../../store/useGameStore';

interface Props { onClick: () => void; }

export function ComposeButton({ onClick }: Props) {
  const { used, total, remaining } = useGameStore(selectDmSlotsRemaining);
  const depleted = remaining <= 0;
  return (
    <button onClick={depleted ? undefined : onClick} aria-label="Compose" disabled={depleted} style={{
      position: 'relative', width: 34, height: 34,
      borderRadius: 8, border: '1px solid var(--pulse-border)',
      background: 'var(--pulse-surface)',
      color: depleted ? 'var(--pulse-text-3)' : 'var(--pulse-text-1)',
      cursor: depleted ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: depleted ? 0.5 : 1,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M12.5 2.5 L13.5 3.5 L5 12 L3 13 L4 11 L12.5 2.5 Z"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span style={{
        position: 'absolute', top: -6, right: -6,
        background: depleted ? 'var(--pulse-text-3)' : 'var(--pulse-accent)',
        color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8,
        minWidth: 16, textAlign: 'center', border: '2px solid var(--pulse-bg)',
      }}>{used}/{total}</span>
    </button>
  );
}
```

- [ ] **Step 6.2: `PulseHeader.tsx`**

```typescript
// apps/client/src/shells/pulse/components/header/PulseHeader.tsx
import { useGameStore } from '../../../../store/useGameStore';
import { ComposeButton } from './ComposeButton';
import { PanelButton } from './PanelButton';

interface Props { onCompose: () => void; onOpenPanel: () => void; }

export function PulseHeader({ onCompose, onOpenPanel }: Props) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px',
      background: 'var(--pulse-surface)', borderBottom: '1px solid var(--pulse-border)',
      position: 'relative', zIndex: 3,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
        Day {dayIndex || 1}
        <span style={{ fontSize: 11, color: 'var(--pulse-text-3)', marginLeft: 8, textTransform: 'lowercase', fontWeight: 500 }}>
          · {String(phase || 'morning').toLowerCase()}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <ComposeButton onClick={onCompose} />
        <PanelButton onClick={onOpenPanel} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: `PickingBanner.tsx`**

```typescript
// apps/client/src/shells/pulse/components/caststrip/PickingBanner.tsx
import { useGameStore, selectDmSlotsRemaining } from '../../../../store/useGameStore';

export function PickingBanner() {
  const { remaining } = useGameStore(selectDmSlotsRemaining);
  const cancelPicking = useGameStore(s => s.cancelPicking);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 14px',
      background: 'rgba(255,59,111,0.12)',
      borderBottom: '1px solid rgba(255,59,111,0.25)',
      color: 'var(--pulse-accent)', fontSize: 12, fontWeight: 600,
    }}>
      <span>Pick 1 to chat · 2+ for a group <span style={{ color: 'var(--pulse-text-3)', marginLeft: 6 }}>({remaining} slots left today)</span></span>
      <button onClick={cancelPicking} style={{
        background: 'transparent', color: 'var(--pulse-text-3)',
        border: '1px solid var(--pulse-border)', borderRadius: 14,
        padding: '3px 10px', fontSize: 11, cursor: 'pointer',
      }}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 6.4: `StartPickedCta.tsx`**

```typescript
// apps/client/src/shells/pulse/components/caststrip/StartPickedCta.tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';

export function StartPickedCta() {
  const pickingMode = useGameStore(s => s.pickingMode);
  const roster = useGameStore(s => s.roster);
  const cancelPicking = useGameStore(s => s.cancelPicking);
  const { engine, openDM } = usePulse();
  if (!pickingMode.active || pickingMode.selected.length === 0) return null;

  const label = pickingMode.selected.length === 1
    ? `Start chat with ${roster[pickingMode.selected[0]]?.personaName ?? ''}`
    : `Start group with ${pickingMode.selected.length}`;

  const go = () => {
    if (pickingMode.selected.length === 1) {
      const partnerId = pickingMode.selected[0];
      engine.sendFirstMessage([partnerId], '');  // server will create channel; empty content acts as "create empty thread"
      cancelPicking();
      openDM(partnerId, false);
    } else {
      engine.createGroupDm(pickingMode.selected);
      cancelPicking();
      // Group channel will arrive via SYNC — user can open it from Social panel once visible.
    }
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      style={{
        position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <button onClick={go} style={{
        pointerEvents: 'auto',
        background: 'var(--pulse-accent)', color: '#fff',
        padding: '12px 22px', borderRadius: 22,
        fontSize: 14, fontWeight: 800, border: 'none',
        boxShadow: '0 4px 14px rgba(255,59,111,0.45)',
        cursor: 'pointer',
      }}>{label}</button>
    </motion.div>
  );
}
```

Note: the empty-content `sendFirstMessage` call may be rejected server-side. If so (observe in playtest), fall back to: do NOT call `sendFirstMessage`; just set `dmTarget` via `openDM` — the sheet will render with no channel (empty state) and the first message the user types will trigger `sendFirstMessage` normally via `DmInput`'s existing branch. If empty content is rejected, remove that line and rely on the existing DmInput flow.

- [ ] **Step 6.5: Integrate PickingBanner + StartPickedCta into the shell**

In `PulseShell.tsx`:
1. Replace the temporary header row with `<PulseHeader onCompose={() => useGameStore.getState().startPicking()} onOpenPanel={openSocialPanel} />`.
2. Below the header and above CastStrip: `{pickingActive && <PickingBanner />}` where `pickingActive = useGameStore(s => s.pickingMode.active)`.
3. After the main content area: `<StartPickedCta />`.

In `CastStrip.tsx`, when `pickingMode.active` is true, hide group chips entirely (return null for `kind === 'group'`). (Prevents group-in-picking ambiguity.)

- [ ] **Step 6.6: Build + multi-player playtest**

Playtest:
- Tap ✎ → picking banner slides in, chip dims except eligible players
- Tap a player → checkmark + coral outline appears; bottom CTA "Start chat with X" appears
- Tap another player → CTA becomes "Start group with 2"
- Tap Cancel → exits picking, chips return to normal
- Start chat with one → DM sheet opens for that player
- Start group with 2 → group channel appears in Social panel and as a Cast Strip chip on next SYNC
- Deplete slots (send 3 first-messages in a 3-slot manifest) → ✎ becomes muted, disabled

- [ ] **Step 6.7: Commit**

```bash
git add apps/client/src/shells/pulse/components/header/ apps/client/src/shells/pulse/components/caststrip/ apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "$(cat <<'EOF'
feat(pulse): header compose + picking mode for unified DM create flow

Adds ComposeButton (with live slot pip) and PulseHeader, plus Cast
Strip picking mode with an inline banner and floating "Start chat"/
"Start group" CTA. One tap on ✎ enters picking; selecting 1 starts a
1:1, 2+ starts a group. Slot exhaustion disables compose.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**STOP — ask user to confirm milestone before moving to Task 7.**

---

## Task 7: Narrator Lines + Ticker Deletion + PulseBar Presence Deletion

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/NarratorLine.tsx`
- Modify: `apps/client/src/shells/pulse/components/chat/ChatView.tsx` (add narrator-line rendering)
- Modify: `apps/client/src/shells/pulse/components/PulseBar.tsx` (delete presence block)
- Delete: `apps/client/src/shells/pulse/components/Ticker.tsx`
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx` (remove `<Ticker />`)

- [ ] **Step 7.1: Create `NarratorLine.tsx`**

```typescript
// apps/client/src/shells/pulse/components/chat/NarratorLine.tsx
interface Props {
  kind: 'talking' | 'scheming' | 'alliance';
  text: string;
}

export function NarratorLine({ kind, text }: Props) {
  const color = kind === 'scheming' ? '#b07aff' : kind === 'alliance' ? '#ffd700' : 'var(--pulse-accent)';
  return (
    <div style={{
      textAlign: 'center', padding: '10px 16px',
      fontStyle: 'italic', fontSize: 11, color,
      letterSpacing: 0.2, opacity: 0.85,
    }}>{text}</div>
  );
}
```

- [ ] **Step 7.2: Derive narrator lines in ChatView**

Read `apps/client/src/shells/pulse/components/chat/ChatView.tsx` first and find the message-list render loop. Introduce a narrator-line derivation from `DM_INVITE_ACCEPTED` facts — which live on the `Channel` record as `createdBy` + acceptance. Because Phase 1.5 doesn't ship a dedicated fact stream to the client, we use a lightweight derivation from `channels`:

Near the top of `ChatView.tsx`, add:

```typescript
import { NarratorLine } from './NarratorLine';
import { ChannelTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';

interface NarratorItem { kind: 'talking' | 'scheming' | 'alliance'; text: string; timestamp: number; id: string; }

function useNarratorLines(): NarratorItem[] {
  const channels = useGameStore(s => s.channels);
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const items: NarratorItem[] = [];

  for (const ch of Object.values(channels)) {
    if (ch.type === ChannelTypes.DM) {
      const accepted = (ch.memberIds || []).length >= 2 && (ch.pendingMemberIds || []).length === 0;
      if (!accepted || !ch.createdBy || ch.createdBy === playerId) continue;
      const inviter = roster[ch.createdBy];
      if (!inviter) continue;
      items.push({
        id: `talk-${ch.id}`, kind: 'talking', timestamp: ch.createdAt,
        text: `${inviter.personaName} started talking to someone`,
      });
    }
    if (ch.type === ChannelTypes.GROUP_DM) {
      const memberCount = (ch.memberIds || []).length;
      if (memberCount >= 4) {
        const leader = roster[ch.createdBy || ''];
        items.push({
          id: `alliance-${ch.id}`, kind: 'alliance', timestamp: ch.createdAt,
          text: `${memberCount} players formed an alliance${leader ? ` headed by ${leader.personaName}` : ''}`,
        });
      } else if (memberCount >= 2) {
        const [a, b] = (ch.memberIds || []).map(id => roster[id]?.personaName?.split(' ')[0]).filter(Boolean);
        if (a && b) {
          items.push({
            id: `scheme-${ch.id}`, kind: 'scheming', timestamp: ch.createdAt,
            text: `${a} and ${b} started scheming`,
          });
        }
      }
    }
  }

  // Rate-limit: one narrator line per minute max (keep most recent within each minute window)
  const buckets = new Map<number, NarratorItem>();
  for (const item of items.sort((a, b) => a.timestamp - b.timestamp)) {
    const bucket = Math.floor(item.timestamp / 60000);
    if (!buckets.has(bucket)) buckets.set(bucket, item);
  }
  return Array.from(buckets.values());
}
```

Then interleave with chat messages by timestamp in the render loop. Replace the existing `messages.map(...)` render with a merged-by-timestamp walk:

```typescript
const narratorLines = useNarratorLines();
const merged: Array<{ kind: 'msg'; msg: ChatMessage } | { kind: 'narrator'; item: NarratorItem }> = [
  ...messages.map(m => ({ kind: 'msg' as const, msg: m })),
  ...narratorLines.map(n => ({ kind: 'narrator' as const, item: n })),
].sort((a, b) => {
  const ta = a.kind === 'msg' ? a.msg.timestamp : a.item.timestamp;
  const tb = b.kind === 'msg' ? b.msg.timestamp : b.item.timestamp;
  return ta - tb;
});

// In JSX:
{merged.map(x =>
  x.kind === 'narrator'
    ? <NarratorLine key={x.item.id} kind={x.item.kind} text={x.item.text} />
    : <MessageRow key={x.msg.id} msg={x.msg} />
)}
```

Adjust `MessageRow` to the existing component ChatView uses (it's likely named differently — check the file).

- [ ] **Step 7.3: Delete the PulseBar presence fallback block**

In `apps/client/src/shells/pulse/components/PulseBar.tsx`, replace lines 22-188 (the entire `if (pills.length === 0) { ... return (...); }` block) with:

```typescript
  if (pills.length === 0) return null;
```

Keep the pills-rendering return statement (lines 191-213) untouched.

- [ ] **Step 7.4: Delete Ticker and remove its usage**

```bash
rm apps/client/src/shells/pulse/components/Ticker.tsx
```

In `apps/client/src/shells/pulse/PulseShell.tsx`:
- Remove `import { Ticker } from './components/Ticker';`
- Remove the `<Ticker />` element.

Search for other references:

```bash
cd /Users/manu/Projects/pecking-order && grep -rn "components/Ticker" apps/client/src
```

Expected: no results.

- [ ] **Step 7.5: Build + type check**

```bash
cd /Users/manu/Projects/pecking-order/apps/client && npm run build
```

Expected: clean. Fix type errors in ChatView if the merged-render refactor broke anything.

- [ ] **Step 7.6: Multi-player playtest**

- No ticker bar at the top
- Cast Strip sits directly under the header
- PulseBar shows only when cartridges are active (no more HERE presence row)
- When A accepts B's DM invite → "{B} started talking to someone" appears inline in main chat (coral italic)
- When a group of 2+ is created → "Daisy and Brick started scheming" (purple italic)
- When a group of 4+ is created → "4 players formed an alliance headed by X" (gold italic)
- No more than one narrator line per minute window

**Validation prompt for user** (per amendment / Phase 2 backlog flag): observe whether the 2=scheming / 4+=alliance thresholds feel right with real players. If they fire too often or feel arbitrary, capture the feel and propose new thresholds — do not lock these in without real-game feedback.

- [ ] **Step 7.7: Commit**

```bash
git add -A apps/client/src/shells/pulse/
git commit -m "$(cat <<'EOF'
refactor(pulse): delete Ticker + presence block, add inline narrator lines

Ticker.tsx is removed entirely — its content moved to pulse bar pills
(game state) and inline NarratorLine entries in chat for social moments.
PulseBar's HERE presence fallback is deleted now that CastStrip owns
presence. Narrator lines are derived client-side from channel state
(DM_INVITE_ACCEPTED + group creation) with a one-per-minute rate limit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**STOP — ask user to confirm milestone before moving to Task 8.**

---

## Task 8: Shell Rewiring Cleanup + Move Legacy to `_legacy/`

**Amendment 3:** Do NOT `rm` orphaned files — move them to `apps/client/src/shells/pulse/_legacy/` and stop importing them. Final deletion happens only after Task 9 passes and the user signs off.

**Avatar popover decision (Option A — spec-honoring):** If the user approved Option A in the Pre-Task-1 amendments (retire AvatarPopover for chat avatars; Silver/Nudge via slash commands), include Step 8.3 below. If Option B was chosen, skip 8.3.

**Files:**
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx` (remove TabBar; tidy imports)
- Modify: `apps/client/src/shells/pulse/components/chat/*` (chat avatar tap → openDM directly; drop AvatarPopover wiring) — only if Option A
- Move to `_legacy/`: `TabBar.tsx`, `cast/CastGrid.tsx` (+ subdir contents), `dm/DMView.tsx`, `dm/GroupDMView.tsx`, `popover/AvatarPopover.tsx` (only if Option A)

- [ ] **Step 8.1: Remove TabBar usage**

In `PulseShell.tsx`:
- Remove `import { TabBar } from './components/TabBar';`
- Remove `const [activeTab, setActiveTab] = useState<'chat' | 'cast'>('chat');`
- Remove `<TabBar activeTab={activeTab} onTabChange={setActiveTab} />`
- Replace `{activeTab === 'chat' ? <ChatView /> : <CastGrid />}` with `<ChatView />`.

- [ ] **Step 8.2: Move orphans to `_legacy/`**

```bash
cd /Users/manu/Projects/pecking-order/apps/client/src/shells/pulse
mkdir -p _legacy
git mv components/TabBar.tsx _legacy/TabBar.tsx
git mv components/cast _legacy/cast
git mv components/dm/DMView.tsx _legacy/DMView.tsx
git mv components/dm/GroupDMView.tsx _legacy/GroupDMView.tsx
```

Confirm no dangling imports:

```bash
cd /Users/manu/Projects/pecking-order && grep -rn "TabBar\|CastGrid\|components/dm/DMView\|components/dm/GroupDMView" apps/client/src/shells/pulse --include="*.ts" --include="*.tsx" | grep -v _legacy
```

Expected: no results outside `_legacy/`.

- [ ] **Step 8.3 (Option A only): Retire AvatarPopover on chat avatars**

Change the chat message avatar/name-plate tap handlers in `apps/client/src/shells/pulse/components/chat/*` to call `openDM(targetId)` directly instead of `openAvatarPopover`. Silver/Nudge are reachable via `/silver` and `/nudge` slash commands (already implemented in `PulseInput`).

Then move the popover:

```bash
cd /Users/manu/Projects/pecking-order/apps/client/src/shells/pulse
git mv components/popover/AvatarPopover.tsx _legacy/AvatarPopover.tsx
```

Remove the `openAvatarPopover` entry from `PulseContext` in `PulseShell.tsx` (and the associated `popover` state + `<AvatarPopover>` render). Keep `openSendSilver` / `openNudge` / their sheets — they're still reachable from the slash-command flow.

Grep to confirm no callers remain:

```bash
grep -rn "openAvatarPopover\|AvatarPopover" apps/client/src/shells/pulse --include="*.ts" --include="*.tsx" | grep -v _legacy
```

Expected: no results outside `_legacy/`.

If Option B was chosen, skip this step and wire Cast Strip chips to open the popover instead of `openDM` (requires reverting Task 3.3 `handleTap`).

- [ ] **Step 8.4: Final build + type check**

```bash
cd /Users/manu/Projects/pecking-order && npm run build
```

Expected: clean across all apps.

- [ ] **Step 8.5: Commit**

```bash
git add -A apps/client/src/shells/pulse/
git commit -m "$(cat <<'EOF'
chore(pulse): park TabBar + DMView/GroupDMView/CastGrid under _legacy/

Moves Phase 1 components superseded by DmSheet, SocialPanel, and the
Cast Strip into _legacy/ rather than deleting — kept as a safety net
until the Task 9 playtest gate passes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8.6: Post-Task-9 final deletion (deferred — DO NOT run until user explicitly approves after Task 9 passes)**

```bash
cd /Users/manu/Projects/pecking-order/apps/client/src/shells/pulse
rm -r _legacy
git add -A
git commit -m "chore(pulse): delete _legacy/ after Phase 1.5 playtest pass"
```

**STOP — ask user to confirm milestone before moving to Task 9.**

---

## Task 9: Full Integration Test Pass

No new code. Exercise the entire Pulse Phase 1.5 surface via multi-player browser test and fix any regression that surfaces. User will drive the test list; the following is the recommended end-to-end golden path:

- [ ] **Step 9.1: Verify dev server CWD**

```bash
lsof -i :5173 :8787 | grep LISTEN
# for each pid: lsof -p <pid> | grep cwd
```

Confirm both dev servers run from `/Users/manu/Projects/pecking-order` (or the canonical worktree for this branch).

- [ ] **Step 9.2: Create a test game with pulse shell**

Use the `/create-game` skill with `shell=pulse`, players=4. Save the magic links for 4 personas.

- [ ] **Step 9.3: Clear browser state**

In each new page, before first nav:

```javascript
Object.keys(localStorage).forEach(k => { if (k.startsWith('po_')) localStorage.removeItem(k); });
document.cookie.split(';').forEach(c => {
  const eq = c.indexOf('=');
  const name = eq > -1 ? c.substr(0, eq).trim() : c.trim();
  if (name.startsWith('po_')) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
});
```

Append `?noRecover=1` to the first nav URL.

- [ ] **Step 9.4: Open 4 isolated browser contexts**

Use `mcp__chrome-devtools__new_page` with `isolatedContext=<persona-name>` for each. Navigate each to its magic link.

- [ ] **Step 9.5: Golden path checklist**

Walk through:
- [ ] All 4 players see each other on Cast Strip, self pinned first
- [ ] Leader (highest silver) has gold halo + crown
- [ ] A taps B → DM sheet opens with hero + bio quote + empty state
- [ ] A sends "hey" → appears; B sees unread pip on A's chip
- [ ] B taps A's chip → DM sheet opens, message visible, A's chip returns to online
- [ ] Typing in A's DM → B sees typing dots badge on A's chip
- [ ] A taps ✎ → picking banner appears; A picks C and D → CTA "Start group with 2"
- [ ] A taps CTA → group channel appears; C and D each see it in their Cast Strip
- [ ] Inline narrator line "A and C started scheming" appears in chat (color = purple)
- [ ] A taps ☰ → Social panel opens, shows podium, standings, conversations (A↔B DM + group)
- [ ] B's panel shows the A↔B DM thread with preview
- [ ] With a `requireDmInvite` test manifest: C sends A an invite; A sees pulsing orange chip + invite in Social panel; Accept works; narrator line fires
- [ ] Decline from the invite row → chip disappears; DM sheet does not open
- [ ] Deplete DM slots (create max partners) → ✎ becomes muted; tapping a non-DM'd chip shakes + toasts
- [ ] No ticker, no HERE bar, no tabs
- [ ] PulseBar appears only when cartridges are active

- [ ] **Step 9.6: Capture session outcome**

Report findings to user. If any item fails, file it as a follow-up issue OR fix inline (user's call). Do NOT merge or push.

- [ ] **Step 9.7: Ask user for merge/push authorization**

Before any `git push` or PR: ask explicitly. Honor user's workflow rule.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Empty-content `sendFirstMessage` rejected by server in StartPickedCta | Step 6.4 notes fallback: open sheet with no channel and let user send a real message via DmInput |
| Group channel not visible immediately after `createGroupDm` (SYNC lag) | CTA still exits picking mode and UI self-corrects on next SYNC; accept the lag |
| Narrator lines trigger on every mount because `channels.createdAt` doesn't rotate | One-per-minute bucketing in `useNarratorLines` caps surface; acceptable v1 behavior |
| `DmMessages` `markChannelRead` firing too often | Already gated by `[channelId, messages.length]` deps; if noisy in Sentry/logs, hoist to `useMemo` + visibility guard |
| Selector re-renders (useGameStore.getState() inside map) in ConversationsList | Step 5.4 already flags the hoist-if-needed fallback |
| Dev-server running from wrong worktree after branch switch | Step 9.1 enforces CWD check |
| Cookie/token stale recovery loop on fresh test browser | Step 9.3 clearing recipe + `?noRecover=1` |

---

## Self-Review

**Spec coverage:** Walked through each spec section:
- §1 Cast Strip → Task 3 (state vocabulary, sort priorities, leader treatment, interaction rule)
- §2 Unified DM View → Task 4 (hero, gallery, bio quote, empty state, pending states, group variant, `/silver /nudge /whisper` live inside sheet via DmInput — slash wiring reuses existing PulseInput patterns if user extends later; v1 input is plain text which matches spec's "same markup as the outer input" baseline)
- §3 Social Panel → Task 5 (standings hero with podium, pending invites, conversations)
- §4 Header → Tasks 5+6 (PanelButton, ComposeButton with slot pip, PulseHeader)
- §5 Creation Flow → Task 6 (picking mode, 1-vs-2+ CTA, slot exhaustion muted state)
- §6 Ticker Replacement → Task 7 (NarratorLine + Ticker deletion)
- §7 Interaction Grammar → honored via single `handleTap`/`onTap` contract in Cast Strip, Podium, StandingsRest, ConversationsList all calling `openDM`
- §8 Motion → only pending pulses; scrim/sheet springs match spec's 0.28s cubic-bezier
- §9 Data Additions → Task 1 (exact field names: lastReadTimestamp, pendingDmInvites via selectors, dmSlotsUsed/Max via existing selectDmSlots, markChannelRead) + Task 2 (acceptDm/declineDm)
- §10 Components → file list in File Structure above covers all listed paths
- §11 Deferred → explicitly excluded at top of plan
- §12 Success Criteria → Task 9 checklist targets all items

**Type consistency:** `selectStandings` returns `{id, player, rank}`. `CastStripEntry` shape used consistently across CastChip/GroupChip/CastStrip. `openDM(id, isGroup?)` signature used everywhere. `engine.acceptDm/declineDm` returns void and takes `channelId: string` consistently across DmPendingState and InviteRow.

**Gaps found and closed:** Added a fallback note for empty-content `sendFirstMessage` (Task 6.4). Added the PulseContext signature change (openDM gains isGroup; openSocialPanel added) in Task 3.4 so it's present before any later task relies on it.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-12-pulse-phase-1.5.md`.

Two execution options — **but the user has a saved preference against subagent-driven implementation on this branch**, so option 1 is effectively disabled:

1. **Subagent-Driven** — disabled per user preference (`feedback_no_subagent_implementation`).
2. **Inline Execution (use this)** — drive tasks in the main session; stop and ask for approval at the end of each top-level Task. Use `superpowers:executing-plans` as the companion skill.

**Proposed:** proceed with inline execution starting at Task 1 once the user approves this plan.
