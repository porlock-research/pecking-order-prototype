import type { SocialPlayer } from '@pecking-order/shared-types';

export function getAlivePlayerIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .map(([id]) => id);
}

export function getTop3SilverIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .sort(([, a], [, b]) => b.silver - a.silver)
    .slice(0, 3)
    .map(([id]) => id);
}

export function getSilverRanking(roster: Record<string, SocialPlayer>): Array<{ id: string; silver: number }> {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .sort(([, a], [, b]) => b.silver - a.silver)
    .map(([id, p]) => ({ id, silver: p.silver }));
}
