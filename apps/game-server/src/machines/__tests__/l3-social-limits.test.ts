import { describe, it, expect } from 'vitest';
import { buildL3Context } from '../l3-session';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
import { DM_MAX_CHARS_PER_DAY, DM_MAX_PARTNERS_PER_DAY } from '@pecking-order/shared-types';

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const BASE_DAY: DailyManifest = {
  dayIndex: 1,
  theme: 'Day 1',
  voteType: 'MAJORITY',
  gameType: 'NONE',
  timeline: [],
};

describe('L3 social limits from manifest', () => {
  it('uses default DM limits when manifest has no social params', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.dmCharsLimit).toBe(DM_MAX_CHARS_PER_DAY);
    expect(ctx.dmPartnersLimit).toBe(DM_MAX_PARTNERS_PER_DAY);
  });

  it('uses custom DM limits from manifest social params', () => {
    const customDay: DailyManifest = {
      ...BASE_DAY,
      dmCharsPerPlayer: 800,
      dmPartnersPerPlayer: 2,
    };
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: customDay });
    expect(ctx.dmCharsLimit).toBe(800);
    expect(ctx.dmPartnersLimit).toBe(2);
  });

  it('falls back to defaults when manifest is undefined', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4) });
    expect(ctx.dmCharsLimit).toBe(DM_MAX_CHARS_PER_DAY);
    expect(ctx.dmPartnersLimit).toBe(DM_MAX_PARTNERS_PER_DAY);
  });
});
