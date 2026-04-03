#!/usr/bin/env npx tsx
/**
 * Upload persona images to R2 bucket.
 *
 * Usage:
 *   cd apps/lobby
 *   npx tsx scripts/import-personas.ts --dir <path>                    # local (miniflare)
 *   npx tsx scripts/import-personas.ts --dir <path> --remote staging   # staging R2
 *   npx tsx scripts/import-personas.ts --dir <path> --remote production # production R2
 *   npx tsx scripts/import-personas.ts --dir <path> --start-id 25      # offset persona IDs
 *
 * Expects <path> to contain:
 *   roster.json              — [{id, name, stereotype, description, ...}]
 *   images/{id}_{Name}/      — headshot.png, medium.png, full_body.png
 *
 * This uses `wrangler r2 object put` under the hood.
 * Ensure wrangler is installed and the R2 bucket exists.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Parse --dir argument
const dirIdx = process.argv.indexOf('--dir');
if (dirIdx === -1 || !process.argv[dirIdx + 1]) {
  console.error(`Usage: npx tsx scripts/import-personas.ts --dir <path> [--remote <staging|production>] [--start-id <N>]`);
  process.exit(1);
}
const SOURCE_DIR = resolve(process.argv[dirIdx + 1]);

// Parse --start-id (defaults to roster ID as-is)
const startIdIdx = process.argv.indexOf('--start-id');
const startId = startIdIdx !== -1 ? parseInt(process.argv[startIdIdx + 1], 10) : null;

const isRemote = process.argv.includes('--remote');
const envArg = process.argv[process.argv.indexOf('--remote') + 1];

const BUCKETS: Record<string, string> = {
  staging: 'pecking-order-assets-staging',
  production: 'pecking-order-assets',
};

if (isRemote && !BUCKETS[envArg]) {
  console.error(`Usage: npx tsx scripts/import-personas.ts --dir <path> --remote <staging|production>`);
  process.exit(1);
}

const BUCKET_NAME = isRemote ? BUCKETS[envArg] : 'pecking-order-assets';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const IMAGES_DIR = resolve(SOURCE_DIR, 'images');
const ROSTER_PATH = resolve(SOURCE_DIR, 'roster.json');

if (!existsSync(ROSTER_PATH)) {
  console.error(`roster.json not found at: ${ROSTER_PATH}`);
  process.exit(1);
}

interface RosterEntry {
  id: number;
  name: string;
}

const roster: RosterEntry[] = JSON.parse(readFileSync(ROSTER_PATH, 'utf-8'));

// Map roster ID → directory name pattern: "{id}_{First}_{Last}"
function findImageDir(entry: RosterEntry): string {
  const nameParts = entry.name.split(' ').join('_');
  const dirName = `${entry.id}_${nameParts}`;
  const fullPath = resolve(IMAGES_DIR, dirName);
  if (!existsSync(fullPath)) {
    throw new Error(`Image directory not found: ${fullPath}`);
  }
  return fullPath;
}

const VARIANTS = ['headshot', 'medium', 'full_body'] as const;
const R2_VARIANT_NAMES: Record<string, string> = {
  headshot: 'headshot.png',
  medium: 'medium.png',
  full_body: 'full.png',
};

let uploaded = 0;
let errors = 0;

console.log(`Bucket: ${BUCKET_NAME} (${isRemote ? envArg : 'local'})`);
console.log(`Cache-Control: ${CACHE_CONTROL}\n`);

for (const entry of roster) {
  const idNum = startId !== null ? (startId + entry.id - 1) : entry.id;
  const personaId = `persona-${String(idNum).padStart(2, '0')}`;
  const imageDir = findImageDir(entry);

  for (const variant of VARIANTS) {
    const localFile = resolve(imageDir, `${variant}.png`);
    const r2Key = `personas/${personaId}/${R2_VARIANT_NAMES[variant]}`;

    if (!existsSync(localFile)) {
      console.error(`  MISSING: ${localFile}`);
      errors++;
      continue;
    }

    try {
      console.log(`  Uploading ${r2Key}...`);
      const targetFlag = isRemote ? ' --remote' : ' --local';
      execSync(
        `npx wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file="${localFile}" --content-type="image/png" --cache-control="${CACHE_CONTROL}"${targetFlag}`,
        { stdio: 'pipe' }
      );
      uploaded++;
    } catch (err: any) {
      console.error(`  FAILED: ${r2Key} — ${err.message}`);
      errors++;
    }
  }
}

console.log(`\nDone. Uploaded: ${uploaded}, Errors: ${errors}`);
