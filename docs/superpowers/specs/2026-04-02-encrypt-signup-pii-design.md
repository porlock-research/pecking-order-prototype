# Encrypt Playtest Signup PII

**Date:** 2026-04-02
**Branch:** `feature/encrypt-signup-pii`

## Problem

The `PlaytestSignups` table stores email addresses, phone numbers, IP addresses, and Turnstile tokens as plaintext in D1. If the database is compromised, all PII is immediately exposed. IP and Turnstile tokens have no reason to persist after signup.

## Design

### 1. Crypto utility — `apps/lobby/lib/crypto.ts`

- **`encrypt(plaintext: string, key: CryptoKey): Promise<string>`** — AES-256-GCM, random 12-byte IV per call. Returns `enc:base64(iv):base64(ciphertext)`.
- **`decrypt(encoded: string, key: CryptoKey): Promise<string>`** — If value starts with `enc:`, strips prefix, splits on `:`, decodes IV + ciphertext, decrypts. If value does NOT start with `enc:`, returns it as-is (plaintext fallback for pre-backfill rows). This fallback is removed after Phase 2.
- **`hmac(value: string, key: CryptoKey): Promise<string>`** — HMAC-SHA256, returns hex string. Used for deterministic email hashing.
- **`deriveKeys(masterHex: string): Promise<{ encKey: CryptoKey; hmacKey: CryptoKey }>`** — Imports the master key, derives two sub-keys using HKDF with distinct info strings (`"aes-gcm-encrypt"` and `"hmac-sha256-dedup"`). Returns both keys.
- All functions use the Web Crypto API (available in Workers and Next.js on Cloudflare).

**Key management:**
- `PII_ENCRYPTION_KEY` — 256-bit hex string stored as a Workers Secret. This is a **master key** — never used directly for encryption or HMAC. Two sub-keys are derived via HKDF with distinct info strings, ensuring cryptographic key separation.
- Added to `.dev.vars` for local development (a dev-only key, not the production key).
- **Key rotation:** If the key is compromised, a re-encryption script (similar to the backfill script) would decrypt all rows with the old key and re-encrypt with the new key. HMAC hashes would also need recomputation. No implementation now, but the crypto utility is designed to accept keys as parameters (not globals) to support this.

### 2. Migration — `0013_encrypt_signup_pii.sql` (Phase 1: add columns)

```sql
ALTER TABLE PlaytestSignups ADD COLUMN email_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN phone_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN email_hash TEXT;
```

No columns are dropped yet. The signup action writes to both old and new columns during the transition period. A follow-up Phase 2 migration drops `email`, `phone`, `ip_address`, `turnstile_token` after backfill is confirmed.

### 3. Backfill script — `apps/lobby/scripts/backfill-encrypt-signups.ts`

- Reads all rows where `email_encrypted IS NULL`
- For each row: encrypts email/phone, computes email_hash, updates the row
- Runs via: `npx tsx scripts/backfill-encrypt-signups.ts --remote staging|production`
- Uses the D1 HTTP API (not `wrangler d1 execute`) because the script needs Web Crypto for encryption. Requires Node 20+ for native `crypto.subtle` support.
- Idempotent: skips rows that already have `email_encrypted` set

### 4. Signup action changes — `app/playtest/actions.ts`

**Remove:**
- `ip_address` from INSERT (stop collecting)
- `turnstile_token` from INSERT (verify then discard)
- IP-based rate limiting logic

**Add:**
- Import encryption key from env (`PII_ENCRYPTION_KEY`)
- Derive sub-keys via HKDF
- Encrypt email and phone before INSERT
- Compute `email_hash` and include in INSERT
- Duplicate check: `WHERE email_hash = ?` instead of `WHERE email = ?`
- Catch-block queries for "already signed up" also use `WHERE email_hash = ?` (not `WHERE email = ?`)

**Graceful degradation (Phase 1 only):** If `PII_ENCRYPTION_KEY` is not set, fall back to plaintext storage (log a warning). This prevents the live form from breaking during the deploy-to-secret-set gap. **After Phase 2 (plaintext columns dropped), the fallback is removed — the action throws an error if the key is missing.** Storing plaintext in encrypted columns would corrupt data integrity.

