# Frictionless Invite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/j/CODE` unauth-safe welcome route — a recipient taps one link, types a name, creates a user with NULL email, and lands in the existing persona wizard. Unblocks staging designer distribution and playtest invites without email signup.

**Architecture:** Add `Users.contact_handle TEXT` column and drop `Users.email NOT NULL` via SQLite 12-step table recreation. Change `SessionUser.email` from `string` to `string | null` and fix every consumer. Add an unauth-safe route at `/j/[code]` that renders a one-field welcome form, and a `claimSeat` server action that atomically upserts a User + Session using `db.batch()` and rate-limits by IP hash via a new `AnonymousCreates` tracking table. Do NOT add `/j/*` to the middleware matcher (the matcher is an inclusion list).

**Tech Stack:** Next.js 15 server actions, Cloudflare D1 (SQLite), `@pecking-order/auth` (jose JWT), existing `lib/auth.ts` session pattern.

**Source spec:** `docs/superpowers/specs/2026-04-20-dev-game-workflow-design.md` — this plan implements §1 (`/j/CODE`), §2 (schema + type audit), and the must-fix risk items (rate limit, atomicity). It does NOT implement §3, §4, §5, §6, §7, §8 — those ship later.

---

## File Plan

**Create:**
- `apps/lobby/migrations/0015_contact_handle_nullable_email.sql` — schema change
- `apps/lobby/migrations/0016_anonymous_creates.sql` — rate-limit tracking table
- `apps/lobby/lib/rate-limit.ts` — IP-hash rate-limit helper
- `apps/lobby/app/j/[code]/page.tsx` — welcome form (client component)
- `apps/lobby/app/j/[code]/actions.ts` — `claimSeat` server action
- `apps/lobby/app/j/[code]/not-found.tsx` — 404 for unknown codes
- `apps/lobby/e2e/tests/frictionless-flow.spec.ts` — Playwright E2E

**Modify:**
- `apps/lobby/lib/auth.ts` — `SessionUser.email: string | null`
- `apps/lobby/app/actions.ts` — fix 3 nullable-email consumers (lines 926, 1542, 1579)
- `apps/lobby/app/page.tsx` — fallback to contact_handle when email is null (line 216)
- `apps/lobby/lib/db.ts` — ensure new migrations picked up (check if migration loader needs update)

