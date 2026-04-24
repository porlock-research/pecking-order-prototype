# Auth Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invite/login-link friction spiral that has been eating playtest onboarding since at least Apr 5, and close the recovery gaps in the frictionless flow that bit the 2026-04-23 playtester. Deliver a lobby where a shared game URL "just works" for the dominant visitor classes — without rewriting the identity model.

**Architecture:** Changes span three surfaces — lobby route handlers (`/invite/[token]`, `/login/verify`, `/j/[code]`), lobby server actions (`claimSeat`), and the client recovery cascade (`apps/client/src/App.tsx`). Most tasks are independent; Phase 1 is the highest-leverage single change and should go first.

**Tech Stack:** Next.js 15 on Cloudflare via OpenNext (lobby), React 19 + Vite (client), D1 for persistence, Resend for email (no click tracking wrapping — verified).

---

## Context (read before starting)

Evidence anchoring this plan:

- **Axiom logs** (`po-logs-staging`): all `/invite/` hits across 30 days = 17 requests. Two hits from **Windows Chrome in Morganton NC + Charleston SC** (US east-coast email-security-scanner hubs) — nowhere near actual users (Vancouver / Abbotsford / Surrey). Two iOS GSA hits with `?utm_campaign=as-npt...` — a wrapper our code didn't inject, likely an iOS preview-prefetch.
- **D1**: game `C24FZ9` (Apr 5 playtest, internal ID `game-1775416073250-898`) shows ≥8 invite tokens `used=1` with fewer enrollments — **at least 2 tokens orphaned**: `kristy@merchantsofplay.com`, `pierrebeugnot@gmail.com`. (Re-counting during 2026-04-24 review showed a count of 9 used / 8 enrolled excluding host — the exact off-by-one doesn't change the story: tokens are being consumed without enrollment at a measurable rate, numerically aligning with scanner-signature hits in Axiom.)
- **Resend dashboard screenshot** (2026-04-23 session): most recipients who got "You've been invited" also received a "Your Pecking Order Login Link" email shortly after — the invite didn't stick, they had to magic-link recover.
- **Resend click tracking is NOT enabled** — confirmed by the user. So the cookie-drop mechanism is not a cross-origin redirect issue; it's scanner prefetch consuming tokens before users click.
- **Lobby HTTP log co-timing** at 21:20:07 on Apr 5 UTC: mobile user (Vancouver) hit `/invite/` at T+0, scanner (Charleston SC) hit `/invite/` at T+152ms, both followed their own redirect chains — mobile user succeeded (POST `/join/C24FZ9`), scanner bounced to `/login` (no cookie in its jar). Clean demonstration of the mechanism.
- **Additional bugs surfaced during investigation**:
  - `/j/[code]/actions.ts:114` sets session cookie with `secure: true` **unconditionally** (other issuance sites use `secure: !isLocal`). Triggers cookie rejection when the worker sees HTTP (CF edge isn't redirecting HTTP→HTTPS at the moment). Apr 22 A8P58R user thrashed visibly on this.
  - `/j/[code]/page.tsx:11-43` does NOT call `getSession()` on GET — a returning-player reload shows them the welcome form again (playtest-pitfalls.md #12, still present).
  - Client recovery cascade at `App.tsx:539` falls back to `${LOBBY_HOST}/play/CODE` when all token paths fail — that bounces to `/login` (magic-link gauntlet). For a player holding a signature-valid JWT for *any* prior game, that's recoverable identity being discarded.
  - `startGame()` in `actions.ts:665-829` returns `tokens: Record<playerId, jwt>` for ALL players. Waiting room `waiting/page.tsx:142` uses `Object.keys(tokens)[0]` — if the host's slot isn't `p1`, they enter the client impersonating `p1`. (Playtest-pitfalls.md #8 was partially patched on `getGameSessionStatus` only; this path is still broken.)
  - Host's "Copy Link" at `waiting/page.tsx:116` copies `/join/CODE` (auth-required) instead of `/j/CODE` (frictionless). Every stranger who taps the shared link hits the magic-link wall.

### Identity model and what it enables

JWTs are signed with `AUTH_SECRET` (HS256). An expired-by-time JWT is still **cryptographic proof** of `{sub, gameId, playerId, personaName}` at issue time. Current system rejects expired JWTs outright at verification. The recovery redesign in Phase 3 treats a signature-valid expired JWT as sufficient identity proof for session restoration — this is a deliberate trade-off (see "Risks & trade-offs" below).

### What this plan does NOT do

- Does **not** add OAuth providers (Apple/Google Sign-In). That's a separate strategic decision with larger scope; this plan preserves magic-link + frictionless and makes both more reliable. OAuth is additive later.
- Does **not** address the anon-user cross-device recovery gap. A user who joined via `/j/CODE` without email cannot be recovered if their device is wiped — magic link has no destination. Mitigation (optional email-attach at enrollment) is flagged as follow-up, not in scope here.
- Does **not** add in-client share UI. Covered in a separate follow-up once the canonical share URL behaves correctly.
- Does **not** change session or JWT TTLs, secret rotation policy, or the underlying auth model. This is a reliability / recovery pass, not a redesign.

---

## File Structure

- **`apps/lobby/app/invite/[token]/route.ts`** — split into GET (renders confirm page) + POST (consumes) — Task 1
- **`apps/lobby/app/login/verify/route.ts`** — same split — Task 2
- **`apps/lobby/lib/auth.ts`** — add `setSessionCookie` helpers — Task 3
- **`apps/lobby/app/j/[code]/actions.ts`** — use centralized cookie helper — Task 4
- **`apps/lobby/app/j/[code]/page.tsx`** — session-aware GET: short-circuit if already enrolled, redirect if authed — Task 5
- **`apps/lobby/app/enter/[code]/route.ts`** (new) — smart-recovery endpoint accepting JWT hint — Task 6
- **`packages/auth/src/index.ts`** — extend `verifyGameToken` with `ignoreExpiration` option — Task 6
- **`apps/client/src/App.tsx`** — `refreshFromLobby` returns `{token, reason}`; `runAsyncRecovery` routes to `/enter/CODE` with JWT hint instead of `/play/CODE` — Task 7
- **`apps/client/src/App.tsx`** — `LauncherScreen` empty-state shows "Sign in" CTA when no active games and no cached tokens — Task 8
- **`apps/lobby/app/game/[id]/waiting/page.tsx`** — "Copy Link" copies `/j/CODE`; visible canonical URL — Task 9
- **`apps/lobby/app/actions.ts`** — `startGame()` returns only caller's token (mirror `getGameSessionStatus` pattern) — Task 10

---

## Phase 1 — Scanner prefetch defense (P0)

**Why P0**: ~90% confidence this is the dominant cause of the invite+login Resend dashboard pattern. Two tokens orphaned in the C24FZ9 dataset alone, and the fix is mechanically simple. Every day without this in prod, another playtest batch loses invitees to scanners.

### Task 1: `/invite/[token]` GET-renders + POST-consumes

**Why:** Corporate email security scanners (Mimecast/Proofpoint/Defender/etc.) and preview fetchers (iOS Mail preview, GSA) issue GET requests to URLs in emails with real-browser UAs. Current `route.ts:44` marks the invite token `used=1` on GET — whichever GET arrives first wins. Scanners often arrive before or concurrent with the user. The fix: render a small HTML page on GET (no token consumption), consume on POST (bots don't POST).

**Files:**
- Modify: `apps/lobby/app/invite/[token]/route.ts` (split GET/POST)
- Verify: manual curl + D1 inspection

- [ ] **Step 1: Read current route to identify the exact logic to move**
  
  Run: `cat apps/lobby/app/invite/[token]/route.ts`
  Current structure: single `GET` handler that (a) looks up token, (b) handles `used`/`expired` branches, (c) marks used, (d) upserts user, (e) creates session, (f) sets cookie + 302 to `/join/CODE`.

- [ ] **Step 2: Split the route into GET (validate-only, render) + POST (consume)**
  
  New `route.ts` shape (use a plain HTML template string, not React — route handlers don't need JSX):
  
  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { getDB } from '@/lib/db';
  import { generateToken, setSessionCookie } from '@/lib/auth';
  
  const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
  
  type Invite = { token: string; email: string; game_id: string; invite_code: string; expires_at: number; used: number };
  
  async function loadInvite(token: string): Promise<Invite | null> {
    const db = await getDB();
    return db
      .prepare('SELECT token, email, game_id, invite_code, expires_at, used FROM InviteTokens WHERE token = ?')
      .bind(token)
      .first<Invite>();
  }
  
  function renderConfirmPage(token: string, inviteCode: string): Response {
    // Plain HTML string — safe because `token` and `inviteCode` are URL-path
    // values that we already trust (looked up in D1). inviteCode is A-Z0-9 only.
    // token is 64-hex chars. Both are safe to embed in form action/values.
    const html = [
      '<!doctype html><html lang="en"><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>Continue to Pecking Order</title>',
      '<style>',
      'body{margin:0;font-family:system-ui,sans-serif;background:#0f0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
      '.card{max-width:360px;text-align:center}',
      '.spinner{width:24px;height:24px;margin:0 auto 16px;border:2px solid #f5c842;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite}',
      'button{margin-top:16px;padding:14px 24px;background:#f5c842;color:#0f0a1a;border:0;border-radius:12px;font-weight:700;cursor:pointer;font-size:15px}',
      '@keyframes spin{to{transform:rotate(360deg)}}',
      '</style></head><body>',
      '<div class="card">',
      '<div class="spinner" aria-hidden="true"></div>',
      '<p>Taking you to your game…</p>',
      `<form method="post" action="/invite/${encodeURIComponent(token)}" id="f">`,
      '<noscript>',
      `<button type="submit">Continue to game ${inviteCode}</button>`,
      '</noscript>',
      `<button id="fallback" type="submit" style="display:none">Continue to game ${inviteCode}</button>`,
      '</form>',
      // Auto-submit after 150ms (gives spinner time to render). If the POST
      // doesn't complete within 3s, reveal a manual-continue button so the
      // user isn't stuck staring at a spinner on a flaky connection.
      '<script>setTimeout(function(){var f=document.getElementById("f");if(f)f.submit()},150);',
      'setTimeout(function(){var n=document.getElementById("fallback");if(n)n.style.display="block"},3000);</script>',
      '</div></body></html>',
    ].join('');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  
  export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await loadInvite(token);
    const now = Date.now();
    if (!invite) return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url));
    if (invite.expires_at < now) return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url));
    if (invite.used) return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url));
    return renderConfirmPage(token, invite.invite_code);
  }
  
  export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await loadInvite(token);
    const now = Date.now();
    if (!invite) return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url), 303);
    if (invite.expires_at < now) return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url), 303);
    if (invite.used) return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url), 303);
  
    const db = await getDB();
    await db.prepare('UPDATE InviteTokens SET used = 1 WHERE token = ?').bind(token).run();
    const normalizedEmail = invite.email.toLowerCase().trim();
    let user = await db.prepare('SELECT id FROM Users WHERE email = ?').bind(normalizedEmail).first<{ id: string }>();
    if (!user) {
      const userId = crypto.randomUUID();
      await db.prepare('INSERT INTO Users (id, email, created_at) VALUES (?, ?, ?)').bind(userId, normalizedEmail, now).run();
      user = { id: userId };
    }
    await db.prepare('UPDATE Users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();
    const sessionId = generateToken();
    await db
      .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
      .run();
  
    const response = NextResponse.redirect(new URL(`/join/${invite.invite_code}`, req.url), 303);
    await setSessionCookie(response, sessionId, req.nextUrl.hostname);
    return response;
  }
  ```
  
  Notes: uses 303 for redirect after POST (standard "see other" for form submissions). Depends on `setSessionCookie` helper added in Task 3 — if Task 3 hasn't landed yet, inline the cookie attributes matching `login/verify/route.ts:19-25`.

- [ ] **Step 3: Verify path handling and redirect semantics**
  
  Test manually with `curl`:
  - `curl -i https://staging-lobby.peckingorder.ca/invite/NONEXISTENT` → 307 to `/login?error=...`
  - `curl -i https://staging-lobby.peckingorder.ca/invite/<real-token>` → 200 HTML with form, token NOT marked used in D1 (verify with `SELECT used FROM InviteTokens WHERE token = ?`)
  - `curl -i -X POST https://staging-lobby.peckingorder.ca/invite/<real-token>` → 303 to `/join/CODE`, Set-Cookie present, token now `used=1`
  
  The critical assertion: **GET does not mark the token used**.

