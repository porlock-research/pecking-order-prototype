#!/usr/bin/env npx tsx
/**
 * Upload persona images to R2 bucket.
 *
 * Usage:
 *   cd apps/lobby
 *   npx tsx scripts/import-personas.ts                    # local (miniflare)
 *   npx tsx scripts/import-personas.ts --remote staging   # staging R2
 *   npx tsx scripts/import-personas.ts --remote production # production R2
 *
 * This uses `wrangler r2 object put` under the hood.
 * Ensure wrangler is installed and the R2 bucket exists.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const isRemote = process.argv.includes('--remote');
const envArg = process.argv[process.argv.indexOf('--remote') + 1];

const BUCKETS: Record<string, string> = {
  staging: 'pecking-order-assets-staging',
  production: 'pecking-order-assets',
};

if (isRemote && !BUCKETS[envArg]) {
  console.error(`Usage: npx tsx scripts/import-personas.ts --remote <staging|production>`);
  process.exit(1);
}

const BUCKET_NAME = isRemote ? BUCKETS[envArg] : 'pecking-order-assets';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const IMAGES_DIR = resolve(process.env.HOME!, 'Downloads/reality_royale_characters/images');
const ROSTER_PATH = resolve(process.env.HOME!, 'Downloads/reality_royale_characters/roster.json');

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
  const personaId = `persona-${String(entry.id).padStart(2, '0')}`;
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
