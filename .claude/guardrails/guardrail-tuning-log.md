# Guardrails Needing Update / Promotion

## Resolved 2026-04-16 (noise-reduction pass)

- `finite-reactions-not-persisted` — **deleted**. Premise became false once
  `feature/pulse-shell-phase1` merged to main (d65af1b); `Events.Social.REACT`,
  L3 handler, and SYNC delivery are all live.
- `finite-zustand-selector-fresh-objects` — added `MATCH_CONTENT` requiring
  one of: `memoSelector(`, `export const|function select`, `useGameStore(... => {|[`,
  `useShallow(`. Skips bare field-access selectors like `useGameStore(s => s.foo)`.
- `finite-stableref-for-mutable-fields` — added `MATCH_CONTENT` requiring one of:
  `stableRef(`, a collection field used as an object key (`chatLog:`,
  `channels:`, etc.), `Events.System.SYNC`, or the `sync: (data` reducer
  signature. Skips action-only or interface-only edits.
- `finite-inject-timeline-silent-noop` — added `MATCH_CONTENT` requiring a
  spawn action name, a `manifest.(game|activity|dilemma)Type` read, or the
  `INJECT_TIMELINE_EVENT` keyword. Skips unrelated edits to those action files.
- `broad-machines-read-specs` — added `MATCH_CONTENT` requiring structural
  markers (`createMachine(`, `setup(`, `initial:`, `states: {`, `invoke: {`).
  Skips handler/guard-only edits.
- `finite-dev-server-wrong-worktree` — removed bare `vite( |$)` match that
  caught `vite build`. Still fires on `lsof`, `npm run dev`, `wrangler dev`.
- `finite-narrator-lines-fact-driven` — added `MATCH_CONTENT` requiring a
  narrator-adjacent symbol (`useNarratorLines`, `SOCIAL_INVITE`, `NarratorLine`,
  `channels.filter`, `createdBy`, `memberIds.length`, `factToTicker`).
  Phase 4 T13 session had it firing ~6× on unrelated ChatView edits.
- `finite-invite-mode-pending-members` — added `MATCH_CONTENT` requiring
  `pendingMemberIds`, `.memberIds`, `addChannelMember`, `createChannel`,
  `emitChatFact`, `emitInitialDmInvite`, `requireDmInvite`, or `ACCEPT_DM`.
  Phase 4 T8–T10 had it firing ~5× on unrelated push-triggers edits.
- `finite-cartridge-theme-color-keys` — rule was a silent no-op due to a PCRE
  lookahead in BSD grep and a content pattern in the wrong field. Moved the
  pattern to `MATCH_CONTENT`, added a proper file-scope `MATCH_PATTERN` for
  `packages/game-cartridges/` and `apps/client/src/cartridges/`, and rewrote
  the lookahead `colors[(?!.*|)` as the positive class `colors[[^|]+]`.

## Resolved 2026-04-15

- `finite-pulse-bio-as-stereotype` — narrowed MATCH_PATTERN to
  `(CastCard|DmHero|DmBioQuote|PlayerProfile).*\.tsx$` (option B).
- `finite-stableref-for-mutable-fields` — added skip-if preamble to advisory
  (option 4). Superseded by the 2026-04-16 content-aware gate.
- `finite-zustand-selector-fresh-objects` — added skip-if preamble to advisory
  (option C). Superseded by the 2026-04-16 content-aware gate.

## Still pending (low urgency)

### `broad-commit-check-artifacts` — fires on every `git commit`

Advisory is short (5 lines) and the guardian only applies `MATCH_CONTENT`
to Edit/Write tools, not Bash. There's no clean way to gate Bash-side on the
diff without shelling out. Options if this becomes noisy: shorten further to a
single line, or refactor the guardian to support a `MATCH_SHELL_CHECK` hook
that runs a quick shell predicate before firing.

### `finite-ticker-update-not-sync` — `MATCH_PATTERN: ticker|Ticker|TICKER`

Matches any file path containing "ticker" in any case. In practice this is
narrow enough (only ticker-related files have the substring) and the advisory
is short (4 lines). Not currently a noise source. Leave as-is unless it starts
firing on unrelated work.
