# Encrypt Playtest Signup PII — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt email and phone PII in the PlaytestSignups table, stop storing IP/Turnstile tokens, and add an admin signups page.

**Architecture:** AES-256-GCM encryption with HKDF-derived sub-keys for crypto separation. Two-phase migration: add encrypted columns (Phase 1), backfill, then drop plaintext columns (Phase 2). Admin page decrypts on read with pagination and auth guards.

**Tech Stack:** Web Crypto API (AES-256-GCM, HKDF, HMAC-SHA256), Cloudflare D1, Next.js 15 server actions, Workers Secrets

**Spec:** `docs/superpowers/specs/2026-04-02-encrypt-signup-pii-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/lobby/lib/crypto.ts` | Create | encrypt, decrypt, hmac, deriveKeys utilities |
| `apps/lobby/lib/crypto.test.ts` | Create | Unit tests for crypto utilities |
| `apps/lobby/migrations/0013_encrypt_signup_pii.sql` | Create | Phase 1: add encrypted columns |
| `apps/lobby/migrations/0014_drop_plaintext_pii.sql` | Create | Phase 2: drop plaintext columns (manual) |
| `apps/lobby/scripts/backfill-encrypt-signups.ts` | Create | Encrypt existing rows |
| `apps/lobby/app/playtest/actions.ts` | Modify | Encrypt on write, remove IP/token |
| `apps/lobby/app/admin/signups/actions.ts` | Create | Decrypt and list signups with auth |
| `apps/lobby/app/admin/signups/page.tsx` | Create | Admin signups table UI |
| `apps/lobby/app/admin/AdminShell.tsx` | Modify | Add Signups nav item |
| `apps/lobby/.dev.vars` | Modify | Add dev encryption key |

---

### Task 1: Crypto Utility

**Files:**
- Create: `apps/lobby/lib/crypto.ts`
- Create: `apps/lobby/lib/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/lobby/lib/crypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveKeys, encrypt, decrypt, hmac } from './crypto';

const TEST_MASTER_KEY_HEX = 'a'.repeat(64); // 256-bit test key

describe('crypto', () => {
  describe('deriveKeys', () => {
    it('derives two distinct CryptoKey objects', async () => {
      const keys = await deriveKeys(TEST_MASTER_KEY_HEX);
      expect(keys.encKey).toBeDefined();
      expect(keys.hmacKey).toBeDefined();
      expect(keys.encKey).not.toBe(keys.hmacKey);
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips plaintext', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const plaintext = 'test@example.com';
      const ciphertext = await encrypt(plaintext, encKey);
      expect(ciphertext.startsWith('enc:')).toBe(true);
      const decrypted = await decrypt(ciphertext, encKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await encrypt('hello', encKey);
      const b = await encrypt('hello', encKey);
      expect(a).not.toBe(b);
    });

    it('returns plaintext as-is when not encrypted (fallback)', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const result = await decrypt('plaintext@example.com', encKey);
      expect(result).toBe('plaintext@example.com');
    });

    it('returns null values as-is', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const result = await decrypt(null as any, encKey);
      expect(result).toBe(null);
    });
  });

  describe('hmac', () => {
    it('produces deterministic hex hash', async () => {
      const { hmacKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await hmac('test@example.com', hmacKey);
      const b = await hmac('test@example.com', hmacKey);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', async () => {
      const { hmacKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await hmac('alice@example.com', hmacKey);
      const b = await hmac('bob@example.com', hmacKey);
      expect(a).not.toBe(b);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/lobby && npx vitest run lib/crypto.test.ts`
Expected: FAIL — module `./crypto` not found

- [ ] **Step 3: Implement crypto utility**

Create `apps/lobby/lib/crypto.ts`:

