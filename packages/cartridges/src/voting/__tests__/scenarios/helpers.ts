import type { SocialPlayer } from '@pecking-order/shared-types';

// ---------------------------------------------------------------------------
// Roster helper
// ---------------------------------------------------------------------------

export function buildRoster(
  spec: Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }>,
): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (const [id, { silver, status }] of Object.entries(spec)) {
    roster[id] = {
      id,
      personaName: `Player ${id.slice(1)}`,
      avatarUrl: '',
      status,
      silver,
      gold: 0,
      realUserId: `u${id.slice(1)}`,
    } as SocialPlayer;
  }
  return roster;
}

// ---------------------------------------------------------------------------
// Compact roster builders for common layouts
// ---------------------------------------------------------------------------

/** 6 alive players: p0(50), p1(45), p2(40), p3(35), p4(30), p5(25) */
export function alive6(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ALIVE' },
    p4: { silver: 30, status: 'ALIVE' },
    p5: { silver: 25, status: 'ALIVE' },
  };
}

/** 5 alive players: p0(50), p1(45), p2(40), p3(35), p4(30) */
export function alive5(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ALIVE' },
    p4: { silver: 30, status: 'ALIVE' },
  };
}

/** 5 total, 3 alive (p0-p2), 2 eliminated (p3-p4) — for Finals */
export function finals5(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ELIMINATED' },
    p4: { silver: 30, status: 'ELIMINATED' },
  };
}
