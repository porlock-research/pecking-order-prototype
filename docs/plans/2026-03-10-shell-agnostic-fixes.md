# Shell-Agnostic Fixes + V2 Groundwork — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 playtest bugs and lay V2 groundwork (DM invitations, skinnable cartridges) — all shell-agnostic, carrying forward to any future shell or native app.

**Architecture:** Server-side fixes (admin auth, bios, DM model) in lobby/game-server. Client-side (silver sorting, cartridge theming) in shared store and new CartridgeTheme contract. **No shell-specific code** — all shells consume the same store/payload/context. CartridgeThemeProvider wraps at ShellLoader level.

**Tech Stack:** Next.js 15 (lobby), XState v5 (game-server), Zustand (client store), Tailwind + CSS variables (theming)

**Design doc:** `docs/plans/2026-03-10-shell-agnostic-fixes-design.md`

---

### Task 1: Create Feature Branch

**Files:**
- None (git only)

**Step 1: Create and switch to feature branch**

```bash
cd /Users/manu/Projects/pecking-order
git checkout main
git checkout -b feature/shell-agnostic-fixes
```

**Step 2: Verify clean state**

```bash
git status
```
Expected: clean working tree on `feature/shell-agnostic-fixes`

---

### Task 2: Admin Panel Auth — Super Admin Gate (PT1-BUG-003)

**Files:**
- Create: `apps/lobby/app/lib/auth.ts`
- Modify: `apps/lobby/middleware.ts`
- Modify: `apps/lobby/app/actions.ts` (getAllGames, cleanupGame)
- Modify: `apps/lobby/wrangler.toml` or `.dev.vars` (add SUPER_ADMIN_IDS for local dev)

**Context:**
- Middleware currently only checks for a session cookie — any logged-in user can access `/admin/*`
- `getAllGames()` and `cleanupGame()` have no auth checks
- `host_user_id` is stored in GameSessions but unused for access control
- Session is retrieved via `getSession()` which returns `{ userId, email }` from D1

**Step 1: Create super admin utility**

Create `apps/lobby/app/lib/auth.ts`:

```typescript
import { getSession } from '../actions';

/**
 * Check if the current user is a super admin.
 * SUPER_ADMIN_IDS is a comma-separated list of user IDs
 * set as a Cloudflare Pages environment variable.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session?.userId) return false;

  const { getEnv } = await import('../actions');
  const env = await getEnv();
  const adminIds = ((env.SUPER_ADMIN_IDS as string) || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  return adminIds.includes(session.userId);
}

export async function requireSuperAdmin(): Promise<void> {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    throw new Error('Forbidden: Super admin access required');
  }
}
```

Note: Check how `getSession()` and `getEnv()` are exported from `actions.ts`. You may need to adjust the imports. `getSession()` reads the session cookie and looks up the user in D1. `getEnv()` returns Cloudflare's `env` bindings.

**Step 2: Update middleware to block non-admins from `/admin/*`**

Modify `apps/lobby/middleware.ts`. The middleware runs on the edge and doesn't have access to D1 directly, so we can't check super admin status here. Instead, we keep the session check in middleware (prevents unauthenticated access) and add the super admin check in the admin page layout.

Create or modify `apps/lobby/app/admin/layout.tsx` to add the server-side super admin check:

```typescript
import { isSuperAdmin } from '../lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    redirect('/');
  }
  return <>{children}</>;
}
```

This gates ALL `/admin/*` routes at the layout level. If the user has a valid session but isn't a super admin, they get redirected home.

**Step 3: Add super admin check to server actions**

In `apps/lobby/app/actions.ts`, add guard to `getAllGames()` and `cleanupGame()`:

```typescript
import { requireSuperAdmin } from './lib/auth';

export async function getAllGames() {
  await requireSuperAdmin();
  // ... existing implementation unchanged
}

export async function cleanupGame(gameId: string) {
  await requireSuperAdmin();
  // ... existing implementation unchanged
}
```

Apply the same pattern to any other admin-only server actions you find.

**Step 4: Add SUPER_ADMIN_IDS to local dev**

