import { describe, it, expect } from 'vitest';
import { SocialPlayerSchema } from '@pecking-order/shared-types';

describe('SocialPlayer — eliminatedOnDay', () => {
  it('accepts eliminatedOnDay as an optional number', () => {
    const parsed = SocialPlayerSchema.parse({
      id: 'p1',
      personaName: 'Alice',
      avatarUrl: 'x',
      status: 'ELIMINATED',
      silver: 0,
      gold: 0,
      eliminatedOnDay: 3,
    });
    expect(parsed.eliminatedOnDay).toBe(3);
  });

  it('parses without eliminatedOnDay (alive player)', () => {
    const parsed = SocialPlayerSchema.parse({
      id: 'p1',
      personaName: 'Alice',
      avatarUrl: 'x',
      status: 'ALIVE',
      silver: 0,
      gold: 0,
    });
    expect(parsed.eliminatedOnDay).toBeUndefined();
  });
});

describe('elimination actions — eliminatedOnDay side effects', () => {
  // enqueueActions returns an opaque wrapper; inspect source files directly.
  async function readSrc(rel: string): Promise<string> {
    // @ts-expect-error — tsconfig has @cloudflare/workers-types only; node is present at test runtime.
    const fsMod = await import('node:fs/promises');
    // @ts-expect-error — see above.
    const pathMod = await import('node:path');
    // @ts-expect-error — __dirname is available in Node.
    return fsMod.readFile(pathMod.resolve(__dirname, rel), 'utf-8');
  }

  it('adminEliminatePlayer sets eliminatedOnDay on the roster entry', async () => {
    const src = await readSrc('../machines/actions/l2-economy.ts');
    expect(src).toMatch(/adminEliminatePlayer[\s\S]*eliminatedOnDay:\s*context\.dayIndex/);
  });

  it('processNightSummary sets eliminatedOnDay on eliminated roster entry', async () => {
    const src = await readSrc('../machines/actions/l2-elimination.ts');
    expect(src).toMatch(/processNightSummary[\s\S]*eliminatedOnDay:\s*context\.dayIndex/);
  });

  it('ELIMINATION fact payload carries dayIndex (for Phase 4 push intents)', async () => {
    const src = await readSrc('../machines/actions/l2-elimination.ts');
    expect(src).toMatch(/FactTypes\.ELIMINATION[\s\S]{0,400}payload:[\s\S]{0,200}dayIndex/);
  });
});
