/**
 * Showcase Seed — builds a roster of N personas, all ALIVE.
 * Reuses the same persona pool as /create-game command.
 */
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PlayerStatuses } from '@pecking-order/shared-types';

const PERSONA_POOL = [
  { personaId: 'persona-01', name: 'Bella Rossi', stereotype: 'The Influencer', bio: 'Lives for the likes, dies for lack of Wi-Fi.' },
  { personaId: 'persona-02', name: 'Chad Brock', stereotype: 'The Showmance', bio: 'Here to find love and maybe a protein shake.' },
  { personaId: 'persona-03', name: 'Sheila Bear', stereotype: 'The Momager', bio: "She didn't come to make friends; she came to make her daughter a star." },
  { personaId: 'persona-04', name: 'Silas Vane', stereotype: 'The Backstabber', bio: 'Whispers lies into ears and smiles for the cameras.' },
  { personaId: 'persona-05', name: 'Brick Thompson', stereotype: 'The Jock', bio: 'Winning is the only thing that matters.' },
  { personaId: 'persona-06', name: 'Kevin King', stereotype: 'The Conspiracy Theorist', bio: 'Believes the producers are lizards and the voting is rigged by ghosts.' },
  { personaId: 'persona-07', name: 'Penelope Pout', stereotype: 'The Crying Mess', bio: 'Everything is a tragedy. She can produce tears on command.' },
  { personaId: 'persona-08', name: 'Big Z', stereotype: 'The Zen Master', bio: 'Meditates through the screaming matches.' },
] as const;

const STAGING_ASSETS = 'https://staging-assets.peckingorder.ca';

function buildAvatarUrl(personaId: string, assetsBase: string): string {
  if (assetsBase.includes('/api/persona-image')) {
    return `${assetsBase}/${personaId}/headshot.png`;
  }
  return `${assetsBase}/personas/${personaId}/headshot.png`;
}

export function buildShowcaseRoster(
  playerCount: number,
  assetsBase: string = STAGING_ASSETS,
): Record<string, SocialPlayer> {
  const count = Math.min(Math.max(playerCount, 2), PERSONA_POOL.length);
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    const p = PERSONA_POOL[i];
    roster[`p${i}`] = {
      id: `p${i}`,
      realUserId: `showcase-${p.personaId}`,
      personaName: p.name,
      avatarUrl: buildAvatarUrl(p.personaId, assetsBase),
      bio: `${p.stereotype} — ${p.bio}`,
      isAlive: true,
      isSpectator: false,
      status: PlayerStatuses.ALIVE,
      silver: 50,
      gold: 0,
      destinyId: '',
    } as SocialPlayer;
  }
  return roster;
}
