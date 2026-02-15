import type { SocialPlayer } from '@pecking-order/shared-types';

export function getAlivePlayerIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .map(([id]) => id);
}