- [ ] **Step 4: Build & typecheck**
  
  `cd apps/lobby && npm run build`
  Fix any TS errors around the import of `setSessionCookie` (may need to stub before Task 3 lands — in that case inline the cookie attrs temporarily).

### Task 2: `/login/verify` GET-renders + POST-consumes

**Why:** Same mechanism hits the magic-link path. LR8W3U Apr 23 data shows the same token hit from Surrey iOS Mobile Chrome at 00:05:47, then Vancouver iOS Mobile Chrome at 00:06:37 — 50 seconds apart, same UA family. Email preview prefetch or similar. The fix is structurally identical to Task 1.

**Files:**
- Modify: `apps/lobby/app/login/verify/route.ts`

- [ ] **Step 1: Apply the same GET/POST split**
  
  Follow Task 1's pattern. GET validates token (look up MagicLinks row, check used/expired) + renders a confirm page with copy "Signing you in…" / button "Continue to sign in". Form POSTs back to `/login/verify` with token and `next` as hidden inputs. POST calls the existing `verifyMagicLink(token)` helper from `lib/auth.ts:146` and sets the cookie.
  
  For the `next` param, carry it through: `const next = req.nextUrl.searchParams.get('next') || '/'`. On POST, read from the form body: `const formData = await req.formData(); const next = (formData.get('next') as string) || '/'`.