```typescript
/**
 * PII encryption utilities using Web Crypto API.
 * AES-256-GCM for encryption, HMAC-SHA256 for deterministic hashing.
 * Keys derived from a single master key via HKDF with distinct info strings.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export interface DerivedKeys {
  encKey: CryptoKey;
  hmacKey: CryptoKey;
}

/**
 * Derive AES-GCM and HMAC sub-keys from a hex-encoded master key using HKDF.
 */
export async function deriveKeys(masterHex: string): Promise<DerivedKeys> {
  const masterBytes = hexToBytes(masterHex);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    masterBytes,
    'HKDF',
    false,
    ['deriveKey'],
  );

  const [encKey, hmacKey] = await Promise.all([
    crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: ENCODER.encode('aes-gcm-encrypt') },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
    crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: ENCODER.encode('hmac-sha256-dedup') },
      baseKey,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    ),
  ]);

  return { encKey, hmacKey };
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns `enc:base64(iv):base64(ciphertext)`.
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext),
  );
  return `enc:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypt a value. If it starts with `enc:`, decrypts it.
 * Otherwise returns the value as-is (plaintext fallback for pre-migration rows).
 */
export async function decrypt(encoded: string | null, key: CryptoKey): Promise<string | null> {
  if (encoded == null) return null;
  if (!encoded.startsWith('enc:')) return encoded;

  const parts = encoded.slice(4).split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted value format');

  const iv = base64ToBytes(parts[0]);
  const ciphertext = base64ToBytes(parts[1]);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return DECODER.decode(plaintext);
}

/**
 * HMAC-SHA256 of a value. Returns lowercase hex string.
 */
export async function hmac(value: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(value));
  return bytesToHex(new Uint8Array(sig));
}

// -- Helpers --

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/lobby && npx vitest run lib/crypto.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/lobby/lib/crypto.ts apps/lobby/lib/crypto.test.ts
git commit -m "feat(lobby): add PII encryption utilities (AES-256-GCM + HKDF + HMAC)"
```

---

### Task 2: Phase 1 Migration + Dev Key

**Files:**
- Create: `apps/lobby/migrations/0013_encrypt_signup_pii.sql`
- Create: `apps/lobby/migrations/0014_drop_plaintext_pii.sql`
- Modify: `apps/lobby/.dev.vars`

- [ ] **Step 1: Create Phase 1 migration**

Create `apps/lobby/migrations/0013_encrypt_signup_pii.sql`:

```sql
-- Phase 1: Add encrypted columns alongside existing plaintext columns.
-- Signup action writes to both during transition period.
ALTER TABLE PlaytestSignups ADD COLUMN email_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN phone_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN email_hash TEXT;
```

- [ ] **Step 2: Create Phase 2 migration (manual, not applied yet)**

Create `apps/lobby/migrations/0014_drop_plaintext_pii.sql`:

```sql
-- Phase 2: Drop plaintext PII columns AFTER backfill is confirmed.
-- DO NOT apply this migration until:
--   1. Backfill script has run on staging AND production
--   2. All new signups are writing encrypted values
--   3. Admin page reads correctly from encrypted columns

ALTER TABLE PlaytestSignups DROP COLUMN email;
ALTER TABLE PlaytestSignups DROP COLUMN phone;
ALTER TABLE PlaytestSignups DROP COLUMN ip_address;
ALTER TABLE PlaytestSignups DROP COLUMN turnstile_token;

