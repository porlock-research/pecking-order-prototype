# Shell-Agnostic Fixes + V2 Groundwork — Design

**Date**: 2026-03-10
**Branch**: New feature branch off `main`
**Reference shell**: Immersive (for testing/validation)

**Goal**: Fix playtest bugs and lay V2 groundwork — all changes are shell-agnostic and carry forward to any future shell or native app.

**Sources**:
- `plans/issues/playtest-feedback.md` (PT1-BUG-003, PT1-UX-002, PT1-UX-003)
- V2 product vision (`docs/plans/v2-vision.md`)

---

## 1. Admin Panel Auth (PT1-BUG-003)

**Problem**: Any authenticated user can access `/admin/*` routes and server actions (`getAllGames`, `cleanupGame`).

**Design**:
- Store `SUPER_ADMIN_IDS` as a Cloudflare Pages environment variable (comma-separated user IDs)
- No hardcoded values — rotatable via dashboard without redeployment
- Middleware: valid session + user ID in super admin list → allow `/admin/*`, otherwise 403
- Server actions (`getAllGames`, `cleanupGame`, etc.): verify super admin before executing
- Future: replace allowlist with a roles table in D1

**Files**:
- Modify: `apps/lobby/middleware.ts`
- Modify: `apps/lobby/app/actions.ts` (admin-facing server actions)
- Add: super admin check utility

---

## 2. Sort Alive Players by Silver (PT1-UX-002)

**Problem**: Alive players list has no meaningful ordering. Players want to see the economic meta-game.

**Design**:
- Store-level computed sort: alive players by `silver` descending
- Tie-breaker: alphabetical by `personaName`
- Eliminated players: keep current ordering (elimination order)
- All shells benefit automatically — sorting happens in the shared store/selector layer

**Files**:
- Modify: `apps/client/src/store/useGameStore.ts` (or shared selector utility)

---

## 3. Bios in L2 Roster (PT1-UX-003)

**Problem**: `bio` exists in `RosterPlayerSchema` and SYNC payload, but `l2-initialization.ts` doesn't copy it to the internal L2 roster. May be lost on snapshot restore.

**Design**:
- Add `bio` field to internal roster mapping in `l2-initialization.ts`
- Verify bio survives snapshot restore (already in schema, just not copied)
- Client already receives bio via SYNC — shells can render it (shell-specific work, not in this scope)

**Files**:
- Modify: `apps/game-server/src/machines/actions/l2-initialization.ts`

---

## 4. DM Invitation Model (V2)

**Problem**: DMs are lazy-created on first message — no consent from recipient. V2 requires explicit invitation + acceptance, with a 5-conversation-per-day limit.

**Design**:

### New Events (shared-types)
- `SOCIAL.INVITE_DM` — sender invites recipient(s) to a DM/group DM
- `SOCIAL.ACCEPT_DM` — recipient accepts an invitation
- `SOCIAL.DECLINE_DM` — recipient declines an invitation

### L3 Context Additions
- `pendingInvites: Record<string, PendingInvite[]>` — invites awaiting response, keyed by recipient
- `acceptedConversationsByPlayer: Record<string, number>` — count of accepted conversations per player per day
- `maxConversationsPerDay: number` — default 5, configurable via manifest

### Flow
1. Player A sends `SOCIAL.INVITE_DM` targeting Player B
2. L3 creates a `PendingInvite` record (sender, recipient, channelId, timestamp)
3. Player B receives invite via SYNC update
4. Player B sends `SOCIAL.ACCEPT_DM` or `SOCIAL.DECLINE_DM`
5. On accept: channel created, both players' conversation count increments
6. On decline: invite removed, sender notified

### Guards
- Sender has < 5 accepted conversations → allow invite
- Recipient has < 5 accepted conversations → allow accept
- Duplicate invite to same player → reject
- MAIN / group chat don't count toward the 5 limit

### Group DMs
- Creator invites N members, each must individually accept
- Channel activates once all invitees have responded (or after a timeout)
- Each member's conversation count incremented on accept

### Migration
- Existing `SOCIAL.SEND_MSG` to new partner: rejected with new reason `'INVITE_REQUIRED'`
- Existing `SOCIAL.CREATE_CHANNEL` for group DMs: becomes `SOCIAL.INVITE_DM` with multiple recipients

**Files**:
- Modify: `packages/shared-types/src/events.ts` (new event constants)
- Modify: `packages/shared-types/src/index.ts` (PendingInvite type, new rejection reason)
- Modify: `apps/game-server/src/machines/l3-session.ts` (context, transitions)
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` (invite/accept/decline handlers)
- Modify: `apps/game-server/src/ws-handlers.ts` (allowlist new events)

---

## 5. Skinnable Cartridges (CartridgeTheme Contract)

**Problem**: Canvas game renderers use hardcoded hex colors. Some Tailwind classes assume dark theme. Cartridge UIs can't adapt to different shells or future native apps.

**Design**:

### CartridgeTheme Interface
```typescript
interface CartridgeTheme {
  colors: {
    gold: string;
    pink: string;
    danger: string;
    green: string;
    bg: string;
    bgSubtle: string;
    border: string;
    text: string;
    textDim: string;
  };
  radius: { sm: string; md: string; lg: string };
  opacity: { subtle: number; medium: number; strong: number };
  animation: { duration: string; easing: string };
}
```

### Architecture
- Shell provides a `CartridgeTheme` via React context
- Cartridge renderers consume theme from context (not CSS classes)
- Canvas renderers read JS theme object at init (no CSS variable lookups at render time)
- React components use theme tokens for colors/borders/backgrounds
- Default theme matches current visuals exactly (no visual regression)

### Migration Path
- Replace hardcoded hex in canvas renderers with `theme.colors.*`
- Replace `white/[0.06]` patterns with `theme.opacity.subtle` + `theme.colors.border`
- Move vote/cartridge strip gradients to theme-provided values
- Immersive shell provides the default theme (current look)

### Native Portability
- `CartridgeTheme` is a plain typed object — implementable in SwiftUI/Kotlin
- Cartridge logic already cross-platform via `packages/game-cartridges`
- Theme contract becomes the visual bridge between platforms

**Files**:
- Create: `packages/ui-kit/src/cartridge-theme.ts` (interface + default theme)
- Create: `apps/client/src/cartridges/CartridgeThemeContext.tsx` (React context + provider)
- Modify: `apps/client/src/cartridges/games/**/*Renderer.tsx` (canvas renderers)
- Modify: `apps/client/src/cartridges/voting/*.tsx` (theme token consumption)
- Modify: `apps/client/src/cartridges/prompts/*.tsx` (theme token consumption)
- Modify: `apps/client/src/index.css` (remove hardcoded gradients where replaced by theme)
- Modify: Shell entry points to wrap cartridge area with `CartridgeThemeProvider`

---

## Out of Scope

- V2 shell UX (Camp Fire, Schedule, WTF tabs) — separate design
- Shell-specific chat/roster bug fixes (PT1-BUG-001, PT1-BUG-002)
- Character creation system
- Daily character budget (already implemented via Game Master `PER_ACTIVE_PLAYER` scaling)
- Onboarding/tutorial flow
