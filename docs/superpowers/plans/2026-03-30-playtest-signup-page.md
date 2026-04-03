# Playtest Signup Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, mobile-first playtest signup page at `/playtest` in the lobby app, with email confirmation, Resend Audience integration, Cloudflare Turnstile, and social sharing.

**Architecture:** RSC page (zero client JS) with a tiny `"use client"` form component (~3KB) and a small share-buttons client component. Server Action handles validation, D1 insert, Resend email + Audience upsert. Turnstile for bot protection.

**Tech Stack:** Next.js 15 (App Router), D1, Resend (email + Audiences/Contacts API), Cloudflare Turnstile, `skin-*` Tailwind tokens from `@pecking-order/ui-kit`.

**Design Spec:** `docs/plans/2026-03-30-playtest-signup-page-design.md`

---

## File Structure

```
apps/lobby/
├── app/playtest/
│   ├── layout.tsx              # OG/Twitter/Discord metadata, minimal wrapper
│   ├── page.tsx                # RSC: hero, persona images, teaser strip, renders form + share buttons
│   ├── signup-form.tsx         # "use client": form fields, Turnstile, submission states
│   ├── share-buttons.tsx       # "use client": Twitter/X, Discord, Copy Link (clipboard API)
│   ├── actions.ts              # Server Action: validate, rate limit, D1 insert, Resend email + audience
│   └── constants.ts            # Referral source enum, labels, validation
├── lib/
│   └── email-templates.ts      # Add buildPlaytestConfirmationHtml() (modify existing)
├── migrations/
│   └── 0009_playtest_signups.sql  # New table
└── package.json                # Add zod, @marsidev/react-turnstile
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/lobby/package.json`

- [ ] **Step 1: Add zod and @marsidev/react-turnstile**

```bash
cd apps/lobby && npm install zod @marsidev/react-turnstile
```

`zod` is used in `packages/shared-types` already but not a direct lobby dependency. `@marsidev/react-turnstile` is a lightweight (1.6KB gzipped) React wrapper for Cloudflare Turnstile that handles SSR, script loading, and invisible mode.

- [ ] **Step 2: Verify installation**

Run: `cd apps/lobby && node -e "require('zod'); require('@marsidev/react-turnstile'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/package.json apps/lobby/package-lock.json
git commit -m "chore(lobby): add zod and @marsidev/react-turnstile for playtest signup"
```

---

### Task 2: D1 Migration

**Files:**
- Create: `apps/lobby/migrations/0009_playtest_signups.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Playtest signup interest list.
-- Stores email + referral source for future playtest invitations.
-- Rate limiting uses ip_address + signed_up_at.
CREATE TABLE PlaytestSignups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  referral_source TEXT NOT NULL,
  referral_detail TEXT,
  signed_up_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT
);

CREATE INDEX idx_playtest_signups_email ON PlaytestSignups(email);
CREATE INDEX idx_playtest_signups_ip ON PlaytestSignups(ip_address, signed_up_at);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd apps/lobby && npx wrangler d1 migrations apply DB --local`
Expected: Migration 0009 applied successfully.

- [ ] **Step 3: Verify table exists**

Run: `cd apps/lobby && npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='PlaytestSignups'"`
Expected: Output includes `PlaytestSignups`.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/migrations/0009_playtest_signups.sql
git commit -m "feat(lobby): add PlaytestSignups D1 migration"
```

---

### Task 3: Constants and Validation

**Files:**
- Create: `apps/lobby/app/playtest/constants.ts`

- [ ] **Step 1: Create constants file with referral source enum, labels, and Zod schema**

```typescript
import { z } from 'zod';

export const REFERRAL_SOURCES = [
  'FRIEND',
  'REDDIT',
  'TWITTER',
  'DISCORD',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'BLOG',
  'OTHER',
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_LABELS: Record<ReferralSource, string> = {
  FRIEND: 'Friend / word of mouth',
  REDDIT: 'Reddit',
  TWITTER: 'Twitter / X',
  DISCORD: 'Discord',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  BLOG: 'Blog / article',
  OTHER: 'Other',
};

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(254),
  referralSource: z.enum(REFERRAL_SOURCES, {
    errorMap: () => ({ message: 'Please select how you heard about us' }),
  }),
  referralDetail: z
    .string()
    .max(200, 'Maximum 200 characters')
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  turnstileToken: z.string().min(1, 'Please complete the verification'),
});