**Not touched (deferred):**
- `apps/lobby/middleware.ts` — by design (matcher is inclusion; `/j/*` just isn't listed)
- `apps/lobby/app/page.tsx` DEBUG_OVERRIDE select — separate deprecation task
- Any wizard, auto-redirect, email-on-flip, admin page work

---

## Task 1: Schema migration — add contact_handle, drop NOT NULL on email

**Files:**
- Create: `apps/lobby/migrations/0015_contact_handle_nullable_email.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0015_contact_handle_nullable_email.sql
-- Add contact_handle for frictionless-invite users + make email nullable.
-- SQLite can't drop NOT NULL via ALTER, so we recreate the table.

-- Step 1: create new table with nullable email + contact_handle
CREATE TABLE Users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,                            -- was NOT NULL UNIQUE; now nullable (SQLite permits multiple NULLs under UNIQUE)
  display_name TEXT,
  contact_handle TEXT,                          -- user-typed label for frictionless joins
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Step 2: copy existing data, backfill contact_handle from email local-part
INSERT INTO Users_new (id, email, display_name, contact_handle, created_at, last_login_at)
  SELECT
    id,
    email,
    display_name,
    COALESCE(display_name, substr(email, 1, instr(email, '@') - 1)),
    created_at,
    last_login_at
  FROM Users;

-- Step 3: drop old, rename new
DROP TABLE Users;
ALTER TABLE Users_new RENAME TO Users;

-- Step 4: recreate any indexes we relied on (UNIQUE is inline on email column; no extra index needed)
```

- [ ] **Step 2: Apply the migration locally**

Run from the worktree root:
```bash
cd apps/lobby && npx wrangler d1 migrations apply pecking-order-lobby-db-dev --local
```

Expected: `🌀 Executing on local database pecking-order-lobby-db-dev ... Migration 0015_contact_handle_nullable_email.sql ... ✅`

- [ ] **Step 3: Verify the migration**

```bash
cd apps/lobby && npx wrangler d1 execute pecking-order-lobby-db-dev --local --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='Users';"
```

Expected output includes `email TEXT UNIQUE` (no NOT NULL) and `contact_handle TEXT`.

- [ ] **Step 4: Verify existing data preserved**

```bash
cd apps/lobby && npx wrangler d1 execute pecking-order-lobby-db-dev --local --command="SELECT COUNT(*) as n, COUNT(contact_handle) as handles FROM Users;"
```

Expected: `handles == n` (every existing user got a backfilled contact_handle from their email local-part).

- [ ] **Step 5: Commit**

```bash
git add apps/lobby/migrations/0015_contact_handle_nullable_email.sql
git commit -m "migration: add Users.contact_handle, drop NOT NULL on email"
```

---

## Task 2: SessionUser nullable email + consumer fixes

**Files:**
- Modify: `apps/lobby/lib/auth.ts:51,72,78`
- Modify: `apps/lobby/app/actions.ts:1579` (split crash), `:1542` (LEFT JOIN), `:926` (getAuthStatus return)
- Modify: `apps/lobby/app/page.tsx:216` (header display fallback)

- [ ] **Step 1: Change `SessionUser.email` type**

In `apps/lobby/lib/auth.ts`:

```typescript
// Line 49-53: change from
export interface SessionUser {
  userId: string;
  email: string;
  displayName: string | null;
}

// to
export interface SessionUser {
  userId: string;
  email: string | null;         // null for frictionless-flow users
  displayName: string | null;
  contactHandle: string | null; // fallback for display when email is null
}
```

And extend the `getSession` query + return shape:

```typescript
// Line 64-80: change from
const row = await db
  .prepare(
    `SELECT s.id, s.user_id, u.email, u.display_name
     FROM Sessions s
     JOIN Users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  )
  .bind(sessionId, now)
  .first<{ id: string; user_id: string; email: string; display_name: string | null }>();

if (!row) return null;

return {
  userId: row.user_id,
  email: row.email,
  displayName: row.display_name,
};

