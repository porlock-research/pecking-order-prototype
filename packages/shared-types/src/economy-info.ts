/**
 * Economy explanations — shell-agnostic reference data.
 * Any shell can import and render these descriptions to help players
 * understand the Silver/Gold economy.
 */

export const ECONOMY_INFO = {
  silver: {
    name: 'Silver',
    description:
      'Personal currency earned from mini-games and activities. Spend it on DMs, perks, and silver transfers to other players.',
    earnedFrom: [
      'Mini-games (score-based)',
      'Activities/prompts',
      'Silver transfers from other players',
    ],
    spentOn: [
      'Sending DMs (per message)',
      'Buying perks (SPY_DMS, EXTRA_DM_PARTNER, EXTRA_DM_CHARS)',
      'Silver transfers to other players',
    ],
  },
  gold: {
    name: 'Gold',
    description:
      'Group pool contributed from mini-game performance. The gold pool is split among finalists at game end.',
    earnedFrom: ['Mini-game gold contributions (automatic)'],
    spentOn: ['Distributed to winner/finalists at game end'],
  },
} as const;
