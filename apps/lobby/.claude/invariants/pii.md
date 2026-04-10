# PII Handling Invariants

## Never store plaintext PII

PlaytestSignups stores encrypted PII only:
- `email_encrypted` (not `email`)
- `phone_encrypted` (not `phone`)
- `email_hash` (for lookups)

Plaintext columns were dropped in migration 0014.

## Encryption is required

`PII_ENCRYPTION_KEY` env var must be set. Crypto helpers in `lib/crypto.ts`.

Always encrypt before writing to D1. Always decrypt after reading from D1.
