/**
 * Vote type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain voting mechanics to players.
 */
import type { VoteType } from './index';

export interface VoteTypeUiInfo {
  name: string;
  description: string;
  howItWorks: string;
  header: string;
  cta: string;
  oneLiner: string;
  confirmTemplate: string;  // "Save {name}?" — {name} replaced at runtime
  actionVerb: string;       // "saved" — for "You saved {name}"
  // Executioner second-phase fields (only on EXECUTIONER entry)
  executionerPickHeader?: string;
  executionerPickCta?: string;
  executionerPickConfirm?: string;
  executionerPickVerb?: string;
}

export const VOTE_TYPE_INFO: Record<VoteType, VoteTypeUiInfo> = {
  MAJORITY: {
    name: 'Majority Vote',
    description: 'The player with the most votes is eliminated.',
    howItWorks:
      'Each player votes for one person. The player with the most votes is eliminated. Ties are broken by lowest silver balance.',
    header: 'Majority: Eliminate a Player',
    cta: 'Who should go?',
    oneLiner: 'Most votes = eliminated \u00b7 Ties: lowest silver',
    confirmTemplate: 'Eliminate {name}?',
    actionVerb: 'voted for',
  },
  EXECUTIONER: {
    name: 'Executioner',
    description: 'Elect an executioner who picks someone to eliminate.',
    howItWorks:
      'First, everyone votes for an executioner. Then the executioner chooses who to eliminate.',
    header: 'Executioner: Elect a Judge',
    cta: 'Who do you trust with the power?',
    oneLiner: 'The elected player chooses who to eliminate',
    confirmTemplate: 'Elect {name}?',
    actionVerb: 'elected',
    executionerPickHeader: 'Executioner: Pick Your Target',
    executionerPickCta: 'You are the executioner. Who goes?',
    executionerPickConfirm: 'Eliminate {name}?',
    executionerPickVerb: 'eliminated',
  },
  BUBBLE: {
    name: 'Bubble Vote',
    description: 'Vote to save players. The least-saved player is eliminated.',
    howItWorks:
      'Each player votes to save someone. The player with the fewest saves is eliminated.',
    header: 'Bubble: Save a Player',
    cta: 'Who do you want to save?',
    oneLiner: 'Fewest saves = eliminated \u00b7 Top 3 silver immune',
    confirmTemplate: 'Save {name}?',
    actionVerb: 'saved',
  },
  PODIUM_SACRIFICE: {
    name: 'Podium Sacrifice',
    description: 'Top silver holders are at risk — others vote to save one.',
    howItWorks:
      'The 3 players with the most silver are on the podium. Everyone else votes to save one of them. The unsaved podium player is eliminated.',
    header: 'Podium: Save One from the Top',
    cta: 'Which top player deserves to stay?',
    oneLiner: 'Top 3 silver at risk \u00b7 Save one, one goes',
    confirmTemplate: 'Save {name}?',
    actionVerb: 'saved',
  },
  SECOND_TO_LAST: {
    name: 'Second to Last',
    description: 'The second-lowest silver holder is eliminated.',
    howItWorks:
      'No voting needed. The player with the second-lowest silver balance is automatically eliminated.',
    header: 'Second to Last',
    cta: '',
    oneLiner: 'Second-lowest silver is eliminated',
    confirmTemplate: '',
    actionVerb: '',
  },
  SHIELD: {
    name: 'Shield',
    description: 'Save one player from elimination.',
    howItWorks:
      'Each player votes to shield someone. The most-shielded player is safe. Then a majority vote determines who is eliminated.',
    header: 'Shield: Protect a Player',
    cta: 'Who deserves protection?',
    oneLiner: 'Most-shielded is safe \u00b7 Then majority eliminates',
    confirmTemplate: 'Shield {name}?',
    actionVerb: 'shielded',
  },
  TRUST_PAIRS: {
    name: 'Trust Pairs',
    description: 'Paired trust decisions — trust or eliminate your partner.',
    howItWorks:
      'Players are paired randomly. Each player secretly chooses to TRUST or ELIMINATE their partner. If both trust, both are safe. If one eliminates, the trusting player is out. If both eliminate, both survive.',
    header: 'Trust Pairs: Trust or Betray',
    cta: 'Do you trust your partner?',
    oneLiner: 'Both trust = safe \u00b7 One betrays = other out',
    confirmTemplate: 'Trust {name}?',
    actionVerb: 'trusted',
  },
  DUELS: {
    name: 'Duels',
    description: 'Head-to-head elimination duels.',
    howItWorks:
      'Players are paired for duels. The community votes on each pair to decide who is eliminated.',
    header: 'Duels: Pick a Side',
    cta: 'Who should survive?',
    oneLiner: 'Community votes on each pair',
    confirmTemplate: 'Vote for {name}?',
    actionVerb: 'voted for',
  },
  FINALS: {
    name: 'Finals',
    description: 'Eliminated players vote for the winner.',
    howItWorks:
      'All eliminated players vote for their favorite remaining player. The player with the most votes wins the game.',
    header: 'Finals: Crown the Winner',
    cta: 'Who played the best game?',
    oneLiner: 'Eliminated players vote \u00b7 Most votes wins',
    confirmTemplate: 'Crown {name}?',
    actionVerb: 'crowned',
  },
};