- [ ] **Step 2: Modify `renderConfirmPage` equivalent to include hidden `next` input**
  
  The form in the rendered HTML needs:
  ```html
  <form method="post" action="/login/verify" id="f">
    <input type="hidden" name="token" value="${encodeURIComponent(token)}">
    <input type="hidden" name="next" value="${encodeURIComponent(next)}">
    <noscript><button type="submit">Continue to sign in</button></noscript>
  </form>
  ```

- [ ] **Step 3: Verify the fix**
  
  Same curl sequence as Task 1's Step 3, adapted for the `MagicLinks` table.

- [ ] **Step 4: Build**
  
  `cd apps/lobby && npm run build`

---

## Phase 2 — Frictionless flow hardening (P0)

**Why P0**: `/j/CODE` is the canonical URL for shared invites post-fix (Phase 4). The current `secure:true`-on-HTTP + not-session-aware-on-GET combination means returning players and HTTP-context clicks both fail.

### Task 3: Centralize session cookie helper in `lib/auth.ts`

**Why:** Three files set the session cookie today (`login/verify/route.ts`, `invite/[token]/route.ts`, `j/[code]/actions.ts`) with slightly different attributes. `claimSeat` uses `secure: true` unconditionally and omits `domain`. Drift like this is what made the A8P58R Apr 22 user thrash. Centralize so there's one source of truth.

**Files:**
- Modify: `apps/lobby/lib/auth.ts`

- [ ] **Step 1: Add `setSessionCookie` (for route handlers with a NextResponse) and `setSessionCookieOnRequest` (for server actions with the `cookies()` API)**
  
  Append to `lib/auth.ts`:
  
  ```ts
  import type { NextResponse } from 'next/server';
  
  /**
   * Set the session cookie on a route handler's NextResponse.
   * Used by /invite/[token] POST and /login/verify POST.
   */
  export async function setSessionCookie(
    response: NextResponse,
    sessionId: string,
    hostname: string,
  ): Promise<void> {
    const cookieName = await getSessionCookieName();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    response.cookies.set(cookieName, sessionId, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_MS / 1000,
      ...(isLocal ? {} : { domain: '.peckingorder.ca' }),
    });
  }
  
  /**
   * Set the session cookie from a server-action context (no NextResponse in hand).
   * Used by claimSeat in /j/[code]/actions.ts.
   */
  export async function setSessionCookieOnRequest(
    sessionId: string,
    hostname: string,
  ): Promise<void> {
    const cookieName = await getSessionCookieName();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const cookieStore = await cookies();
    cookieStore.set(cookieName, sessionId, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_MS / 1000,
      ...(isLocal ? {} : { domain: '.peckingorder.ca' }),
    });
  }
  ```

- [ ] **Step 2: Update existing issuance sites to use the helper**
  
  Edit `login/verify/route.ts` — replace the inline `response.cookies.set(...)` block with `await setSessionCookie(response, result.sessionId, req.nextUrl.hostname)`.
  
  Edit `invite/[token]/route.ts` (the POST handler from Task 1) — same replacement.
  
  Do NOT edit `j/[code]/actions.ts` here — Task 4 handles that.

- [ ] **Step 3: Build & confirm no regression**
  
  `cd apps/lobby && npm run build`
  Manual verify: `curl` a magic link, confirm Set-Cookie headers match what was being set before (httpOnly, secure on prod hostname, domain=.peckingorder.ca).

### Task 4: `/j/[code]/claimSeat` uses centralized helper

**Why:** Current `actions.ts:112-118` uses `secure: true` unconditionally and omits `domain`. Apr 22 A8P58R data shows a Surrey iOS user thrashed with HTTP POST requests to `/j/A8P58R` being bounced to `/login` — the `secure:true` cookie was rejected on those HTTP responses.