**Note:** The Resend Contacts upsert and `sendEmail()` call still receive plaintext email by necessity (required for email delivery). The encryption scope covers D1 storage only.

### 5. Admin signups page — `app/admin/signups/`

**`app/admin/signups/actions.ts`:**
- **`listSignups(page?: number)`** — Paginated (50 rows per page). Calls `requireSuperAdmin()` at the top of the function before any DB query or decryption. This is critical because Next.js server actions can be called directly via POST, bypassing layout-level auth guards. Fetches rows, decrypts `email_encrypted` and `phone_encrypted` in the Worker, falls back to reading `email`/`phone` columns for pre-backfill rows. Returns plaintext for display.
- **Audit logging:** Each call logs `[Admin] Signups viewed by userId=... at ...` in structured format (captured by Workers Logs / Axiom).

**`app/admin/signups/page.tsx`:**
- Client component with table displaying: email, phone, messaging app, referral source/detail, referred by, referral code, signed up date
- Pagination controls (next/prev, 50 per page)
- Refresh button (same pattern as Games page)
- Search/filter by email (client-side, post-decryption)

**`AdminShell.tsx`:**
- Add `{ href: '/admin/signups', label: 'Signups', icon: '📋' }` to `NAV_ITEMS`
- Add `'signups'` to breadcrumb label map

### 6. Phase 2 migration — `0014_drop_plaintext_pii.sql` (manual, after backfill confirmed)

```sql
-- Run ONLY after confirming all rows have email_encrypted set
-- and the signup action is writing encrypted values

-- Drop plaintext columns:
ALTER TABLE PlaytestSignups DROP COLUMN email;
ALTER TABLE PlaytestSignups DROP COLUMN phone;
ALTER TABLE PlaytestSignups DROP COLUMN ip_address;
ALTER TABLE PlaytestSignups DROP COLUMN turnstile_token;

-- Move UNIQUE constraint to email_hash
CREATE UNIQUE INDEX idx_email_hash ON PlaytestSignups(email_hash);
```

This migration is NOT applied automatically. It runs manually after verifying:
1. Backfill script completed successfully on both staging and production
2. All new signups are writing encrypted values
3. Admin page reads correctly from encrypted columns

**Post-Phase-2 hardening:** Remove the plaintext fallback from `decrypt()` and the graceful degradation from the signup action. Make `PII_ENCRYPTION_KEY` mandatory (throw on missing key).

### 7. Deployment sequence

1. Deploy code (writes to both old + new columns, graceful degradation if no key)
2. Set `PII_ENCRYPTION_KEY` secret on staging and production
3. Apply Phase 1 migration (`0013`) on staging, verify
4. Apply Phase 1 migration on production
5. Run backfill script on staging, verify admin page
6. Run backfill script on production, verify admin page
7. Later: apply Phase 2 migration to drop plaintext columns
8. After Phase 2: deploy hardened code (remove fallbacks, make key mandatory)

## Files to create/modify

| File | Action |
|------|--------|
| `apps/lobby/lib/crypto.ts` | Create — encrypt/decrypt/hmac/deriveKeys utilities |
| `apps/lobby/migrations/0013_encrypt_signup_pii.sql` | Create — add encrypted columns |
| `apps/lobby/migrations/0014_drop_plaintext_pii.sql` | Create — drop plaintext columns (manual) |
| `apps/lobby/scripts/backfill-encrypt-signups.ts` | Create — encrypt existing rows via D1 HTTP API |
| `apps/lobby/app/playtest/actions.ts` | Modify — encrypt on write, remove IP/token storage |
| `apps/lobby/app/admin/signups/actions.ts` | Create — decrypt and list signups (with requireSuperAdmin + audit log) |
| `apps/lobby/app/admin/signups/page.tsx` | Create — admin signups table UI with pagination |
| `apps/lobby/app/admin/AdminShell.tsx` | Modify — add Signups nav item + breadcrumb |
| `apps/lobby/.dev.vars` | Modify — add dev encryption key |
