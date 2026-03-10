/**
 * Vote type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain voting mechanics to players.
 */
import type { VoteType } from './index';

export const VOTE_TYPE_INFO: Record<VoteType, { name: string; description: string; howItWorks: string }> = {
  MAJORITY: {
    name: 'Majority Vote',
    description: 'The player with the most votes is eliminated.',
    howItWorks:
      'Each player votes for one person. The player with the most votes is eliminated. Ties are broken by lowest silver balance.',
  },
  EXECUTIONER: {
    name: 'Executioner',
    description: 'Elect an executioner who picks someone to eliminate.',
    howItWorks:
      'First, everyone votes for an executioner. Then the executioner chooses who to eliminate.',
  },
  BUBBLE: {
    name: 'Bubble Vote',
    description: 'Vote to save players. The least-saved player is eliminated.',
    howItWorks:
      'Each player votes to save someone. The player with the fewest saves is eliminated.',
  },
  PODIUM_SACRIFICE: {
    name: 'Podium Sacrifice',
    description: 'Top silver holders are at risk — others vote to save one.',
    howItWorks:
      'The 3 players with the most silver are on the podium. Everyone else votes to save one of them. The unsaved podium player is eliminated.',
  },
  SECOND_TO_LAST: {
    name: 'Second to Last',
    description: 'The second-lowest silver holder is eliminated.',
    howItWorks:
      'No voting needed. The player with the second-lowest silver balance is automatically eliminated.',
  },
  SHIELD: {
    name: 'Shield',
    description: 'Save one player from elimination.',
    howItWorks:
      'Each player votes to shield someone. The most-shielded player is safe. Then a majority vote determines who is eliminated.',
  },
  TRUST_PAIRS: {
    name: 'Trust Pairs',
    description: 'Paired trust decisions — trust or eliminate your partner.',
    howItWorks:
      'Players are paired randomly. Each player secretly chooses to TRUST or ELIMINATE their partner. If both trust, both are safe. If one eliminates, the trusting player is out. If both eliminate, both survive.',
  },
  DUELS: {
    name: 'Duels',
    description: 'Head-to-head elimination duels.',
    howItWorks:
      'Players are paired for duels. The community votes on each pair to decide who is eliminated.',
  },
  FINALS: {
    name: 'Finals',
    description: 'Eliminated players vote for the winner.',
    howItWorks:
      'All eliminated players vote for their favorite remaining player. The player with the most votes wins the game.',
  },
};