**Files:**
- Modify: `apps/lobby/app/j/[code]/actions.ts`

- [ ] **Step 1: Import and use the async cookie helper**
  
  Replace `claimSeat`'s cookie-setting block (lines 110-118):
  
  ```ts
  // OLD:
  const cookieName = await getSessionCookieName();
  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_MS / 1000,
    path: '/',
  });
  
  // NEW:
  const hostname = hdrs.get('host')?.split(':')[0] || '';
  await setSessionCookieOnRequest(sessionId, hostname);
  ```
  
  Note: `hdrs` is already available from the earlier `const hdrs = await headers()` call in the rate-limit block. Reuse it. If the host header includes a port (`localhost:3000`), split on `:` to strip.

- [ ] **Step 2: Build & confirm**
  
  `cd apps/lobby && npm run build`
  Manual verify on staging: tap `/j/SOMECODE` over HTTPS, confirm session cookie is set and middleware sees it on the subsequent `/join/CODE` request.

### Task 5: `/j/[code]/page.tsx` is session-aware on GET

**Why:** Currently the page only validates the game and renders the welcome form regardless of visitor state. A returning player who reloads mid-wizard or revisits the link sees "What should we call you?" again. Worse, when Phase 3's recovery cascade redirects stale-session clients to `/j/CODE`, they need the page to route them correctly based on their state.

**Files:**
- Modify: `apps/lobby/app/j/[code]/page.tsx`

- [ ] **Step 1: Add `getSession` + invites check before rendering welcome form**
  
  Insert after the game-status check (around line 42), before the roster fetch:
  
  ```tsx
  // If visitor has a session, short-circuit based on their state in this game.
  const session = await getSession();
  if (session) {
    const enrolled = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, session.userId)
      .first();
    if (enrolled) {
      // Already a player → drop them into /play (mints fresh JWT, launches client)
      redirect(`/play/${code}`);
    }
    // Authed but not yet in this game — skip welcome, jump to persona picker.
    redirect(`/join/${code}`);
  }
  // Unauth visitor: continue to welcome form (existing behavior).
  ```
  
  Add `import { redirect } from 'next/navigation'` and `import { getSession } from '@/lib/auth'` at the top if missing.

