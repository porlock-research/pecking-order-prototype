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

/** 4 alive players: p0(50), p1(45), p2(40), p3(35) */
export function alive4(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ALIVE' },
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

/** 3 alive players: p0(50), p1(45), p2(40) */
export function alive3(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
  };
}
