/**
 * Vote type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain voting mechanics to players.
 */
import type { VoteType } from './index';

export type MechanismTone = 'punitive' | 'fate' | 'celebratory';

export interface VoteTypeUiInfo {
  name: string;
  description: string;
  howItWorks: string;
  header: string;
  cta: string;
  oneLiner: string;
  /** Atmospheric tagline rendered under the mechanism name — one line, reality-TV title-card voice. */
  moodSubtitle: string;
  /** Single-word reveal label above the eliminated/winning name — e.g. "Out", "Cut", "Crowned". Rendered in uppercase tracked caps. */
  revealLabel: string;
  confirmTemplate: string;  // "Save {name}?" — {name} replaced at runtime
  actionVerb: string;       // "saved" — for "You saved {name}"
  // Hero subtitle on REVEAL when an elimination occurs
  eliminatedSubtitle: string;
  // Hero copy on REVEAL when no elimination happens
  noEliminationCopy: string;
  // Tone drives hero composition: punitive (community decision), fate (no choice), celebratory (FINALS)
  mechanismTone: MechanismTone;
  // FINALS only — hero subtitle on the winner reveal
  winnerSubtitle?: string;
  // Executioner second-phase fields (only on EXECUTIONER entry)
  executionerPickHeader?: string;
  executionerPickCta?: string;
  executionerPickConfirm?: string;
  executionerPickVerb?: string;
  /** Caption under the secondary portrait on EXECUTIONER reveal (the elected executioner). */
  executionerRevealCaption?: string;
}

