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
  console.error(
    'Usage: PII_ENCRYPTION_KEY=<hex> npx tsx scripts/backfill-encrypt-signups.ts --remote <staging|production>',
  );
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

      // Values are our own base64/hex output, not user input — safe to inline
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