Add to `apps/lobby/.dev.vars` (or create it if it doesn't exist):

```
SUPER_ADMIN_IDS=your_user_id_here
```

Find your user ID by checking the D1 `Users` table or the session cookie payload.

For staging/production: set via Cloudflare Pages dashboard → Settings → Environment Variables.

**Step 5: Build and verify**

```bash
cd apps/lobby && npm run build
```
Expected: no type errors

**Step 6: Manual test**

1. Start lobby: `cd apps/lobby && npm run dev`
2. Log in as a super admin → navigate to `/admin` → should load
3. Log in as a non-admin user → navigate to `/admin` → should redirect to `/`
4. Call `cleanupGame()` as non-admin → should throw "Forbidden"

**Step 7: Commit**

```bash
git add apps/lobby/app/lib/auth.ts apps/lobby/middleware.ts apps/lobby/app/admin/layout.tsx apps/lobby/app/actions.ts
git commit -m "feat(lobby): gate admin panel behind SUPER_ADMIN_IDS env var

Adds super admin allowlist via Cloudflare Pages env var.
Admin layout redirects non-admins. Server actions throw on unauthorized access.
Fixes PT1-BUG-003."
```

---

### Task 3: Sort Alive Players by Silver (PT1-UX-002)

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`

**Context:**
- `roster` is `Record<string, SocialPlayer>` in the Zustand store
- `SocialPlayer` has `status: 'ALIVE' | 'ELIMINATED'`, `silver: number`, `personaName: string`
- Shells read roster directly from store — a shared selector benefits all shells equally
- **No shell code touched** — shells adopt this selector when they're ready

**Step 1: Add sorted player selector**

In `apps/client/src/store/useGameStore.ts`, add a selector that returns players sorted by silver:

```typescript
/** Alive players sorted by silver (descending), then by name. Eliminated sorted by name. */
export const selectSortedPlayers = (state: GameState) => {
  const entries = Object.entries(state.roster);
  const alive = entries
    .filter(([, p]) => p.status === 'ALIVE')
    .sort(([, a], [, b]) => b.silver - a.silver || a.personaName.localeCompare(b.personaName));
  const eliminated = entries
    .filter(([, p]) => p.status === 'ELIMINATED')
    .sort(([, a], [, b]) => a.personaName.localeCompare(b.personaName));
  return { alive, eliminated };
};
```

**Step 2: Build and verify**

```bash
cd apps/client && npx vite build
```
Expected: no type errors

**Step 3: Commit**

```bash
git add apps/client/src/store/useGameStore.ts
git commit -m "feat(client): add selectSortedPlayers selector — silver descending (PT1-UX-002)

Shared store selector. No shell code touched — shells adopt when ready."
```

---

### Task 4: Bios in L2 Roster (PT1-UX-003)

**Files:**
- Modify: `apps/game-server/src/machines/actions/l2-initialization.ts`
- Test: `apps/game-server/src/machines/__tests__/` (existing or new test)

**Context:**
- `RosterPlayerSchema` in shared-types has `bio: z.string()`
- InitPayload passes `bio` from lobby to game server
- `l2-initialization.ts` builds an internal roster but drops `bio` — only copies `personaName`, `avatarUrl`, `status`, `silver`, `gold`, `realUserId`
- The SYNC payload sends `snapshot.context.roster` directly — so if bio is in the L2 roster, it reaches clients automatically

**Step 1: Write failing test**

In `apps/game-server/src/machines/__tests__/`, create or extend a test file:

```typescript
import { describe, it, expect } from 'vitest';

describe('L2 initialization', () => {
  it('preserves bio field from InitPayload in roster', () => {
    // Create a mock SYSTEM.INIT event with bio in roster
    const initEvent = {
      type: 'SYSTEM.INIT',
      gameId: 'test-game',
      payload: {
        roster: {
          p0: {
            personaName: 'Test Player',
            avatarUrl: 'https://example.com/avatar.png',
            bio: 'A mysterious stranger',
            isAlive: true,
            isSpectator: false,
            silver: 100,
            gold: 0,
            realUserId: 'user_123',
            destinyId: 'dest_1',
          },
        },
        manifest: { kind: 'STATIC', mode: 'CONFIGURABLE_CYCLE', days: [] },
      },
    };

    // Run the initialization action's roster mapping logic
    // Extract the roster builder from l2InitializationActions.initializeContext
    // and verify bio is preserved
    const roster = buildInternalRoster(initEvent);
    expect(roster.p0.bio).toBe('A mysterious stranger');
  });
});
```

Note: You'll need to extract the roster-building logic into a testable function, or test via actor creation. Match the project's existing test patterns in `apps/game-server/src/machines/__tests__/`.

**Step 2: Run test to verify it fails**

```bash
cd apps/game-server && npx vitest run --reporter=verbose 2>&1 | grep -A 2 "bio"
```
Expected: FAIL — `bio` is undefined

**Step 3: Add bio to internal roster mapping**

In `apps/game-server/src/machines/actions/l2-initialization.ts`, find the roster loop:

```typescript
internalRoster[id] = {
  id,
  personaName: p.personaName,
  avatarUrl: p.avatarUrl,
  status: p.isAlive ? PlayerStatuses.ALIVE : PlayerStatuses.ELIMINATED,
  silver: p.silver,
  gold: p.gold || 0,
  realUserId: p.realUserId || '',
};
```

Add the `bio` field:

```typescript
internalRoster[id] = {
  id,
  personaName: p.personaName,
  avatarUrl: p.avatarUrl,
  bio: p.bio || '',
  status: p.isAlive ? PlayerStatuses.ALIVE : PlayerStatuses.ELIMINATED,
  silver: p.silver,
  gold: p.gold || 0,
  realUserId: p.realUserId || '',
};
```

Also add `bio` to the `SocialPlayer` type in `packages/shared-types/src/index.ts` if it's not already there:

```typescript
interface SocialPlayer {
  id: string;
  personaName: string;
  avatarUrl: string;
  bio?: string;           // ← Add this
  status: "ALIVE" | "ELIMINATED";
  silver: number;
  gold: number;
  realUserId?: string;
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/game-server && npx vitest run --reporter=verbose 2>&1 | grep -A 2 "bio"
```
Expected: PASS

**Step 5: Build both packages**

```bash
cd /Users/manu/Projects/pecking-order && npm run build
```
Expected: no type errors across all packages

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-initialization.ts packages/shared-types/src/index.ts
git commit -m "fix(server): preserve bio field in L2 roster from InitPayload (PT1-UX-003)

Bio was in RosterPlayerSchema but dropped during L2 initialization.
Now flows through to SYNC payload so clients can render character bios."
```

---

### Task 5: DM Invitation Model

This is the largest task. Break into sub-steps: types first, then L3 machine, then client store.

**Files:**
- Modify: `packages/shared-types/src/events.ts` (new Social events)
- Modify: `packages/shared-types/src/index.ts` (PendingInvite type, new rejection reasons, DailyContext additions)
- Modify: `apps/game-server/src/machines/l3-session.ts` (context + transitions)
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` (invite/accept/decline actions + guards)
- Modify: `apps/game-server/src/ws-handlers.ts` (allowlist new events)
- Modify: `apps/client/src/store/useGameStore.ts` (pendingInvites in store)
- Test: `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts`

#### Sub-step 5a: Add types and events

**In `packages/shared-types/src/events.ts`**, add to the Social namespace:

```typescript
Social: {
  SEND_MSG: 'SOCIAL.SEND_MSG',
  SEND_SILVER: 'SOCIAL.SEND_SILVER',
  USE_PERK: 'SOCIAL.USE_PERK',
  CREATE_CHANNEL: 'SOCIAL.CREATE_CHANNEL',
  INVITE_DM: 'SOCIAL.INVITE_DM',         // ← new
  ACCEPT_DM: 'SOCIAL.ACCEPT_DM',         // ← new
  DECLINE_DM: 'SOCIAL.DECLINE_DM',       // ← new
},
```

Add new events to `ALLOWED_CLIENT_EVENTS`:

```typescript
export const ALLOWED_CLIENT_EVENTS = [
  Events.Social.SEND_MSG,
  Events.Social.SEND_SILVER,
  Events.Social.USE_PERK,
  Events.Social.CREATE_CHANNEL,
  Events.Social.INVITE_DM,       // ← new
  Events.Social.ACCEPT_DM,       // ← new
  Events.Social.DECLINE_DM,      // ← new
] as const;
```

**In `packages/shared-types/src/index.ts`**, add:

```typescript
// --- DM Invitation ---
export interface PendingInvite {
  id: string;                    // unique invite ID
  channelId: string;             // proposed channel ID (dm:X:Y or gdm:X:Y:Z)
  senderId: string;              // who sent the invite
  recipientIds: string[];        // who needs to accept
  acceptedBy: string[];          // who has accepted so far
  declinedBy: string[];          // who has declined
  timestamp: number;
  type: 'DM' | 'GROUP_DM';
}
```

Add to `DmRejectionReason`:

```typescript
export type DmRejectionReason =
  | 'DMS_CLOSED' | 'GROUP_CHAT_CLOSED'
  | 'PARTNER_LIMIT' | 'CHAR_LIMIT'
  | 'SELF_DM' | 'TARGET_ELIMINATED'
  | 'INSUFFICIENT_SILVER' | 'GROUP_LIMIT' | 'INVALID_MEMBERS'
  | 'INVITE_REQUIRED'            // ← new: tried to DM without invitation
  | 'CONVERSATION_LIMIT'         // ← new: at 5-conversation cap
  | 'DUPLICATE_INVITE';          // ← new: already invited this player
```

**Step: Build shared-types**

```bash
cd packages/shared-types && npm run build
```

**Step: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add DM invitation events, PendingInvite type, new rejection reasons"
```

#### Sub-step 5b: Write failing tests for DM invitation flow

Create `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { Events } from '@pecking-order/shared-types';

// Test cases to implement:

describe('DM Invitation Model', () => {
  // Helper: create L3 actor with roster of N players, DMs open

  describe('invite flow', () => {
    it('INVITE_DM creates a pending invite for the recipient', () => {
      // p0 invites p1 → pendingInvites should have entry for p1
    });

    it('rejects invite when DMs are closed', () => {
      // DMs not open → reject with DMS_CLOSED
    });

    it('rejects duplicate invite to same player', () => {
      // p0 invites p1 twice → second rejected with DUPLICATE_INVITE
    });

    it('rejects invite when sender at conversation limit', () => {
      // p0 has 5 accepted conversations → next invite rejected with CONVERSATION_LIMIT
    });

    it('rejects invite to eliminated player', () => {
      // target is eliminated → rejected with TARGET_ELIMINATED
    });
  });

  describe('accept flow', () => {
    it('ACCEPT_DM creates the channel and increments conversation count', () => {
      // p0 invites p1, p1 accepts → channel exists, both at 1 conversation
    });

    it('rejects accept when recipient at conversation limit', () => {
      // p1 has 5 conversations, tries to accept → rejected with CONVERSATION_LIMIT
    });
  });

  describe('decline flow', () => {
    it('DECLINE_DM removes the pending invite', () => {
      // p0 invites p1, p1 declines → pendingInvites empty
    });
  });

  describe('message guard', () => {
    it('rejects SEND_MSG to new partner without invitation', () => {
      // p0 sends DM to p1 without invite/accept → rejected with INVITE_REQUIRED
    });

    it('allows SEND_MSG on accepted channel', () => {
      // p0 invites p1, p1 accepts, p0 sends message → succeeds
    });
  });

  describe('group DM invitations', () => {
    it('INVITE_DM with multiple recipients creates group invite', () => {
      // p0 invites p1+p2 → pending invite with type GROUP_DM
    });

    it('group channel created when all recipients accept', () => {
      // p0 invites p1+p2, both accept → gdm channel created
    });

    it('each member conversation count incremented on accept', () => {
      // After accepting, each player's count goes up by 1
    });
  });

  describe('conversation limit', () => {
    it('default max is 5 conversations per player per day', () => {
      // Fill up 5 conversations → 6th invite rejected
    });

    it('MAIN channel does not count toward limit', () => {
      // MAIN exists but doesn't affect conversation count
    });
  });
});
```

Write the full test implementations based on the project's test patterns (create actor, send events, assert snapshot context). Reference `apps/game-server/src/machines/__tests__/l3-social-limits.test.ts` for the pattern.

**Step: Run tests to verify they fail**

```bash
cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invitations.test.ts --reporter=verbose
```
Expected: FAIL (functions not implemented)

**Step: Commit test file**

```bash
git add apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts
git commit -m "test(server): add failing tests for DM invitation model"
```

#### Sub-step 5c: Implement L3 invitation logic

**Modify `apps/game-server/src/machines/l3-session.ts`** — add to `DailyContext`:

```typescript
export interface DailyContext {
  // ... existing fields ...
  pendingInvites: PendingInvite[];
  acceptedConversationsByPlayer: Record<string, number>;
  maxConversationsPerDay: number;
}
```

Update `buildL3Context()`:

```typescript
pendingInvites: [],
acceptedConversationsByPlayer: {},
maxConversationsPerDay: input.manifest?.maxConversationsPerDay ?? 5,
```

Add transitions for the new events in the L3 machine's `active` state (or wherever SOCIAL events are handled):

```typescript
[Events.Social.INVITE_DM]: {
  guard: 'canInviteDm',
  actions: ['createPendingInvite', 'emitInviteFact'],
},
// ... with rejection alternative
[Events.Social.ACCEPT_DM]: {
  guard: 'canAcceptDm',
  actions: ['acceptInviteAndCreateChannel', 'emitAcceptFact'],
},
[Events.Social.DECLINE_DM]: {
  actions: ['declinePendingInvite'],
},
```

**Modify `apps/game-server/src/machines/actions/l3-social.ts`** — add:

1. `canInviteDm` guard — checks DMs open, not duplicate, sender not at limit, target alive
2. `createPendingInvite` action — adds PendingInvite to context
3. `canAcceptDm` guard — checks recipient not at limit, invite exists
4. `acceptInviteAndCreateChannel` action — removes invite, creates channel, increments both players' conversation count
5. `declinePendingInvite` action — removes invite, optionally notifies sender
6. Modify `isChannelMessageAllowed` guard — reject with `INVITE_REQUIRED` if DM channel doesn't exist (instead of lazy-creating)
7. Remove lazy DM channel creation from `processChannelMessage` — channels are only created via accept flow now

**Step: Run tests**

```bash
cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invitations.test.ts --reporter=verbose
```
Expected: ALL PASS

**Step: Run all tests to check for regressions**

```bash
cd apps/game-server && npx vitest run --reporter=verbose
```
Expected: ALL PASS. Existing DM tests may need updating since lazy creation is removed.

**Step: Build**

```bash
cd /Users/manu/Projects/pecking-order && npm run build
```

**Step: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts apps/game-server/src/machines/actions/l3-social.ts
git commit -m "feat(server): implement DM invitation model with 5-conversation limit

Players must invite → accept before DM channels are created.
Max 5 conversations per player per day. Group DMs require all members to accept.
Removes lazy DM channel creation."
```

#### Sub-step 5d: Update client store for invitations

**Modify `apps/client/src/store/useGameStore.ts`**:

Add to `GameState`:

```typescript
pendingInvites: PendingInvite[];
```

Update the `sync` action to populate `pendingInvites` from the SYNC payload.

Add selectors:

```typescript
/** Pending invites where current player is a recipient */
export const selectMyPendingInvites = (state: GameState) =>
  state.pendingInvites.filter(inv => inv.recipientIds.includes(state.playerId || ''));

/** Pending invites sent by current player */
export const selectMySentInvites = (state: GameState) =>
  state.pendingInvites.filter(inv => inv.senderId === state.playerId);
```

**Step: Build and commit**

```bash
cd apps/client && npx vite build
git add apps/client/src/store/useGameStore.ts
git commit -m "feat(client): add pendingInvites to store with selectors for invitation UI"
```

#### Sub-step 5e: Update WebSocket allowlist

**Modify `apps/game-server/src/ws-handlers.ts`** — verify the new events pass the allowlist check.

The allowlist in `handleMessage` checks `ALLOWED_CLIENT_EVENTS` (already updated in 5a) and also checks `event.type.startsWith(Events.Social.PREFIX)`. Verify `SOCIAL.INVITE_DM`, `SOCIAL.ACCEPT_DM`, `SOCIAL.DECLINE_DM` all start with `SOCIAL.` — they do, so they should pass. But double-check the prefix matching logic.

If `Events.Social.PREFIX` doesn't exist, the events need to be in `ALLOWED_CLIENT_EVENTS` (already added in 5a).

**Step: Commit if changes needed**

```bash
git add apps/game-server/src/ws-handlers.ts
git commit -m "fix(server): ensure DM invitation events pass WebSocket allowlist"
```

---

### Task 6: Skinnable Cartridges — CartridgeTheme Contract

**Files:**
- Create: `packages/ui-kit/src/cartridge-theme.ts`
- Create: `apps/client/src/cartridges/CartridgeThemeContext.tsx`
- Modify: `apps/client/src/cartridges/games/gap-run/GapRunRenderer.tsx` (example migration)
- Modify: `apps/client/src/shells/immersive/components/CartridgeWrapper.tsx` (provide theme)

**Context:**
- 48 cartridge files across voting/games/prompts
- Canvas renderers (8 files: GapRun, ColorMatch, GridPush, QuickMath, ReactionTime, Sequence, SimonSays, Stacker) use hardcoded hex
- React cartridge components use `skin-*` Tailwind classes (already ~95% themed)
- Two themes exist in `theme.css`: `reality-tv` and `cyberpunk`
- Goal: single typed interface that shells provide, renderers consume, portable to native

#### Sub-step 6a: Define CartridgeTheme interface and defaults

Create `packages/ui-kit/src/cartridge-theme.ts`:

```typescript
export interface CartridgeTheme {
  colors: {
    gold: string;
    pink: string;
    danger: string;
    green: string;
    orange: string;
    info: string;
    bg: string;
    bgSubtle: string;
    panel: string;
    border: string;
    text: string;
    textDim: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  opacity: {
    subtle: number;
    medium: number;
    strong: number;
  };
}

/**
 * Read current theme from CSS custom properties.
 * Call once at component mount, not per frame.
 */
export function resolveCartridgeTheme(element?: HTMLElement): CartridgeTheme {
  const el = element || document.documentElement;
  const style = getComputedStyle(el);
  const get = (prop: string) => style.getPropertyValue(prop).trim();

  return {
    colors: {
      gold: get('--po-gold') || '#fbbf24',
      pink: get('--po-pink') || '#ec4899',
      danger: get('--po-danger') || '#ef4444',
      green: get('--po-green') || '#10b981',
      orange: get('--po-orange') || '#f97316',
      info: get('--po-info') || '#818cf8',
      bg: get('--po-bg-deep') || '#0d0d12',
      bgSubtle: get('--po-bg-panel') || '#1a1a2e',
      panel: get('--po-bg-panel') || '#1a1a2e',
      border: get('--po-border') || 'rgba(255, 255, 255, 0.1)',
      text: get('--po-text') || '#ffffff',
      textDim: get('--po-text-dim') || '#d8b4fe',
    },
    radius: { sm: 4, md: 8, lg: 12 },
    opacity: { subtle: 0.06, medium: 0.15, strong: 0.4 },
  };
}

/** Hardcoded default theme for non-browser contexts (SSR, native, tests). */
export const DEFAULT_CARTRIDGE_THEME: CartridgeTheme = {
  colors: {
    gold: '#fbbf24',
    pink: '#ec4899',
    danger: '#ef4444',
    green: '#10b981',
    orange: '#f97316',
    info: '#818cf8',
    bg: '#0d0d12',
    bgSubtle: '#1a1a2e',
    panel: '#1a1a2e',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textDim: '#d8b4fe',
  },
  radius: { sm: 4, md: 8, lg: 12 },
  opacity: { subtle: 0.06, medium: 0.15, strong: 0.4 },
};
```

Export from `packages/ui-kit/src/index.ts` (or create it).

**Step: Build**

```bash
cd packages/ui-kit && npm run build
```
If no build script, verify the types compile: `npx tsc --noEmit`

**Step: Commit**

```bash
git add packages/ui-kit/src/cartridge-theme.ts
git commit -m "feat(ui-kit): add CartridgeTheme interface with CSS variable resolver and defaults"
```

#### Sub-step 6b: Create React context for cartridge theming

Create `apps/client/src/cartridges/CartridgeThemeContext.tsx`:

```typescript
import { createContext, useContext, useMemo, useRef, useEffect, useState } from 'react';
import { resolveCartridgeTheme, DEFAULT_CARTRIDGE_THEME } from '@pecking-order/ui-kit';
import type { CartridgeTheme } from '@pecking-order/ui-kit';

const CartridgeThemeCtx = createContext<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);

export function CartridgeThemeProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);

  useEffect(() => {
    setTheme(resolveCartridgeTheme(ref.current || undefined));
  }, []);

  return (
    <div ref={ref}>
      <CartridgeThemeCtx.Provider value={theme}>
        {children}
      </CartridgeThemeCtx.Provider>
    </div>
  );
}