export const VOTE_TYPE_INFO: Record<VoteType, VoteTypeUiInfo> = {
  MAJORITY: {
    name: 'Majority',
    description: 'The most-voted player is eliminated.',
    howItWorks:
      'Everyone picks one player. The most-picked is out. Tie? Lowest silver loses.',
    header: 'Majority: Eliminate a Player',
    cta: 'Who should go?',
    oneLiner: 'Most votes out \u00b7 Ties: lowest silver',
    moodSubtitle: 'Most votes go home',
    revealLabel: 'Out',
    confirmTemplate: 'Eliminate {name}?',
    actionVerb: 'voted for',
    eliminatedSubtitle: 'Voted out by the group',
    noEliminationCopy: 'The group spared everyone',
    mechanismTone: 'punitive',
  },
  EXECUTIONER: {
    name: 'Executioner',
    description: 'Elect one player — they decide who goes.',
    howItWorks:
      'Step 1: vote for an executioner. Step 2: they pick who\u2019s out. One hand, one cut.',
    header: 'Executioner: Elect a Judge',
    cta: 'Who gets the power?',
    oneLiner: 'One hand picks \u00b7 One player falls',
    moodSubtitle: 'One hand makes the cut',
    revealLabel: 'Cut',
    confirmTemplate: 'Elect {name}?',
    actionVerb: 'elected',
    eliminatedSubtitle: 'Cut down by the executioner',
    noEliminationCopy: 'The executioner stayed their hand',
    mechanismTone: 'punitive',
    executionerPickHeader: 'Executioner: Pick Your Target',
    executionerPickCta: 'You\u2019re the executioner. Who goes?',
    executionerPickConfirm: 'Eliminate {name}?',
    executionerPickVerb: 'eliminated',
    executionerRevealCaption: 'The executioner',
  },
  BUBBLE: {
    name: 'Bubble',
    description: 'Saves keep you floating. Fewest saves sinks.',
    howItWorks:
      'Pick one player to save. The fewest-saved player is out. Top 3 silver holders are immune.',
    header: 'Bubble: Save a Player',
    cta: 'Who do you save?',
    oneLiner: 'Fewest saves out \u00b7 Top 3 silver immune',
    moodSubtitle: 'Saves keep you afloat',
    revealLabel: 'Sunk',
    confirmTemplate: 'Save {name}?',
    actionVerb: 'saved',
    eliminatedSubtitle: 'Not enough saves to stay afloat',
    noEliminationCopy: 'Everyone floated through',
    mechanismTone: 'punitive',
  },
  PODIUM_SACRIFICE: {
    name: 'Podium Sacrifice',
    description: 'The richest are on the block — the group saves one.',
    howItWorks:
      'The 3 richest players are on the podium. Everyone else saves one of them. The unsaved one falls.',
    header: 'Podium: Save One from the Top',
    cta: 'Which top player stays?',
    oneLiner: 'Top 3 at risk \u00b7 Save one, one falls',
    moodSubtitle: 'The top bleeds first',
    revealLabel: 'Fallen',
    confirmTemplate: 'Save {name}?',
    actionVerb: 'saved',
    eliminatedSubtitle: 'Sacrificed from the top',
    noEliminationCopy: 'The podium stands',
    mechanismTone: 'punitive',
  },
  SECOND_TO_LAST: {
    name: 'Second to Last',
    description: 'No vote. The second-poorest player is out.',
    howItWorks:
      'No voting. The player with the second-lowest silver is automatically out. Fate, not choice.',
    header: 'Second to Last',
    cta: '',
    oneLiner: 'Second-lowest silver is out',
    moodSubtitle: 'Fate, not choice',
    revealLabel: 'Last',
    confirmTemplate: '',
    actionVerb: '',
    eliminatedSubtitle: 'Second-lowest in silver',
    noEliminationCopy: 'No one to cut',
    mechanismTone: 'fate',
  },
  SHIELD: {
    name: 'Shield',
    description: 'Protect first. The group eliminates after.',
    howItWorks:
      'Pick one player to shield. The most-shielded is safe. Then the group votes someone else out.',
    header: 'Shield: Protect a Player',
    cta: 'Who do you shield?',
    oneLiner: 'Most-shielded safe \u00b7 Group eliminates next',
    moodSubtitle: 'Saved first \u2014 then sorted',
    revealLabel: 'Unshielded',
    confirmTemplate: 'Shield {name}?',
    actionVerb: 'shielded',
    eliminatedSubtitle: 'No shield, no save',
    noEliminationCopy: 'Shields held all around',
    mechanismTone: 'punitive',
  },
  TRUST_PAIRS: {
    name: 'Trust Pairs',
    description: 'Paired. Trust or betray. Only one of you can be wrong.',
    howItWorks:
      'You\u2019re paired with one other player. You each secretly pick TRUST or BETRAY. Both trust = both safe. One betrays = the truster is out. Both betray = both survive.',
    header: 'Trust Pairs: Trust or Betray',
    cta: 'Do you trust your partner?',
    oneLiner: 'Both trust = safe \u00b7 One betrays = truster out',
    moodSubtitle: 'Trust, or burn it',
    revealLabel: 'Betrayed',
    confirmTemplate: 'Trust {name}?',
    actionVerb: 'trusted',
    eliminatedSubtitle: 'Betrayed by a partner',
    noEliminationCopy: 'No betrayal landed',
    mechanismTone: 'punitive',
  },
  DUELS: {
    name: 'Duels',
    description: 'Paired for head-to-head. The group picks the survivor.',
    howItWorks:
      'Players are paired off. The group votes on each pair. The loser of each duel is out.',
    header: 'Duels: Pick a Side',
    cta: 'Who should survive?',
    oneLiner: 'Head-to-head \u00b7 Group picks survivors',
    moodSubtitle: 'Two enter \u2014 one stays',
    revealLabel: 'Lost',
    confirmTemplate: 'Save {name}?',
    actionVerb: 'voted for',
    eliminatedSubtitle: 'Lost the duel',
    noEliminationCopy: 'Both duelists survive',
    mechanismTone: 'punitive',
  },
  FINALS: {
    name: 'Finals',
    description: 'The jury of eliminated players crowns the winner.',
    howItWorks:
      'Eliminated players are the jury \u2014 they crown one survivor. Most votes wins the game.',
    header: 'Finals: Crown the Winner',
    cta: 'Who played the best game?',
    oneLiner: 'Jury votes \u00b7 Most votes wins',
    moodSubtitle: 'The ghosts crown the winner',
    revealLabel: 'Crowned',
    confirmTemplate: 'Crown {name}?',
    actionVerb: 'crowned',
    eliminatedSubtitle: '',
    noEliminationCopy: '',
    mechanismTone: 'celebratory',
    winnerSubtitle: 'Top of the pecking order',
  },
};