- [ ] **Step 2: Verify each branch**
  
  Manual test matrix:
  - Anon visitor → welcome form renders (today's behavior)
  - Authed visitor, not enrolled → redirects to `/join/CODE` (persona picker)
  - Authed visitor, already enrolled → redirects to `/play/CODE` → client app
  
  For testing the authed branches, log in locally and hit `/j/<code-you-are-in>` vs `/j/<code-you-are-not-in>`.

- [ ] **Step 3: Build**
  
  `cd apps/lobby && npm run build`

**D1 read-after-write caveat**: the enrollment SELECT here reads `Invites` shortly after another path (`acceptInvite`) may have written to it. Cloudflare D1 has eventually-consistent reads across replicas — this SELECT can miss a just-committed write if it hits a lagged replica. In practice the timing window is sub-second, and the miss just means the user sees the welcome form once (the next reload works). Acceptable residual gap for this plan. If it becomes a recurring complaint, add D1 session bookmark via `db.withSession('first-primary')` on the read path. (Not implementing now — `lib/db.ts:40-43` doesn't expose session API yet; adding it is its own task.)

---

## Phase 3 — Recovery cascade redesign (P1)

**Why P1**: The C24FZ9 playtest's users all onboarded fresh, so the recovery gap didn't dominate their experience — but the 2026-04-23 LR8W3U playtester (the one whose URL share triggered this entire investigation) hit it. Any returning player with expired session + expired cached tokens currently gets bounced to magic-link. Fix: let them re-enter using a signature-valid JWT as identity proof.

### Task 6: New `/enter/[code]` route — smart recovery endpoint

**Why:** The client knows when it has failed to authenticate with a game (all cached tokens missing/expired, lobby refresh returned null). Rather than redirecting to `/play/CODE` (which then bounces to `/login` → magic link), redirect to a new `/enter/CODE` that accepts a `hint` parameter containing any signature-valid JWT from the client's storage. The lobby verifies the signature, restores a session for the `sub`, and routes through enrollment or straight to play. This supports the "I played game A last month, you shared game B with me" case.

**Security model**: signature-valid JWT is treated as identity proof, period. Blast radius on leak: the same as today (whoever has the JWT can already act as that user for the JWT's game). We do NOT scope-bind by URL invite code — the whole point is cross-game identity restoration. Magic link remains the path for users with no local JWT trace.

**Files:**
- Add: `apps/lobby/app/enter/[code]/route.ts`
- Modify: `packages/auth/src/index.ts` (to support `ignoreExpiration`)

- [ ] **Step 1: Extend `@pecking-order/auth` to support `ignoreExpiration`**
  
  `packages/auth/src/index.ts`: extend `verifyGameToken(token, secret, opts?)` where `opts.ignoreExpiration === true` catches `JWTExpired` errors and returns the decoded claims anyway. Preserve existing behavior when `opts` is omitted.
  
  Correct jose pattern (jose throws `JWTExpired` *after* signature verification, so the signature is already trusted when we catch):
  
  ```ts
  import { jwtVerify, decodeJwt, errors } from 'jose';
  
  export async function verifyGameToken(
    token: string,
    secret: string,
    opts?: { ignoreExpiration?: boolean },
  ): Promise<GameTokenPayload> {
    const key = new TextEncoder().encode(secret);
    try {
      const { payload } = await jwtVerify(token, key);
      return payload as GameTokenPayload;
    } catch (err) {
      if (opts?.ignoreExpiration && err instanceof errors.JWTExpired) {
        // Signature was verified before exp check; safe to decode.
        return decodeJwt(token) as GameTokenPayload;
      }
      throw err;
    }
  }
  ```
  
  Add a vitest covering: (a) valid unexpired token returns payload, (b) expired token throws without `ignoreExpiration`, (c) expired-but-signature-valid returns payload with `ignoreExpiration: true`, (d) bad-signature throws in all modes.

- [ ] **Step 2: Implement the `/enter/[code]` endpoint — POST only, hint in body**
  
  **Security note**: a JWT in a URL param leaks to browser history, CDN access logs, Sentry breadcrumbs, and the Referer header on any subsequent request. Even "immediate redirect" doesn't protect against those retention points. Accept the hint via POST body instead. The client issues a form POST (see Task 7).
  
  GET on `/enter/CODE` with no hint renders a tiny auto-submitting recovery page that POSTs back (analogous to Task 1's confirm page shape) — handles the case where someone lands at `/enter/CODE` directly (bookmark, bad redirect). That GET with no hint just routes to `/j/CODE`. The real work is POST:
  
  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { getDB, getEnv } from '@/lib/db';
  import { getSession, generateToken, setSessionCookie } from '@/lib/auth';
  import { verifyGameToken } from '@pecking-order/auth';
  
  const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
  
  // GET with no hint → just route to /j/CODE welcome (handles bookmarks / odd arrivals)
  export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const session = await getSession();
    if (session) return NextResponse.redirect(new URL(`/play/${code}`, req.url));
    return NextResponse.redirect(new URL(`/j/${code}`, req.url));
  }
  
  export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const formData = await req.formData();
    const hint = formData.get('hint') as string | null;
    const db = await getDB();
    const env = await getEnv();
    const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';
  
    const session = await getSession();
    if (session) return NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
  
    const game = await db
      .prepare('SELECT id, status FROM GameSessions WHERE invite_code = ?')
      .bind(code.toUpperCase())
      .first<{ id: string; status: string }>();
    if (!game) return NextResponse.redirect(new URL('/login?error=Game+not+found', req.url), 303);
  
    if (hint) {
      try {
        const decoded = await verifyGameToken(hint, AUTH_SECRET, { ignoreExpiration: true });
        const user = await db
          .prepare('SELECT id FROM Users WHERE id = ?')
          .bind(decoded.sub)
          .first<{ id: string }>();
        if (user) {
          const sessionId = generateToken();
          const now = Date.now();
          await db
            .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
            .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
            .run();
          await db.prepare('UPDATE Users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();
          const response = NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
          await setSessionCookie(response, sessionId, req.nextUrl.hostname);
          return response;
        }
      } catch {
        // Invalid hint (signature mismatch, malformed) — fall through to welcome.
      }
    }
  
    return NextResponse.redirect(new URL(`/j/${code}`, req.url), 303);
  }
  ```

- [ ] **Step 3: Test the endpoint**
  
  Manual test on local dev:
  - `curl -i http://localhost:3000/enter/NONEXISTENT` (GET) → 307 to `/j/NONEXISTENT`
  - `curl -i -X POST http://localhost:3000/enter/NONEXISTENT` (POST, no form body) → 303 to `/login?error=Game+not+found`
  - `curl -i -X POST -d "hint=" http://localhost:3000/enter/VALIDCODE` (empty hint) → 303 to `/j/VALIDCODE`
  - `curl -i -X POST -d "hint=<signature-valid-expired-JWT-for-sub-X>" http://localhost:3000/enter/VALIDCODE` where X exists in Users → 303 to `/play/VALIDCODE`, session cookie set
  - `curl -i -X POST -d "hint=garbage" http://localhost:3000/enter/VALIDCODE` → 303 to `/j/VALIDCODE`
  - **Authed viewer NOT a player in this game** (valid session cookie for user X, X has no Invites row for VALIDCODE): GET `/enter/VALIDCODE` → 307 to `/play/VALIDCODE` → `/play` returns its existing 403 response. Unchanged behavior inherited from `/play/CODE`; noted here so future readers don't expect `/enter/CODE` to handle non-participation specially.

### Task 7: Client recovery cascade routes to `/enter/CODE` with JWT hint

**Why:** Today `runAsyncRecovery` at `App.tsx:503-546` ends with `window.location.href = LOBBY_HOST/play/CODE` when all local token paths fail — which bounces to magic-link. Replace with a redirect to `/enter/CODE?hint=<any-JWT-we-have>`. The hint gives the lobby enough to restore identity without requiring magic-link.

**Files:**
- Modify: `apps/client/src/App.tsx`

- [ ] **Step 1: Extend `refreshFromLobby` to return reason alongside token**
  
  `App.tsx:206-222`:
  
  ```ts
  async function refreshFromLobby(gameCode: string): Promise<{ token: string | null; reason?: string }> {
    try {
      const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, { credentials: 'include' });
      if (!res.ok) {
        console.warn('[App] refreshFromLobby: lobby returned', res.status, 'for', gameCode);
        return { token: null, reason: `http_${res.status}` };
      }
      const { token, reason } = await res.json();
      return { token: token ?? null, reason };
    } catch (err) {
      console.warn('[App] Lobby token refresh failed:', err);
      return { token: null, reason: 'network_error' };
    }
  }
  ```
  
  Update the call site in `runAsyncRecovery` accordingly (destructure `token, reason`).

- [ ] **Step 2: Add `findAnyJwtHint` helper**
  
  After the existing token-recovery helpers, add:
  
  ```ts
  /** Return any locally-cached JWT to use as an identity hint when recovery fails.
   *  Prefers the most recently-issued (highest iat). Returns null if nothing is
   *  stored — the caller should then route the visitor through the frictionless
   *  welcome instead of attempting identity restoration. */
  function findAnyJwtHint(): string | null {
    let best: { jwt: string; iat: number } | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('po_token_')) continue;
      const jwt = localStorage.getItem(key);
      if (!jwt) continue;
      try {
        const decoded = decodeGameToken(jwt);
        const iat = decoded.iat ?? 0;
        if (!best || iat > best.iat) best = { jwt, iat };
      } catch {
        // Malformed — skip.
      }
    }
    if (best) return best.jwt;
    // Fallback: scan po_pwa_* cookies
    const matches = document.cookie.matchAll(/po_pwa_([^=]+)=([^;]+)/g);
    for (const m of matches) {
      try {
        const jwt = m[2];
        decodeGameToken(jwt); // parseable check
        return jwt;
      } catch {
        // skip
      }
    }
    return null;
  }
  ```

- [ ] **Step 3: Rewrite `runAsyncRecovery` final-step fallback**
  
  Replace `App.tsx:536-539` (the "Step 4: Redirect to lobby" block). **Use a form POST, not a URL param**, so the JWT hint never appears in browser history / CDN access logs / Referer headers:
  
  ```ts
  // Step 4: Recovery fallback — hand off to lobby's /enter/CODE with any
  // JWT we can find as identity hint. Submit via form POST so the JWT
  // doesn't leak into URL params, browser history, or access logs.
  // Lobby decides: restore identity → /play/CODE, or drop to /j/CODE welcome.
  const hint = findAnyJwtHint();
  console.log('[App] recovery step 4: redirecting to /enter/', code, hint ? '(with JWT hint)' : '(no hint)');
  setSentryAuthMethod('lobby-recover');
  if (hint) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${LOBBY_HOST}/enter/${code}`;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'hint';
    input.value = hint;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  } else {
    window.location.href = `${LOBBY_HOST}/j/${code}`;
  }
  ```

- [ ] **Step 4: Typecheck & manual smoke test**
  
  `cd apps/client && npm run build`
  Run locally: clear all storage, hit `http://localhost:5173/game/TESTCODE`. Confirm recovery lands on `/j/TESTCODE` (no hint available) rather than `/play/TESTCODE` → login. Then set a `po_token_OLDGAME` in localStorage (pick an expired but signature-valid JWT) and hit `/game/NEWCODE` — confirm redirect to `/enter/NEWCODE?hint=...` and then `/play/NEWCODE`.

### Task 8: `LauncherScreen` empty state surfaces "Sign in" CTA

**Why:** The DOUBLE-EXPIRED case (no session, no tokens anywhere) reaches the launcher via `runAsyncRecovery` or direct PWA launch. Current empty state shows "Have an invite code?" form only — no path for a returning player whose device fully expired. Add a visible "Sign in with email" link that goes to `${LOBBY_HOST}/login`.

**Files:**
- Modify: `apps/client/src/App.tsx` (the `LauncherScreen` component around line 604+)

- [ ] **Step 1: Add a "Sign in" link under the code-entry form when empty**
  
  Inside `LauncherScreen`, after the code entry form and ONLY when `cachedGames.length === 0`, add:
  
  ```tsx
  <div className="mt-6 text-center text-xs text-skin-dim">
    <p className="mb-2">Played before?</p>
    <a
      href={`${LOBBY_HOST}/login`}
      className="inline-block px-4 py-2 rounded-lg border border-skin-base/30 text-skin-base hover:border-skin-gold/50"
    >
      Sign in with email
    </a>
  </div>
  ```

- [ ] **Step 2: Verify**
  
  Clear browser storage, load the client's root URL. Confirm sign-in link appears. Click it — confirm it navigates to lobby `/login`.

---

## Phase 4 — Canonical share URL (P1)

**Why P1**: The host's "Copy Link" button today shares `/join/CODE` which requires login. Changing it to `/j/CODE` means strangers who tap shared links hit the frictionless welcome. High-leverage single-line change + small supporting UX.

**`/join/CODE` emitter audit (verified 2026-04-24)**:
- `apps/lobby/app/game/[id]/waiting/page.tsx:116` — host Copy Link — **fix in Step 1 below**.
- `apps/lobby/app/invite/[token]/route.ts:34` — already-used branch bounces unauth user to `/join/CODE` — **already rerouted to `/j/CODE` by Task 1**.
- `apps/lobby/app/invite/[token]/route.ts:74` — POST-success redirect — stays `/join/CODE` (user is authenticated at that point, cookie just set; middleware won't bounce). No change needed.
- `apps/lobby/app/page.tsx:1271` — host-home "Join as Host" link — host is authed, safe. Consider renaming for clarity in a later pass; not in scope here.
- Email templates (`apps/lobby/lib/email-templates.ts`) and `apps/nudge-worker/` emit no `/join/` URLs directly — invite emails contain `/invite/TOKEN` which resolves internally.

Audit result: no additional emitters need to change as part of this phase.

### Task 9: Host waiting room "Copy Link" → `/j/CODE` + visible canonical URL

**Files:**
- Modify: `apps/lobby/app/game/[id]/waiting/page.tsx`

- [ ] **Step 1: Change `handleCopyLink`**
  
  `waiting/page.tsx:116`:
  
  ```ts
  // OLD:
  const link = `${window.location.origin}/join/${code.toUpperCase()}`;
  // NEW:
  const link = `${window.location.origin}/j/${code.toUpperCase()}`;
  ```

- [ ] **Step 2: Surface the full URL in the UI**
  
  In the header area near the invite code display, replace the bare code block with:
  
  ```tsx
  <div className="space-y-2 mt-2">
    <div className="text-[10px] font-bold text-skin-dim uppercase tracking-widest">Invite link</div>
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-skin-input/60">
      <code className="flex-1 text-xs font-mono text-skin-base truncate">
        {typeof window !== 'undefined' ? `${window.location.origin}/j/${code.toUpperCase()}` : ''}
      </code>
      <button onClick={handleCopyLink} className="text-xs font-bold text-skin-gold px-2 py-1 rounded border border-skin-gold/30">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  </div>
  ```
  
  Lets hosts see *what they're sharing* before tapping Copy, preventing them from reconstructing URLs by hand.

- [ ] **Step 3: Verify**
  
  Create a test game locally, open waiting room, click Copy. Paste into a new browser window, confirm `/j/CODE` loads the welcome form (not `/login`).

---

## Phase 5 — Host impersonation fix (P1)

**Why P1**: Documented in `docs/runbooks/playtest-pitfalls.md` #8, partially patched on `getGameSessionStatus` but `startGame()` still returns all players' tokens. A host in any slot other than `p1` who clicks "Launch Game" enters the client as `p1`.

### Task 10: `startGame()` returns only the caller's token

**Files:**
- Modify: `apps/lobby/app/actions.ts` (the `startGame` function around line 665-829)

**Reachability confirmed (2026-04-24 grep)**: `startGame` is still called at `apps/lobby/app/game/[id]/waiting/page.tsx:77`. The earlier "revert of the Start Game button" (commit 9187fe4) was a different, host-facing button on `/game/CODE/waiting` for CC games — the Launch Game button for STATIC games still calls `startGame()`. Task 10 is NOT dead code; the host-impersonation bug is reachable in production.

- [ ] **Step 1: Confirm game-server `/init` contract**
  
  Read `apps/game-server/src/http-handlers.ts` `/init` route. Look for any dependency on an incoming `tokens` field. Expected: `/init` takes roster only; tokens are for client-side use, not forwarded to game-server. If `tokens` is forwarded to game-server, flag as a follow-up — but this task is safe to do either way because the caller doesn't NEED all tokens.

- [ ] **Step 2: Move token minting outside the all-players roster loop**
  
  Currently `actions.ts:728-758` mints a JWT per-player inside the roster loop and stuffs every one into `tokens`. Change to:
  
  ```ts
  // Build roster (no tokens in the loop)
  const roster: Roster = {};
  for (let i = 0; i < invites.length; i++) {
    const inv = invites[i];
    const pid = `p${i + 1}`;
    roster[pid] = {
      realUserId: inv.accepted_by,
      personaName: inv.persona_name,
      avatarUrl: personaImageUrl(inv.persona_id, 'headshot', env.PERSONA_ASSETS_URL as string),
      bio: inv.custom_bio || inv.persona_description,
      qaAnswers: inv.qa_answers ? JSON.parse(inv.qa_answers) : undefined,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: 'FLOAT',
    };
  }
  
  // Mint token ONLY for the calling user, mirroring getGameSessionStatus's pattern.
  const myInviteIndex = invites.findIndex((i) => i.accepted_by === session.userId);
  let tokens: Record<string, string> | undefined;
  if (myInviteIndex >= 0) {
    const myPid = `p${myInviteIndex + 1}`;
    const myInvite = invites[myInviteIndex];
    const tokenExpiry = `${game.day_count * 2 + 7}d`;
    tokens = {
      [myPid]: await signGameToken(
        { sub: session.userId, gameId: game.id, playerId: myPid, personaName: myInvite.persona_name },
        AUTH_SECRET,
        tokenExpiry,
      ),
    };
  }
  ```

- [ ] **Step 3: Verify host-impersonation is closed**
  
  Locally: create a game, have two users accept (arrange for the host to be p2, not p1). Click Launch from the host's window. Confirm waiting-page's `Object.keys(tokens)[0]` is `p2` (the host's actual slot), not `p1`. Confirm client `_t=` query param decodes to `playerId: 'p2'`.

---

## Phase 6 — Edge hardening (P2, deferrable)

### Task 11: Enable Cloudflare "Always Use HTTPS" on lobby and api domains

**Why (confirmed 2026-04-24)**: `curl -i http://staging-lobby.peckingorder.ca/` returns 307 redirect that STAYS on HTTP (goes to `http://staging-lobby.peckingorder.ca/login?next=%2F`). HTTP requests reach the worker. The `staging-play.peckingorder.ca` domain correctly returns 301→https — so the zone-level setting is partial, not global.

- [ ] **Step 1: Dashboard configuration**
  
  Cloudflare Dashboard → SSL/TLS → Edge Certificates → Always Use HTTPS: ON. Likely needs to be enabled per-subdomain or via a Page Rule — check why the `play` subdomain already redirects while `lobby` doesn't (could be a Page Rule, different zone, or explicit override). Match the `play` config for `lobby`, `api`, and any other missing subdomains.

- [ ] **Step 2: Verify via curl**
  
  After enabling: `curl -sI http://staging-lobby.peckingorder.ca/` should return `301` with `location: https://...`. Confirm for `lobby`, `api`, all playtest subdomains.

### Task 12: Add structured logging to `/invite/[token]` and `/login/verify`

**Why:** Current routes are silent on failure branches. Future investigations need at-a-glance visibility.

- [ ] **Step 1: Log at each branch**

  Use `console.log(JSON.stringify({ level, component, event, data }))` for each:
  - `invite.invalid` — token not found
  - `invite.expired` — token expired
  - `invite.already_used` — if the bot-prefetch pattern recurs, include `ageSinceCreatedMs` in data
  - `invite.consumed` — successful POST, include `emailHash` (not email) for tracing
  - Mirror for `/login/verify`.

---

## Verification strategy

**Unit / integration tests** (required — auth-flow regression risk is real):

Add vitest coverage, aiming for ~30 minutes of test work to lock in the fixes:

1. **`packages/auth/__tests__/verifyGameToken.test.ts`** — table-driven:
   - Valid unexpired token → returns payload.
   - Expired token, `ignoreExpiration` omitted → throws `JWTExpired`.
   - Expired token, `ignoreExpiration: true` → returns payload.
   - Bad-signature token → throws regardless of `ignoreExpiration`.
   - Malformed token → throws regardless of `ignoreExpiration`.

2. **`apps/lobby/__tests__/invite-route.test.ts`** — mock D1:
   - GET with unknown token → 307 to `/login?error=Invalid+invite+link`, token untouched.
   - GET with expired token → 307 to `/login?error=Invite+link+expired`, token untouched.
   - GET with already-used token → 307 to `/j/CODE`, token unchanged (`used=1`).
   - GET with valid-unused token → 200 HTML, token STILL `used=0` (the critical assertion — GET must not consume).
   - POST with valid-unused token → 303 to `/join/CODE`, token `used=1`, Set-Cookie header present.
   - POST called twice in rapid succession → second hits `if (used)` branch, returns 303 without double-creating session.

3. **`apps/lobby/__tests__/setSessionCookie.test.ts`** — cookie-attribute helper:
   - Localhost hostname → no `secure`, no `domain`.
   - Production hostname → `secure: true`, `domain: .peckingorder.ca`.
   - Cookie name matches `SESSION_COOKIE_NAME` env var (fallback to `po_session`).
   - All attributes (`httpOnly`, `sameSite=lax`, `path=/`, `maxAge`) present in both modes.

**Manual curl / browser**: each task includes explicit test-case steps with D1 state assertions.

**End-to-end playtest**: After Phases 1-3 ship, run a staged playtest using the `playtest-sim` skill with 4-6 simulated invitees. Measure:
- % of invites consumed via `/invite/POST` vs. stuck on `used=1` (target: ~0% stuck unless token truly expired)
- % of recipients who also receive a `/login/verify` email after (target: < 20%, down from the ~80% we've been observing)
- Any `/login?error=Link+already+used` hits in lobby logs (target: 0)

**Post-deploy monitoring (first week)**:
- Resend dashboard: watch the ratio of "You've been invited" to "Your Pecking Order Login Link" emails per user. Pre-fix ratio: ~1:1. Target: > 5:1.
- Axiom query for `/invite/` POST vs GET volume ratio. Healthy: most consumes are POSTs. Unhealthy: GETs still marking used (regression).

**Concrete revert triggers** (if any fires within 48h of deploy, roll back the responsible phase):
- `/login?error=Link+already+used` hits in lobby Axiom logs > 2/day — Phase 1 regression (Task 1 or Task 2).
- `/enter/CODE` POST → `/login?error=...` rate > 10% of all POSTs — Phase 3 regression (Task 6).
- Sentry reports of "stuck on spinner" from Task 1's confirm page (visible via session replays) — Phase 1 auto-submit regression; revisit the 150ms/3s timing.
- D1 writes to `Sessions` spike without corresponding `/invite/POST` or `/login/verify POST` — something else is minting sessions (should not happen).

**Migration note for in-flight invite emails**: invite emails delivered BEFORE Phase 1 ships contain URLs to a GET-consumes handler. After Phase 1 deploys, those same URLs hit the new GET-renders-page handler — the recipient sees the confirmation page instead of a direct redirect. Auto-submit handles this transparently for JS-enabled browsers (all real users). Pre-existing emails stay functional; no user-visible disruption.

If an email was pre-fetched by a scanner BEFORE Phase 1 ships, its token is already `used=1` and the user will still bounce to `/j/CODE` (via Task 1's `if (used)` branch) on their click. That's no worse than today's behavior. They can be re-invited by the host via the waiting-room email form — which now also benefits from the POST-consumes pattern.

---

## Risks & trade-offs

**Expired-JWT-as-identity** (Task 6): A leaked JWT remains valid identity proof indefinitely (until `AUTH_SECRET` rotates). For a low-stakes social game between friends this is an acceptable trade for friction reduction. Mitigations:
- Optional follow-up: cap acceptance window (e.g., refuse hints where `now - exp > 90 days`). Not implemented initially; revisit if abuse surfaces.
- `AUTH_SECRET` rotation kills all historical JWTs → emergency revocation path.

**Auto-submit JS bypass** (Tasks 1, 2): Sophisticated scanners could start executing JS to defeat the POST barrier. Not a current threat in the wild (scanners today are GET-only). If/when scanners evolve, fallback is CAPTCHA or server-side bot-challenge — out of scope now.

**`/enter/CODE` hint delivery** (Task 6): hint is delivered via POST form body, not URL query. Browser history, CDN access logs, Sentry breadcrumbs, and Referer headers do not retain the JWT. This is a deliberate security property of the Task 6 / Task 7 design, not a mitigation — URL-param hint passing was considered and rejected.

**Existing in-flight games' tokens**: None of these changes invalidate existing JWTs. Users with live sessions stay authenticated.

---

## Open questions (deferred, not blocking this plan)

1. **OAuth providers** (Apple Sign-In, Google Sign-In): strategic question for the audience (teens). Should be evaluated separately once magic-link + frictionless is reliable.
2. **Anon user cross-device recovery**: a user who joined via `/j/CODE` without email cannot currently be recovered if their device is wiped. Mitigation: optional email-attach at enrollment time. Surface as follow-up.
3. **Capping expired-JWT acceptance window**: see Risks above. Revisit if/when first abuse case surfaces.
4. **In-client share UI**: separate feature. Once canonical share URL (Phase 4) is stable, adding a share button inside the client is ~50 lines.
5. **`/play/CODE` non-participant 403 page**: currently returns bare text. Low priority cosmetic; separate cleanup.

---

## Sequencing recommendation

**Ship Phases 1 & 2 together in one PR** — they're the highest-value fixes and are all route-handler / action changes, low risk, easy to review. Run a smoke-test playtest before moving on.

**Phase 3 depends on the `@pecking-order/auth` package change** (ignoreExpiration) — package bump required. Slightly heavier PR, but self-contained.

**Phases 4-5** are independent cleanups; can go in parallel or after.

**Phase 6** is deferrable. Do when you have a quiet moment.

---

**Total scope estimate**: 4-6 hours for an engineer to implement Phases 1-3 cleanly, plus a playtest-sim round to verify. Phases 4-5 add another 1-2 hours. Plan is aggressive but has clear natural break-points.