export function useCartridgeTheme(): CartridgeTheme {
  return useContext(CartridgeThemeCtx);
}
```

**Step: Commit**

```bash
git add apps/client/src/cartridges/CartridgeThemeContext.tsx
git commit -m "feat(client): add CartridgeThemeProvider context for skinnable cartridges"
```

#### Sub-step 6c: Migrate one canvas renderer as proof of concept

Pick `GapRunRenderer.tsx` as the example. Find all hardcoded hex/rgba colors and replace with `theme.colors.*`.

```typescript
import { useCartridgeTheme } from '../CartridgeThemeContext';

// Inside the component:
const theme = useCartridgeTheme();

// Replace:
//   ctx.fillStyle = '#0d0d12'       → ctx.fillStyle = theme.colors.bg
//   ctx.fillStyle = '#ffd700'       → ctx.fillStyle = theme.colors.gold
//   ctx.fillStyle = 'rgba(255, 215, 0, 0.08)' → ctx.fillStyle = theme.colors.gold + '14' (hex alpha)
//   etc.
```

Create a helper for hex alpha if needed:

```typescript
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
}
```

Then: `ctx.fillStyle = withAlpha(theme.colors.gold, 0.08)`

**Step: Verify visually**

```bash
cd /Users/manu/Projects/pecking-order && npm run dev
```
Open client, start a game with GAP_RUN, verify it looks identical to before.

**Step: Commit**

```bash
git add apps/client/src/cartridges/games/gap-run/GapRunRenderer.tsx
git commit -m "refactor(client): migrate GapRunRenderer to CartridgeTheme (proof of concept)