CREATE UNIQUE INDEX idx_email_hash ON PlaytestSignups(email_hash);
```

- [ ] **Step 3: Add dev encryption key to .dev.vars**

Append to `apps/lobby/.dev.vars`:

```
PII_ENCRYPTION_KEY=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
```

This is a development-only key. Staging/production keys are set via `wrangler secret put`.

- [ ] **Step 4: Apply Phase 1 migration locally**

Run: `cd apps/lobby && npx wrangler d1 migrations apply pecking-order-lobby-db-local --local`
Expected: `0013_encrypt_signup_pii.sql` applied successfully

- [ ] **Step 5: Commit**

```bash
git add apps/lobby/migrations/0013_encrypt_signup_pii.sql apps/lobby/migrations/0014_drop_plaintext_pii.sql
git commit -m "feat(lobby): add PII encryption migrations (phase 1 + phase 2)"
```

Note: Do NOT commit `.dev.vars` (it's gitignored).

---

### Task 3: Encrypt Signup Action

**Files:**
- Modify: `apps/lobby/app/playtest/actions.ts`

- [ ] **Step 1: Update the signup action to encrypt PII on write**

Key changes to `apps/lobby/app/playtest/actions.ts`:
- Import `deriveKeys`, `encrypt`, `hmac` from `@/lib/crypto`
- Remove `headers` import from `next/headers` (no longer collecting IP)
- Remove IP-based rate limiting block
- Remove `ip_address` and `turnstile_token` from INSERT
- Add `email_encrypted`, `phone_encrypted`, `email_hash` to INSERT
- Change duplicate-check catch block from `WHERE email = ?` to `WHERE email_hash = ?`
- Graceful degradation: if `PII_ENCRYPTION_KEY` is not set, write plaintext to old columns + log warning

Updated `handlePlaytestSignup` — remove IP extraction:

```typescript
export async function handlePlaytestSignup(data: {
  email: string;
  referralSource: string;
  referralDetail?: string;
  phone?: string;
  messagingApp?: string;
  referredBy?: string;
  turnstileToken: string;
}): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  return submitPlaytestSignup(data);
}
```

Updated `submitPlaytestSignup` — remove `ipAddress` param, add encryption:

```typescript
async function submitPlaytestSignup(
  data: {
    email: string;
    referralSource: string;
    referralDetail?: string;
    phone?: string;
    messagingApp?: string;
    referredBy?: string;
    turnstileToken: string;
  },
): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const { email, referralSource, referralDetail, phone, messagingApp, turnstileToken } = parsed.data;

  try {
    const env = await getEnv();

    // Verify Turnstile (then discard token -- never stored)
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

    const db = await getDB();
    const referralCode = generateReferralCode();
    const referredBy = data.referredBy?.trim().toUpperCase() || null;
    const emailLower = email.toLowerCase();

    // Encrypt PII if key is available
    const piiKey = env.PII_ENCRYPTION_KEY as string | undefined;
    let emailEncrypted: string | null = null;
    let phoneEncrypted: string | null = null;
    let emailHash: string | null = null;

    if (piiKey) {
      const keys = await deriveKeys(piiKey);
      emailEncrypted = await encrypt(emailLower, keys.encKey);
      phoneEncrypted = phone ? await encrypt(phone, keys.encKey) : null;
      emailHash = await hmac(emailLower, keys.hmacKey);
    } else {
      console.warn('[Playtest] PII_ENCRYPTION_KEY not set -- storing plaintext (Phase 1 fallback)');
    }

    try {
      await db
        .prepare(
          `INSERT INTO PlaytestSignups
           (email, referral_source, referral_detail, phone, messaging_app, referral_code, referred_by, email_encrypted, phone_encrypted, email_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          emailLower,
          referralSource,
          referralDetail || null,
          phone || null,
          messagingApp || null,
          referralCode,
          referredBy,
          emailEncrypted,
          phoneEncrypted,
          emailHash,
        )
        .run();
    } catch (err: any) {
      if (err?.message?.includes('UNIQUE')) {
        // Look up existing by email_hash (preferred) or email (fallback)
        const lookupQuery = emailHash
          ? 'SELECT referral_code FROM PlaytestSignups WHERE email_hash = ?'
          : 'SELECT referral_code FROM PlaytestSignups WHERE email = ?';
        const lookupValue = emailHash || emailLower;

        const existing = await db
          .prepare(lookupQuery)
          .bind(lookupValue)
          .first<{ referral_code: string | null }>();

        let code = existing?.referral_code;
        if (!code) {
          code = referralCode;
          const updateQuery = emailHash
            ? 'UPDATE PlaytestSignups SET referral_code = ? WHERE email_hash = ?'
            : 'UPDATE PlaytestSignups SET referral_code = ? WHERE email = ?';
          await db.prepare(updateQuery).bind(code, lookupValue).run();
        }
        return { success: true, referralCode: code };
      }
      throw err;
    }

    // Send confirmation email (plaintext email required for delivery)
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey) {
      const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
      const lobbyUrl = (env.LOBBY_HOST as string) || '';
      const playtestUrl = (env.PLAYTEST_URL as string) || 'https://playtest.peckingorder.ca';

      const html = buildPlaytestConfirmationHtml({ assetsUrl, lobbyUrl, playtestUrl, referralCode });
      await sendEmail(email, "You're on the list!", html, resendApiKey);

      const segmentId = env.RESEND_PLAYTEST_SEGMENT_ID as string | undefined;
      if (segmentId) {
        const resend = new Resend(resendApiKey);
        await resend.contacts.create({
          email: emailLower,
          unsubscribed: false,
          segments: [{ id: segmentId }],
          properties: {
            referral_source: referralSource,
            signed_up_at: new Date().toISOString(),
          },
        }).catch((err) => {
          console.error('[Playtest] Contact upsert failed:', err);
        });
      }
    }

    return { success: true, referralCode };
  } catch (err: any) {
    console.error('[Playtest] Signup error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
```

- [ ] **Step 2: Update imports at top of file**

Remove `import { headers } from 'next/headers';` and add:

```typescript
import { deriveKeys, encrypt, hmac } from '@/lib/crypto';
```

- [ ] **Step 3: Verify the lobby builds**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/playtest/actions.ts
git commit -m "feat(lobby): encrypt PII on signup, stop storing IP and turnstile tokens"
```

---

### Task 4: Admin Signups Actions

**Files:**
- Create: `apps/lobby/app/admin/signups/actions.ts`

- [ ] **Step 1: Create the server action**

Create `apps/lobby/app/admin/signups/actions.ts`:

```typescript
'use server';

import { getDB, getEnv } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin';
import { deriveKeys, decrypt } from '@/lib/crypto';

export interface SignupRow {
  id: number;
  email: string | null;
  phone: string | null;
  messagingApp: string | null;
  referralSource: string;
  referralDetail: string | null;
  referredBy: string | null;
  referralCode: string | null;
  signedUpAt: string;
}

export interface SignupsResult {
  rows: SignupRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export async function listSignups(page = 1): Promise<SignupsResult> {
  await requireSuperAdmin();

  console.log(`[Admin] Signups viewed at ${new Date().toISOString()}`);

  const db = await getDB();
  const env = await getEnv();
  const piiKey = env.PII_ENCRYPTION_KEY as string | undefined;

  const offset = (page - 1) * PAGE_SIZE;

  const [countResult, dataResult] = await Promise.all([
    db.prepare('SELECT COUNT(*) as total FROM PlaytestSignups').first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, email, email_encrypted, phone, phone_encrypted, messaging_app,
                referral_source, referral_detail, referred_by, referral_code, signed_up_at
         FROM PlaytestSignups
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all<{
        id: number;
        email: string | null;
        email_encrypted: string | null;
        phone: string | null;
        phone_encrypted: string | null;
        messaging_app: string | null;
        referral_source: string;
        referral_detail: string | null;
        referred_by: string | null;
        referral_code: string | null;
        signed_up_at: string;
      }>(),
  ]);

  const total = countResult?.total ?? 0;
  const keys = piiKey ? await deriveKeys(piiKey) : null;

  const rows: SignupRow[] = await Promise.all(
    dataResult.results.map(async (r) => {
      let email = r.email;
      let phone = r.phone;

      if (keys) {
        if (r.email_encrypted) {
          email = await decrypt(r.email_encrypted, keys.encKey);
        }
        if (r.phone_encrypted) {
          phone = await decrypt(r.phone_encrypted, keys.encKey);
        }
      }

      return {
        id: r.id,
        email,
        phone,
        messagingApp: r.messaging_app,
        referralSource: r.referral_source,
        referralDetail: r.referral_detail,
        referredBy: r.referred_by,
        referralCode: r.referral_code,
        signedUpAt: r.signed_up_at,
      };
    }),
  );

  return { rows, total, page, pageSize: PAGE_SIZE };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/admin/signups/actions.ts
git commit -m "feat(lobby): add admin signups server action with auth + decryption"
```

---

### Task 5: Admin Signups Page

**Files:**
- Create: `apps/lobby/app/admin/signups/page.tsx`
- Modify: `apps/lobby/app/admin/AdminShell.tsx`

- [ ] **Step 1: Create the signups page**

Create `apps/lobby/app/admin/signups/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { listSignups } from './actions';
import type { SignupsResult } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SignupsPage() {
  const [data, setData] = useState<SignupsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  async function load(p: number) {
    setLoading(true);
    const result = await listSignups(p);
    setData(result);
    setPage(p);
    setLoading(false);
  }

  useEffect(() => { load(1); }, []);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const filtered = data?.rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.email?.toLowerCase().includes(s)
      || r.phone?.includes(s)
      || r.referralCode?.toLowerCase().includes(s)
      || r.referredBy?.toLowerCase().includes(s);
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playtest Signups</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} total signup{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Input
        placeholder="Search by email, phone, or referral code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Referred By</TableHead>
              <TableHead>Referral Code</TableHead>
              <TableHead>Signed Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(row => (
              <TableRow key={row.id}>
                <TableCell className="text-sm font-mono">{row.email ?? '\u2014'}</TableCell>
                <TableCell className="text-sm font-mono">{row.phone ?? '\u2014'}</TableCell>
                <TableCell className="text-sm">{row.messagingApp ?? '\u2014'}</TableCell>
                <TableCell className="text-sm">
                  {row.referralSource}
                  {row.referralDetail ? ` (${row.referralDetail})` : ''}
                </TableCell>
                <TableCell className="text-sm font-mono">{row.referredBy ?? '\u2014'}</TableCell>
                <TableCell className="text-sm font-mono">{row.referralCode ?? '\u2014'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.signedUpAt + 'Z').toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No signups found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Signups to admin nav**

In `apps/lobby/app/admin/AdminShell.tsx`, add to the `NAV_ITEMS` array:

```typescript
const NAV_ITEMS = [
  { href: '/admin', label: 'Games', icon: '\uD83C\uDFAE' },
  { href: '/admin/personas', label: 'Personas', icon: '\uD83C\uDFAD' },
  { href: '/admin/signups', label: 'Signups', icon: '\uD83D\uDCCB' },
  { href: '/admin/tools', label: 'Tools', icon: '\uD83D\uDD27' },
];
```

Add `'signups'` to the breadcrumb label map in the `Breadcrumbs` component:

```typescript
const label = seg === 'admin' ? 'Admin'
  : seg === 'games' ? 'Games'
  : seg === 'personas' ? 'Personas'
  : seg === 'signups' ? 'Signups'
  : seg === 'tools' ? 'Tools'
  : seg === 'inspector' ? 'Inspector'
  : seg;
```

- [ ] **Step 3: Verify the lobby builds**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/admin/signups/page.tsx apps/lobby/app/admin/AdminShell.tsx
git commit -m "feat(lobby): add admin signups page with pagination and search"
```

---

### Task 6: Backfill Script

**Files:**
- Create: `apps/lobby/scripts/backfill-encrypt-signups.ts`

- [ ] **Step 1: Create the backfill script**

Create `apps/lobby/scripts/backfill-encrypt-signups.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * Backfill encryption for existing PlaytestSignups rows.
 *
 * Usage:
 *   cd apps/lobby
 *   PII_ENCRYPTION_KEY=<hex> npx tsx scripts/backfill-encrypt-signups.ts --remote staging
 *   PII_ENCRYPTION_KEY=<hex> npx tsx scripts/backfill-encrypt-signups.ts --remote production
 *
 * Requires Node 20+ for native crypto.subtle support.
 * Idempotent: skips rows that already have email_encrypted set.
 */

import { execFileSync } from 'node:child_process';
import { deriveKeys, encrypt, hmac } from '../lib/crypto';

const envArg = process.argv[process.argv.indexOf('--remote') + 1];
if (!envArg || !['staging', 'production'].includes(envArg)) {
  console.error('Usage: PII_ENCRYPTION_KEY=<hex> npx tsx scripts/backfill-encrypt-signups.ts --remote <staging|production>');
  process.exit(1);
}

const piiKey = process.env.PII_ENCRYPTION_KEY;
if (!piiKey || piiKey.length !== 64) {
  console.error('PII_ENCRYPTION_KEY must be a 64-char hex string');
  process.exit(1);
}

const DB_NAMES: Record<string, string> = {
  staging: 'pecking-order-lobby-db-staging',
  production: 'pecking-order-lobby-db',
};

function d1Execute(dbName: string, env: string, sql: string): string {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', dbName, '--remote', '--env', env, '--command', sql],
    { encoding: 'utf-8' },
  );
}

function parseD1Json(output: string): any[] {
  const match = output.match(/"results"\s*:\s*(\[[\s\S]*?\])\s*,\s*"success"/);
  if (!match) return [];
  return JSON.parse(match[1]);
}

async function main() {
  const dbName = DB_NAMES[envArg];
  const keys = await deriveKeys(piiKey!);

  console.log(`Backfilling ${envArg} (${dbName})...\n`);

  const output = d1Execute(
    dbName,
    envArg,
    'SELECT id, email, phone FROM PlaytestSignups WHERE email_encrypted IS NULL',
  );
  const rows = parseD1Json(output);

  if (rows.length === 0) {
    console.log('No rows to backfill.');
    return;
  }

  console.log(`Found ${rows.length} rows to backfill.\n`);

  let success = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const emailEnc = row.email ? await encrypt(row.email, keys.encKey) : null;
      const phoneEnc = row.phone ? await encrypt(row.phone, keys.encKey) : null;
      const emailH = row.email ? await hmac(row.email.toLowerCase(), keys.hmacKey) : null;

      const updates: string[] = [];
      const values: string[] = [];

      if (emailEnc) {
        updates.push(`email_encrypted = '${emailEnc}'`);
      }
      if (phoneEnc) {
        updates.push(`phone_encrypted = '${phoneEnc}'`);
      }
      if (emailH) {
        updates.push(`email_hash = '${emailH}'`);
      }

      if (updates.length === 0) continue;

      const setSql = updates.join(', ');
      d1Execute(dbName, envArg, `UPDATE PlaytestSignups SET ${setSql} WHERE id = ${row.id}`);
      console.log(`  [${row.id}] ${row.email} -- encrypted`);
      success++;
    } catch (err: any) {
      console.error(`  [${row.id}] FAILED: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Success: ${success}, Errors: ${errors}`);
}

main().catch(console.error);
```

Note: The inline SQL values are safe here because they are our own base64-encoded encrypted output and hex HMAC hashes, not user input.

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/scripts/backfill-encrypt-signups.ts
git commit -m "feat(lobby): add backfill script for encrypting existing signup PII"
```

---

### Task 7: Auth Guard Fix + Final Verification

**Files:**
- Modified (already done): `apps/lobby/app/admin/personas/actions.ts`

- [ ] **Step 1: Type-check the lobby**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run crypto tests**

Run: `cd apps/lobby && npx vitest run lib/crypto.test.ts`
Expected: All tests pass

- [ ] **Step 3: Build the lobby**

Run: `cd apps/lobby && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit the auth guard fix**

```bash
git add apps/lobby/app/admin/personas/actions.ts
git commit -m "fix(lobby): add requireSuperAdmin auth guards to persona admin actions"
```