export type SignupInput = z.infer<typeof signupSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/playtest/constants.ts
git commit -m "feat(lobby): add playtest signup constants and validation schema"
```

---

### Task 4: Confirmation Email Template

**Files:**
- Modify: `apps/lobby/lib/email-templates.ts`

- [ ] **Step 1: Add the playtest confirmation email builder**

Add this export at the end of `apps/lobby/lib/email-templates.ts`, after the existing `buildLoginEmailHtml` function:

```typescript
export function buildPlaytestConfirmationHtml(opts: {
  assetsUrl: string;
  lobbyUrl: string;
  playtestUrl: string;
}): string {
  return wrap(`
    ${logo(opts.assetsUrl, opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 6px;font-size:20px;font-weight:bold;color:${GOLD};text-align:center;">
        You're on the list!
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:${DIM};text-align:center;line-height:1.6;">
        We'll email you when the next playtest is scheduled.<br>
        In the meantime, help us find more players:
      </p>
      ${button('Share With Friends', opts.playtestUrl)}
    `)}
    ${footer('Pecking Order — A social game of alliances, betrayal & strategy')}
  `);
}
```

- [ ] **Step 2: Verify the lobby still builds**

Run: `cd apps/lobby && npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/lib/email-templates.ts
git commit -m "feat(lobby): add playtest confirmation email template"
```

---

### Task 5: Server Action

**Files:**
- Create: `apps/lobby/app/playtest/actions.ts`

- [ ] **Step 1: Create the server action**

```typescript
'use server';

import { getDB, getEnv } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildPlaytestConfirmationHtml } from '@/lib/email-templates';
import { signupSchema } from './constants';
import { Resend } from 'resend';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

export async function submitPlaytestSignup(
  data: {
    email: string;
    referralSource: string;
    referralDetail?: string;
    turnstileToken: string;
  },
  ipAddress: string | null,
): Promise<{ success?: boolean; error?: string }> {
  // 1. Validate input
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const { email, referralSource, referralDetail, turnstileToken } = parsed.data;

  try {
    const env = await getEnv();

    // 2. Verify Turnstile token
    const turnstileSecret = env.TURNSTILE_SECRET_KEY as string | undefined;
    if (turnstileSecret) {
      const turnstileRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
          }),
        },
      );
      const turnstileResult = (await turnstileRes.json()) as { success: boolean };
      if (!turnstileResult.success) {
        return { error: 'Verification failed. Please try again.' };
      }
    }

    // 3. Rate limit by IP
    const db = await getDB();
    if (ipAddress) {
      const { results: recentSignups } = await db
        .prepare(
          `SELECT COUNT(*) as count FROM PlaytestSignups
           WHERE ip_address = ? AND signed_up_at > datetime('now', ?)`,
        )
        .bind(ipAddress, `-${RATE_LIMIT_WINDOW_HOURS} hours`)
        .all<{ count: number }>();

      if (recentSignups[0] && recentSignups[0].count >= RATE_LIMIT_MAX) {
        return { error: 'Slow down — try again in a bit.' };
      }
    }

    // 4. Insert into D1 (UNIQUE constraint handles dupes)
    try {
      await db
        .prepare(
          `INSERT INTO PlaytestSignups (email, referral_source, referral_detail, ip_address)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          email.toLowerCase(),
          referralSource,
          referralDetail || null,
          ipAddress,
        )
        .run();
    } catch (err: any) {
      // UNIQUE constraint violation = already signed up
      if (err?.message?.includes('UNIQUE')) {
        return { success: true }; // Don't leak that email exists
      }
      throw err;
    }

    // 5. Send confirmation email
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey) {
      const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
      const lobbyUrl = (env.LOBBY_HOST as string) || '';
      const playtestUrl = (env.PLAYTEST_URL as string) || 'https://playtest.peckingorder.ca';

      const html = buildPlaytestConfirmationHtml({ assetsUrl, lobbyUrl, playtestUrl });
      await sendEmail(email, "You're on the list!", html, resendApiKey);

      // 6. Upsert to Resend Audience
      const audienceId = env.RESEND_PLAYTEST_AUDIENCE_ID as string | undefined;
      if (audienceId) {
        const resend = new Resend(resendApiKey);
        await resend.contacts.create({
          email: email.toLowerCase(),
          audienceId,
          unsubscribed: false,
        }).catch((err) => {
          // Non-critical — log but don't fail the signup
          console.error('[Playtest] Audience upsert failed:', err);
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Playtest] Signup error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
```

- [ ] **Step 2: Create a wrapper action that extracts the IP from headers**

The server action above takes `ipAddress` as a parameter. In Next.js, we can't access headers directly inside a function called from the client. We need a thin wrapper that the form calls.

Add this to the **top** of the same `actions.ts` file, below the imports:

```typescript
import { headers } from 'next/headers';
```

Then add this public-facing action above `submitPlaytestSignup`:

```typescript
export async function handlePlaytestSignup(data: {
  email: string;
  referralSource: string;
  referralDetail?: string;
  turnstileToken: string;
}): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers();
  const ip =
    headersList.get('cf-connecting-ip') ||
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  return submitPlaytestSignup(data, ip);
}
```

The form component will call `handlePlaytestSignup()`. The `submitPlaytestSignup()` function stays testable with explicit IP injection.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/app/playtest/actions.ts
git commit -m "feat(lobby): add playtest signup server action with Turnstile + rate limit"
```

---

### Task 6: Page Layout with OG Metadata

**Files:**
- Create: `apps/lobby/app/playtest/layout.tsx`

- [ ] **Step 1: Create the layout with social media metadata**

```tsx
import type { Metadata } from 'next';

const PLAYTEST_URL = 'https://playtest.peckingorder.ca';
const TITLE = 'Pecking Order — Join the Playtest';
const DESCRIPTION =
  'A social game of alliances, betrayal & strategy. Sign up to play.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PLAYTEST_URL,
    siteName: 'Pecking Order',
    images: [
      {
        url: `${PLAYTEST_URL}/og-playtest.png`,
        width: 1200,
        height: 630,
        alt: 'Pecking Order — Join the Playtest',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${PLAYTEST_URL}/og-playtest.png`],
  },
  other: {
    'theme-color': '#2c003e',
  },
};