Replaces hardcoded hex colors with theme.colors.* tokens.
Visual output unchanged — validates the theming contract works for canvas renderers."
```

#### Sub-step 6d: Wrap ShellLoader with CartridgeThemeProvider

In `apps/client/src/shells/ShellLoader.tsx` (or wherever shells are mounted), wrap ALL shells with the provider so every shell gets theming automatically:

```typescript
import { CartridgeThemeProvider } from '../cartridges/CartridgeThemeContext';

// Wrap the shell rendering:
<CartridgeThemeProvider>
  {/* existing shell loading/rendering */}
</CartridgeThemeProvider>
```

**No shell-specific code touched.** Every shell's cartridges inherit the theme context.

**Step: Build and commit**

```bash
cd apps/client && npx vite build
git add apps/client/src/shells/ShellLoader.tsx
git commit -m "feat(client): wrap ShellLoader with CartridgeThemeProvider — all shells get theming"
```

#### Sub-step 6e: Migrate remaining canvas renderers

Apply the same pattern from 6c to the other 7 canvas renderers:
- `ColorMatchRenderer.tsx`
- `GridPushRenderer.tsx`
- `QuickMathRenderer.tsx`
- `ReactionTimeRenderer.tsx`
- `SequenceRenderer.tsx`
- `SimonSaysRenderer.tsx`
- `StackerRenderer.tsx`

For each: find hardcoded hex → replace with `theme.colors.*` + `withAlpha()`.

**Step: Build, verify, commit**

```bash
cd apps/client && npx vite build
git add apps/client/src/cartridges/games/
git commit -m "refactor(client): migrate all canvas renderers to CartridgeTheme tokens

All 8 canvas game renderers now read colors from CartridgeTheme context.
No visual changes — default theme matches existing hardcoded values."
```

---

### Task 7: Final Verification

**Step 1: Full build**

```bash
cd /Users/manu/Projects/pecking-order && npm run build
```
Expected: no errors

**Step 2: Run all tests**

```bash
npm run test
```
Expected: all pass

**Step 3: Speed run (if game-server machines changed)**

Run `/speed-run` to verify full game lifecycle still works with the DM invitation model changes.

**Step 4: Manual smoke test**

1. Start all apps: `npm run dev`
2. Open Immersive shell
3. Verify: admin panel blocked for non-super-admin
4. Verify: alive players sorted by silver
5. Verify: bios available in roster data
6. Verify: game canvas renders with correct colors (theming)

**Step 5: Final commit if needed**

Clean up any loose ends, update `plans/DECISIONS.md` with new ADR entries if appropriate.

---

## ADR Entries to Add

- **ADR-096**: Super admin gate (env var allowlist, layout-level redirect)
- **ADR-097**: DM invitation model (invite → accept → channel, 5-conversation limit)
- **ADR-098**: CartridgeTheme contract (typed theme interface, CSS variable resolver, canvas migration)