// to
const row = await db
  .prepare(
    `SELECT s.id, s.user_id, u.email, u.display_name, u.contact_handle
     FROM Sessions s
     JOIN Users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  )
  .bind(sessionId, now)
  .first<{ id: string; user_id: string; email: string | null; display_name: string | null; contact_handle: string | null }>();

if (!row) return null;

return {
  userId: row.user_id,
  email: row.email,
  displayName: row.display_name,
  contactHandle: row.contact_handle,
};
```

- [ ] **Step 2: Fix `actions.ts:1579` — `session.email.split('@')[0]`**

In `apps/lobby/app/actions.ts`, find the line `const senderName = session.displayName || session.email.split('@')[0];` and replace:

```typescript
// Before
const senderName = session.displayName || session.email.split('@')[0];

// After
const senderName =
  session.displayName ||
  session.contactHandle ||
  (session.email ? session.email.split('@')[0] : 'Someone');
```

- [ ] **Step 3: Fix `actions.ts:1542` — email-invite WHERE clause**

The query at line ~1542 does `WHERE u.email = ?` for duplicate-check. This is fine — it returns nothing for `/j/*` users (no email), which is the correct outcome (you can't email-invite someone without an email). No code change needed, but add a comment:

```typescript
// Before (whatever line ~1542 currently has)
// ... WHERE i.game_id = ? AND u.email = ?`

// After (add comment above the query)
// Duplicate-check by email. Frictionless-flow users (email IS NULL) are
// intentionally not matched — they can't be email-invited. Safe no-op.
// ... WHERE i.game_id = ? AND u.email = ?`
```

- [ ] **Step 4: Fix `actions.ts:926` — `getAuthStatus` return shape**

Line ~926: `return { authed: true, email: session.email };` — `email` is now `string | null`. Update the function's return type.

Find the function signature:
```typescript
export async function getAuthStatus(): Promise<{ authed: boolean; email?: string }> {
```

Change to:
```typescript
export async function getAuthStatus(): Promise<{ authed: boolean; email?: string | null; contactHandle?: string | null }> {
```

And update the return:
```typescript
// Before
return { authed: true, email: session.email };

// After
return { authed: true, email: session.email, contactHandle: session.contactHandle };
```

- [ ] **Step 5: Fix `page.tsx:216` — lobby home header display**

Find the line `getAuthStatus().then(s => { if (s.authed && s.email) setAuthEmail(s.email); });` at `apps/lobby/app/page.tsx:216`.

Replace with:
```typescript
getAuthStatus().then(s => {
  if (s.authed) {
    setAuthEmail(s.email || s.contactHandle || null);
  }
});
```

The `authEmail` state is used as the display label; `contact_handle` is a clean fallback. No separate state variable needed.

- [ ] **Step 6: Typecheck and run existing lobby tests**

```bash
cd apps/lobby && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If any, fix them — they're additional nullable-email consumers that must be caught.

Then:
```bash
cd apps/lobby && npm test 2>&1 | tail -20
```

Expected: all passing. No test is exercising email-nullable behavior yet (Task 6 adds one).

- [ ] **Step 7: Commit**

```bash
git add apps/lobby/lib/auth.ts apps/lobby/app/actions.ts apps/lobby/app/page.tsx
git commit -m "auth: nullable email in SessionUser + consumer fixes"
```

---

## Task 3: Rate-limit table + helper

**Files:**
- Create: `apps/lobby/migrations/0016_anonymous_creates.sql`
- Create: `apps/lobby/lib/rate-limit.ts`
- Create: `apps/lobby/lib/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- 0016_anonymous_creates.sql
-- Rate-limit tracking for anonymous user creation via /j/[code].
-- Stores SHA-256 hashes of IPs (no PII) with creation timestamps.

CREATE TABLE AnonymousCreates (
  ip_hash TEXT NOT NULL,                -- SHA-256 hex of IP
  created_at INTEGER NOT NULL           -- ms since epoch
);

CREATE INDEX idx_anon_creates_ip_time ON AnonymousCreates(ip_hash, created_at);
```

- [ ] **Step 2: Apply the migration**

```bash
cd apps/lobby && npx wrangler d1 migrations apply pecking-order-lobby-db-dev --local
```

Expected: `Migration 0016_anonymous_creates.sql ... ✅`.

- [ ] **Step 3: Write the failing test**

Create `apps/lobby/lib/__tests__/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAnonymousRateLimit, hashIp } from '../rate-limit';

describe('rate-limit', () => {
  const mockDb = {
    _counts: new Map<string, number>(),
    _inserts: [] as Array<{ ip_hash: string; created_at: number }>,
    prepare(sql: string) {
      const self = this;
      return {
        bind(...args: any[]) {
          return {
            first: async () => {
              // SELECT COUNT(*) query
              const [ipHash, sinceMs] = args;
              const count = self._inserts.filter(
                r => r.ip_hash === ipHash && r.created_at > sinceMs
              ).length;
              return { count };
            },
            run: async () => {
              // INSERT query
              const [ipHash, createdAt] = args;
              self._inserts.push({ ip_hash: ipHash, created_at: createdAt });
            },
          };
        },
      };
    },
  };

  beforeEach(() => {
    mockDb._counts.clear();
    mockDb._inserts = [];
  });

  it('allows first request from new IP', async () => {
    const result = await checkAnonymousRateLimit(mockDb as any, '1.2.3.4');
    expect(result.allowed).toBe(true);
  });

  it('blocks after limit exceeded', async () => {
    // Pre-fill 10 inserts in last hour
    const now = Date.now();
    const ipHash = await hashIp('1.2.3.4');
    for (let i = 0; i < 10; i++) {
      mockDb._inserts.push({ ip_hash: ipHash, created_at: now - i * 1000 });
    }
    const result = await checkAnonymousRateLimit(mockDb as any, '1.2.3.4');
    expect(result.allowed).toBe(false);
  });

  it('hashes IP deterministically', async () => {
    const a = await hashIp('1.2.3.4');
    const b = await hashIp('1.2.3.4');
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // SHA-256 hex
  });
});
```

- [ ] **Step 4: Run the test and watch it fail**

```bash
cd apps/lobby && npx vitest run lib/__tests__/rate-limit.test.ts
```

Expected: FAIL with `Cannot find module '../rate-limit'`.

- [ ] **Step 5: Implement the helper**

Create `apps/lobby/lib/rate-limit.ts`:

```typescript
import type { D1Database } from '@cloudflare/workers-types';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;                    // 10 anonymous creates per hour per IP

export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export async function checkAnonymousRateLimit(
  db: D1Database,
  ip: string,
): Promise<RateLimitResult> {
  const ipHash = await hashIp(ip);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const row = await db
    .prepare('SELECT COUNT(*) as count FROM AnonymousCreates WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  if (count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS };
  }
  return { allowed: true };
}

export async function recordAnonymousCreate(db: D1Database, ip: string): Promise<void> {
  const ipHash = await hashIp(ip);
  await db
    .prepare('INSERT INTO AnonymousCreates (ip_hash, created_at) VALUES (?, ?)')
    .bind(ipHash, Date.now())
    .run();
}
```

- [ ] **Step 6: Run the test and watch it pass**

```bash
cd apps/lobby && npx vitest run lib/__tests__/rate-limit.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/lobby/migrations/0016_anonymous_creates.sql apps/lobby/lib/rate-limit.ts apps/lobby/lib/__tests__/rate-limit.test.ts
git commit -m "rate-limit: anonymous-create helper + tracking table"
```

---

## Task 4: `claimSeat` server action with atomic upsert

**Files:**
- Create: `apps/lobby/app/j/[code]/actions.ts`

- [ ] **Step 1: Write the action**

Create `apps/lobby/app/j/[code]/actions.ts`:

```typescript
'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDB } from '@/lib/db';
import { getSession, generateId, generateToken, getSessionCookieName } from '@/lib/auth';
import { checkAnonymousRateLimit, recordAnonymousCreate } from '@/lib/rate-limit';

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, mirrors lib/auth.ts

function sanitizeHandle(raw: string): string | null {
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F]/g, '') // strip control + zero-width
    .trim();
  if (cleaned.length < 1 || cleaned.length > 24) return null;
  return cleaned;
}

export interface ClaimSeatResult {
  ok: boolean;
  error?: 'invalid_handle' | 'rate_limited' | 'game_not_found' | 'game_not_accepting' | 'already_joined' | 'internal';
}

export async function claimSeat(
  code: string,
  rawHandle: string,
): Promise<ClaimSeatResult> {
  const handle = sanitizeHandle(rawHandle);
  if (!handle) return { ok: false, error: 'invalid_handle' };

  const db = await getDB();

  // Game lookup + status check
  const game = await db
    .prepare('SELECT id, status FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string }>();
  if (!game) return { ok: false, error: 'game_not_found' };
  if (game.status !== 'RECRUITING' && game.status !== 'READY') {
    return { ok: false, error: 'game_not_accepting' };
  }

  // If already authenticated AND already in this game, hand off immediately
  const existing = await getSession();
  if (existing) {
    const already = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, existing.userId)
      .first();
    if (already) {
      redirect(`/play/${code}`);
    }
    // Already has a session but not in this game — route them through the existing wizard
    redirect(`/join/${code}`);
  }

  // Unauth path — rate-limit by IP
  const hdrs = await headers();
  const ip =
    hdrs.get('cf-connecting-ip') ||
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown';
  const rate = await checkAnonymousRateLimit(db, ip);
  if (!rate.allowed) return { ok: false, error: 'rate_limited' };

  // Atomic user + session insert via db.batch()
  const userId = generateId();
  const sessionId = generateToken();
  const now = Date.now();

  try {
    await db.batch([
      db
        .prepare('INSERT INTO Users (id, email, contact_handle, created_at) VALUES (?, NULL, ?, ?)')
        .bind(userId, handle, now),
      db
        .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .bind(sessionId, userId, now + SESSION_EXPIRY_MS, now),
    ]);
  } catch (err) {
    console.error('[claimSeat] atomic insert failed:', err);
    return { ok: false, error: 'internal' };
  }

  // Record rate-limit tally AFTER successful commit
  await recordAnonymousCreate(db, ip);

  // Set cookie
  const cookieName = await getSessionCookieName();
  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_MS / 1000,
    path: '/',
  });

  // Redirect into the existing persona wizard
  redirect(`/join/${code}`);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/lobby && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/app/j/[code]/actions.ts
git commit -m "j/[code]: claimSeat action with atomic insert + rate limit"
```

---

## Task 5: `/j/[code]` welcome page

**Files:**
- Create: `apps/lobby/app/j/[code]/page.tsx`
- Create: `apps/lobby/app/j/[code]/not-found.tsx`

- [ ] **Step 1: Write the not-found page**

Create `apps/lobby/app/j/[code]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-display text-2xl font-black text-skin-gold">Invite not found</h1>
        <p className="text-sm text-skin-dim">
          Double-check the link, or ask whoever invited you to send it again.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the welcome page**

Create `apps/lobby/app/j/[code]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getDB } from '@/lib/db';
import { WelcomeForm } from './welcome-form';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function FrictionlessWelcomePage({ params }: PageProps) {
  const { code } = await params;
  const db = await getDB();

  const game = await db
    .prepare('SELECT id, status, invite_code, player_count FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string; player_count: number }>();

  if (!game) notFound();

  const isAcceptingPlayers = game.status === 'RECRUITING' || game.status === 'READY';

  if (!isAcceptingPlayers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display text-2xl font-black text-skin-dim">This game already started</h1>
          <p className="text-sm text-skin-dim/80">
            The host kicked off before you tapped in. Ask your friends to start a new game and share the link before they begin.
          </p>
        </div>
      </div>
    );
  }

  const acceptedCount = await db
    .prepare('SELECT COUNT(*) as n FROM Invites WHERE game_id = ? AND accepted_by IS NOT NULL')
    .bind(game.id)
    .first<{ n: number }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
      <div className="max-w-md w-full space-y-6">
        <header className="text-center space-y-2">
          <div className="text-[10px] font-display font-bold text-skin-accent uppercase tracking-[0.3em]">
            Pecking Order
          </div>
          <h1 className="font-display text-3xl font-black text-skin-base leading-tight">
            You're invited to a game
          </h1>
          <p className="text-sm text-skin-dim">
            {acceptedCount?.n ?? 0} of {game.player_count} joined — don't wait too long.
          </p>
        </header>
        <WelcomeForm code={game.invite_code} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the welcome form (client component)**

Create `apps/lobby/app/j/[code]/welcome-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { claimSeat } from './actions';

export function WelcomeForm({ code }: { code: string }) {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await claimSeat(code, handle);
      if (!result.ok) {
        switch (result.error) {
          case 'invalid_handle':
            setError('Name must be 1-24 characters.');
            break;
          case 'rate_limited':
            setError('Too many attempts from this network. Try again later.');
            break;
          case 'game_not_found':
            setError('Game not found.');
            break;
          case 'game_not_accepting':
            setError('This game already started.');
            break;
          default:
            setError('Something went wrong. Try again.');
        }
      }
      // success path: server action redirects, never reaches here
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-bold text-skin-dim uppercase tracking-widest">
          What should we call you?
        </span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoFocus
          maxLength={24}
          placeholder="Your name"
          className="mt-2 w-full px-4 py-3 bg-skin-input border border-skin-base rounded-xl text-skin-base placeholder:text-skin-dim/40 focus:outline-none focus:border-skin-gold/50"
        />
        <span className="mt-2 block text-[11px] text-skin-dim/60">
          This is so the group knows you in-game and in the reveal at the end.
        </span>
      </label>

      {error && (
        <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || handle.trim().length === 0}
        className="w-full py-4 bg-skin-gold text-skin-deep font-display font-black text-sm uppercase tracking-widest rounded-xl disabled:opacity-40"
      >
        {isPending ? 'Joining…' : "Let's go →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/lobby && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Verify middleware doesn't catch `/j/*`**

```bash
grep -n "matcher" apps/lobby/middleware.ts
```

Expected: shows `matcher: ['/', '/join/:path*', '/game/:path*', '/admin/:path*', '/playtest', '/playtest/share/:path*', '/share/:path*']` — `/j/*` is NOT present. If it is, remove it.

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/app/j/[code]/page.tsx apps/lobby/app/j/[code]/not-found.tsx apps/lobby/app/j/[code]/welcome-form.tsx
git commit -m "j/[code]: welcome page + form — unauth-safe frictionless entry"
```

---

## Task 6: E2E Playwright test

**Files:**
- Create: `apps/lobby/e2e/tests/frictionless-flow.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `apps/lobby/e2e/tests/frictionless-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { createTestGame } from '../fixtures/lobby-config';

test.describe('Frictionless invite flow (/j/CODE)', () => {
  test('anonymous user types name, lands on persona wizard', async ({ page, context }) => {
    const { inviteCode } = await createTestGame({ mode: 'CONFIGURABLE_CYCLE' });

    // Visit /j/CODE with no session cookies
    await context.clearCookies();
    await page.goto(`/j/${inviteCode}`);

    // Welcome form is visible
    await expect(page.getByText("You're invited to a game")).toBeVisible();
    await expect(page.getByLabel(/What should we call you/i)).toBeVisible();

    // Submit with a name
    await page.getByLabel(/What should we call you/i).fill('TestPlayer');
    await page.getByRole('button', { name: /Let's go/ }).click();

    // Expect redirect to /join/CODE (persona wizard)
    await page.waitForURL(`**/join/${inviteCode}`);
    expect(page.url()).toContain(`/join/${inviteCode}`);

    // Cookie should be set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name.startsWith('po_session'));
    expect(sessionCookie).toBeDefined();
  });

  test('returns 404-style page for unknown invite code', async ({ page }) => {
    await page.goto('/j/BOGUS1');
    await expect(page.getByText(/Invite not found/i)).toBeVisible();
  });

  test('shows stale-link screen for STARTED game', async ({ page }) => {
    const { inviteCode } = await createTestGame({ mode: 'CONFIGURABLE_CYCLE', status: 'STARTED' });
    await page.goto(`/j/${inviteCode}`);
    await expect(page.getByText(/This game already started/i)).toBeVisible();
  });

  test('rejects empty name', async ({ page, context }) => {
    const { inviteCode } = await createTestGame({ mode: 'CONFIGURABLE_CYCLE' });
    await context.clearCookies();
    await page.goto(`/j/${inviteCode}`);
    const btn = page.getByRole('button', { name: /Let's go/ });
    await expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Check if `createTestGame` fixture supports `status` override**

```bash
grep -n "status" apps/lobby/e2e/fixtures/lobby-config.ts | head -10
```

If `createTestGame` does NOT accept a `status` parameter, the "stale-link" test needs to force status via raw D1 write. Look at the fixture and either:
- Add `status?: 'RECRUITING' | 'READY' | 'STARTED'` parameter (if simple), OR
- Replace the third test with a direct-D1 status flip before `page.goto`

Do whichever is smaller. Commit the fixture change separately if needed.

- [ ] **Step 3: Run the E2E test**

```bash
cd apps/lobby && npx playwright test e2e/tests/frictionless-flow.spec.ts
```

Expected: all 4 tests pass. If the third test fails for fixture reasons, pause and fix the fixture.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/e2e/tests/frictionless-flow.spec.ts
# + any fixture changes from Step 2
git commit -m "e2e: frictionless /j/CODE flow — happy path + 3 failure modes"
```

---

## Task 7: Smoke test the full end-to-end path manually

This is a manual verification before declaring done. No commit.

- [ ] **Step 1: Start dev servers**

From the worktree root:
```bash
npm run dev
```

Wait for all 3 apps to be ready (lobby :3000, client :5173, game-server :8787).

- [ ] **Step 2: Create a test game via the existing flow**

Open http://localhost:3000, log in as any email, create a CONFIGURABLE_CYCLE game. Note the invite code.

- [ ] **Step 3: Open `/j/CODE` in an incognito window**

```
http://localhost:3000/j/{INVITE_CODE}
```

Verify:
- Welcome form renders
- Player-count copy shows "0 of N joined"
- Typing a name enables the button
- Submitting redirects to `/join/{INVITE_CODE}` (persona wizard)
- Persona wizard is usable (draws personas, lets you pick one)
- After completing the wizard, you end up in a valid post-wizard state (waiting room or client — whatever the current flow does)

- [ ] **Step 4: Verify the D1 state**

```bash
cd apps/lobby && npx wrangler d1 execute pecking-order-lobby-db-dev --local --command="SELECT id, email, contact_handle, created_at FROM Users ORDER BY created_at DESC LIMIT 3;"
```

Expected: most-recent row has `email = NULL`, `contact_handle = "whatever you typed"`.

```bash
cd apps/lobby && npx wrangler d1 execute pecking-order-lobby-db-dev --local --command="SELECT * FROM Invites WHERE accepted_by = (SELECT id FROM Users WHERE contact_handle = 'whatever you typed');"
```

Expected: one row with persona claim, confirming the wizard wrote through successfully for the frictionless user.

- [ ] **Step 5: Try the rate limit**

From a curl loop or by hammering the form ~12 times rapidly from the same browser:
```bash
for i in $(seq 1 12); do
  curl -s -X POST http://localhost:3000/j/{INVITE_CODE} \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "handle=User${i}"
done
```

After the 11th attempt, expect the form to reject with "Too many attempts" or similar. Verify by reading the response body or browser error state.

- [ ] **Step 6: If everything works, you're done**

No commit for this task. Status: the frictionless flow is live end-to-end on the worktree.

---

## Self-review checklist

- [x] Spec coverage: §1 (route), §2 (schema + audit), must-fix risks #2/#5/#9 all have tasks
- [x] No placeholders — every code step has complete code
- [x] Type consistency: `SessionUser.contactHandle: string | null` used consistently across tasks 2, 4, 5
- [x] File paths are exact
- [x] TDD: rate-limit helper has test-first; Playwright E2E covers the full flow
- [x] Frequent commits: 5 task-end commits + 1 manual smoke (no commit)

## Deferred (NOT in this plan)

- §3 wizard commit-early
- §4 auto-redirect after wizard
- §5 waiting-room invite ungating
- §6 admin create-debug page
- §7 email-on-flip + status-flip completion
- §8 /create-game script rewrite
- All deprecations (DEBUG_OVERRIDE, startDebugGame, DEBUG_PECKING_ORDER enum)