export default function PlaytestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/playtest/layout.tsx
git commit -m "feat(lobby): add playtest layout with OG/Twitter/Discord metadata"
```

---

### Task 7: Share Buttons Component

**Files:**
- Create: `apps/lobby/app/playtest/share-buttons.tsx`

- [ ] **Step 1: Create the share buttons client component**

```tsx
'use client';

import { useState } from 'react';

const PLAYTEST_URL = 'https://playtest.peckingorder.ca';
const SHARE_TEXT =
  'Check out Pecking Order — a social game of alliances, betrayal & strategy. Sign up for the next playtest!';

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function ShareButtons({ emphasis = false }: { emphasis?: boolean }) {
  const [copied, setCopied] = useState(false);

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(PLAYTEST_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareDiscord() {
    navigator.clipboard.writeText(`${SHARE_TEXT}\n${PLAYTEST_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(PLAYTEST_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const btnBase = emphasis
    ? 'rounded-xl px-5 py-3 text-sm font-bold'
    : 'rounded-lg px-4 py-2.5 text-xs font-semibold';

  return (
    <div className="text-center">
      {emphasis ? (
        <>
          <p className="text-skin-gold font-display font-bold text-base mb-1">
            Help us find more players!
          </p>
          <p className="text-skin-dim text-sm mb-4">
            The more players, the better the game.
          </p>
        </>
      ) : (
        <p className="text-skin-dim text-sm mb-3">Know someone who'd play?</p>
      )}
      <div className="flex gap-3 justify-center">
        <button
          onClick={shareTwitter}
          className={`${btnBase} bg-skin-input text-skin-dim hover:text-skin-base transition-colors flex items-center gap-2`}
        >
          <TwitterIcon />
          Twitter
        </button>
        <button
          onClick={shareDiscord}
          className={`${btnBase} bg-[#5865F2] text-white hover:brightness-110 transition-all flex items-center gap-2`}
        >
          <DiscordIcon />
          Discord
        </button>
        <button
          onClick={copyLink}
          className={`${btnBase} bg-skin-input text-skin-dim hover:text-skin-base transition-colors flex items-center gap-2`}
        >
          <LinkIcon />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/playtest/share-buttons.tsx
git commit -m "feat(lobby): add share buttons component (Twitter, Discord, Copy Link)"
```

---

### Task 8: Signup Form Component

**Files:**
- Create: `apps/lobby/app/playtest/signup-form.tsx`

- [ ] **Step 1: Create the client form component**

```tsx
'use client';

import { useState, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { handlePlaytestSignup } from './actions';
import { REFERRAL_SOURCES, REFERRAL_LABELS } from './constants';
import { ShareButtons } from './share-buttons';

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [email, setEmail] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralDetail, setReferralDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!turnstileToken && turnstileSiteKey) {
      setError('Please wait for verification to complete.');
      return;
    }

    setIsLoading(true);
    const result = await handlePlaytestSignup({
      email,
      referralSource,
      referralDetail: referralSource === 'OTHER' ? referralDetail : undefined,
      turnstileToken,
    });
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-skin-green/15 rounded-full flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-skin-green">
            You're In!
          </h2>
          <p className="text-skin-dim text-sm">Check your inbox for a confirmation.</p>
          <p className="text-skin-dim/60 text-xs">
            We'll reach out when the next playtest is ready.
          </p>
        </div>
        <div className="pt-2 border-t border-skin-base/20">
          <ShareButtons emphasis />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="signup-email"
          className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
        >
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-dim/30"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="signup-referral"
          className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
        >
          How did you hear about us?
        </label>
        <select
          id="signup-referral"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          required
          className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm appearance-none"
        >
          <option value="" disabled>
            Select one...
          </option>
          {REFERRAL_SOURCES.map((src) => (
            <option key={src} value={src}>
              {REFERRAL_LABELS[src]}
            </option>
          ))}
        </select>
      </div>

      {referralSource === 'OTHER' && (
        <div className="space-y-1.5">
          <label
            htmlFor="signup-referral-detail"
            className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
          >
            Tell us more
          </label>
          <input
            id="signup-referral-detail"
            type="text"
            value={referralDetail}
            onChange={(e) => setReferralDetail(e.target.value)}
            placeholder="Where did you find us?"
            maxLength={200}
            className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-dim/30"
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm">
          {error}
        </div>
      )}

      {turnstileSiteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken('')}
          onExpire={() => setTurnstileToken('')}
          options={{ size: 'invisible' }}
        />
      )}

      <button
        type="submit"
        disabled={isLoading || !email || !referralSource}
        className={`w-full py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-3
          ${
            isLoading
              ? 'bg-skin-input text-skin-dim/40 cursor-wait'
              : 'bg-gradient-to-r from-skin-gold to-yellow-500 text-skin-deep shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
          }`}
      >
        {isLoading ? (
          <>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:75ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
          </>
        ) : (
          'Sign Me Up'
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/playtest/signup-form.tsx
git commit -m "feat(lobby): add playtest signup form with Turnstile integration"
```

---

### Task 9: RSC Page

**Files:**
- Create: `apps/lobby/app/playtest/page.tsx`

This is the main server component. It queries D1 for random personas, renders the hero, form, teaser strip, and share buttons.

- [ ] **Step 1: Create the page component**

```tsx
import { getDB, getEnv } from '@/lib/db';
import { SignupForm } from './signup-form';
import { ShareButtons } from './share-buttons';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
}

async function getRandomPersonas(count: number): Promise<Persona[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        'SELECT id, name, stereotype FROM PersonaPool ORDER BY RANDOM() LIMIT ?',
      )
      .bind(count)
      .all<Persona>();
    return results;
  } catch {
    return [];
  }
}

function PersonaCard({ persona, assetsUrl }: { persona: Persona; assetsUrl: string }) {
  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${persona.id}/headshot.png`
    : `/api/persona-image/${persona.id}/headshot.png`;

  return (
    <div className="w-20 h-24 rounded-xl overflow-hidden border border-skin-base/30 shadow-lg flex-shrink-0">
      <img
        src={imgSrc}
        alt={persona.name}
        width={80}
        height={96}
        className="w-full h-full object-cover"
        loading="eager"
      />
    </div>
  );
}

export default async function PlaytestPage() {
  const [personas, env] = await Promise.all([
    getRandomPersonas(5),
    getEnv(),
  ]);

  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY as string) || '';

  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base selection:bg-skin-gold/30">
      {/* Hero */}
      <header className="bg-gradient-to-b from-skin-deep to-skin-panel pt-10 pb-8 px-6 text-center">
        {personas.length > 0 && (
          <div className="flex justify-center gap-2 mb-6">
            {personas.slice(0, 3).map((p, i) => (
              <div
                key={p.id}
                className={
                  i === 1
                    ? '-translate-y-2'
                    : i === 0
                      ? '-rotate-3'
                      : 'rotate-3'
                }
              >
                <PersonaCard persona={p} assetsUrl={assetsUrl} />
              </div>
            ))}
          </div>
        )}

        <h1 className="font-display font-black text-3xl md:text-5xl text-skin-gold tracking-tight text-glow mb-2">
          PECKING ORDER
        </h1>
        <p className="text-skin-dim text-sm md:text-base font-light tracking-wide mb-4">
          A social game of alliances, betrayal & strategy
        </p>
        <span className="inline-block bg-skin-gold/15 border border-skin-gold/30 rounded-full px-4 py-1.5 text-skin-gold text-xs font-semibold uppercase tracking-widest">
          Playtesting Now
        </span>
      </header>

      {/* Form */}
      <main className="px-6 py-8 max-w-md mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-display font-bold text-lg text-skin-base mb-1">
            Join the Next Playtest
          </h2>
          <p className="text-skin-dim text-sm">
            Be the first to know when we're ready for you.
          </p>
        </div>

        <SignupForm turnstileSiteKey={turnstileSiteKey} />
      </main>

      {/* Teaser Strip */}
      <section className="bg-skin-panel/60 py-6 px-6">
        <div className="flex gap-6 justify-center mb-3">
          {[
            { icon: '🗳️', label: 'Vote' },
            { icon: '🤝', label: 'Ally' },
            { icon: '🗡️', label: 'Betray' },
            { icon: '👑', label: 'Survive' },
          ].map(({ icon, label }) => (
            <div key={label} className="text-center">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-skin-dim text-xs font-medium">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-skin-dim/50 text-xs">
          Play from your phone. Games run over multiple days.
        </p>
      </section>

      {/* Share */}
      <section className="py-6 px-6 border-t border-skin-base/10">
        <ShareButtons />
      </section>

      {/* Footer */}
      <footer className="bg-skin-deep/80 py-5 text-center">
        <a
          href="https://peckingorder.ca"
          className="text-skin-dim/40 text-xs hover:text-skin-dim transition-colors"
        >
          peckingorder.ca
        </a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/playtest/page.tsx
git commit -m "feat(lobby): add playtest signup RSC page with persona hero"
```

---

### Task 10: Environment Variables

**Files:**
- Modify: `apps/lobby/wrangler.json` (add env vars to staging + production)
- Create/Modify: `apps/lobby/.dev.vars` (local dev secrets)

- [ ] **Step 1: Add new vars to staging and production in wrangler.json**

Add `PLAYTEST_URL` and `TURNSTILE_SITE_KEY` to the `vars` block under both `staging` and `production` in `apps/lobby/wrangler.json`.

In **staging.vars**, add:
```json
"PLAYTEST_URL": "https://staging-playtest.peckingorder.ca",
"TURNSTILE_SITE_KEY": ""
```

In **production.vars**, add:
```json
"PLAYTEST_URL": "https://playtest.peckingorder.ca",
"TURNSTILE_SITE_KEY": ""
```

The actual Turnstile keys will be set via `wrangler secret put` or the Cloudflare dashboard. `RESEND_PLAYTEST_AUDIENCE_ID` and `TURNSTILE_SECRET_KEY` are secrets — they go in `.dev.vars` locally and `wrangler secret` for deployed envs.

- [ ] **Step 2: Add local dev secrets to .dev.vars**

Add these lines to `apps/lobby/.dev.vars` (create if it doesn't exist — this file is gitignored):

```
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
RESEND_PLAYTEST_AUDIENCE_ID=
```

The `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` values are Cloudflare's always-passing test keys for local development.

- [ ] **Step 3: Commit wrangler.json changes only (not .dev.vars)**

```bash
git add apps/lobby/wrangler.json
git commit -m "feat(lobby): add Turnstile and playtest env vars to wrangler config"
```

---

### Task 11: OG Image Placeholder

**Files:**
- Create: `apps/lobby/public/og-playtest.png`

- [ ] **Step 1: Create a placeholder OG image**

For now, create a simple 1200x630 placeholder. We can replace it with a designed image later.

Use any approach that works:
- Export from a design tool
- Generate with canvas/sharp
- Use a placeholder service

The image should have:
- Deep purple background (`#2c003e`)
- "PECKING ORDER" in gold
- "Join the Playtest" subtext

If tooling isn't readily available, skip this step and add a TODO comment in the layout metadata. The page will still work — social previews will just lack an image.

- [ ] **Step 2: Commit (if image was created)**

```bash
git add apps/lobby/public/og-playtest.png
git commit -m "feat(lobby): add playtest OG image for social sharing"
```

---

### Task 12: Build Verification and Manual Test

- [ ] **Step 1: Verify the lobby builds**

Run: `cd apps/lobby && npx next build`
Expected: Build succeeds. The `/playtest` route appears in the build output.

- [ ] **Step 2: Start local dev**

Run: `cd /Users/manu/Projects/pecking-order && npm run dev`

- [ ] **Step 3: Verify the page loads**

Open `http://localhost:3000/playtest` in a browser. Verify:
- Hero section with persona images loads
- Form is visible above the fold on mobile viewport
- Dropdown shows all referral sources
- Selecting "Other" reveals the free-text input
- Share buttons are visible at the bottom
- Page is styled with the purple/gold/pink theme

- [ ] **Step 4: Test form submission**

Fill in the form and submit. Verify:
- Loading state shows bouncing dots
- On success, form is replaced with "You're In!" confirmation
- Share buttons appear with emphasis styling in the success state
- D1 has the record: `npx wrangler d1 execute DB --local --command "SELECT * FROM PlaytestSignups"`

- [ ] **Step 5: Test duplicate email handling**

Submit the same email again. Verify:
- Shows success (not an error) — doesn't leak that the email already exists

- [ ] **Step 6: Final build check**

Run: `cd apps/lobby && npx next build`
Expected: Clean build with no errors or warnings.

- [ ] **Step 7: Commit any fixes from testing**

If any issues were found and fixed during testing, commit them:

```bash
git add -A apps/lobby/app/playtest/
git commit -m "fix(lobby): address issues found during playtest signup manual testing"
```

---

### Task 13: DNS Setup (Manual — Post-Deploy)

This task is manual and happens after the feature is deployed to production.

- [ ] **Step 1: Create Cloudflare Turnstile site**

Go to Cloudflare Dashboard → Turnstile → Add Site:
- Domain: `playtest.peckingorder.ca`
- Widget type: Invisible
- Save the site key and secret key

- [ ] **Step 2: Set Turnstile secrets**

```bash
cd apps/lobby
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Update `TURNSTILE_SITE_KEY` in `wrangler.json` staging and production vars with the real site key.

- [ ] **Step 3: Create Resend Audience**

In Resend Dashboard → Audiences → Create:
- Name: "Playtest Signups"
- Copy the audience ID

```bash
npx wrangler secret put RESEND_PLAYTEST_AUDIENCE_ID --env staging
npx wrangler secret put RESEND_PLAYTEST_AUDIENCE_ID --env production
```

- [ ] **Step 4: Add DNS record**

In Cloudflare DNS for `peckingorder.ca`:
- Add CNAME: `playtest` → lobby worker custom domain hostname
- Or add the custom domain via `wrangler.json` routes:

```json
"routes": [
  { "pattern": "playtest.peckingorder.ca", "custom_domain": true }
]
```

Add this route entry to both staging and production env blocks in `wrangler.json`.

- [ ] **Step 5: Verify vanity URL**

After DNS propagation, visit `https://playtest.peckingorder.ca` and confirm it loads the signup page.
