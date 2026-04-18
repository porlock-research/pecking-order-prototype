import type { GameType } from '@pecking-order/shared-types';

/**
 * Per-game presentation tokens for the GameShell chassis. Mirrors
 * `voting-tokens.ts` and `PROMPT_ACCENT` — pure presentation data,
 * never shipped from the server.
 *
 * Source-of-truth note: `displayName`, `tagline`, `description`,
 * and `mechanics` already live in `CARTRIDGE_INFO` (shared-types).
 * GAME_INFO only carries values that are presentation-specific
 * (accents, beat copy, status copy, optional render slots).
 *
 * All accent values are CSS variables from the --po-* contract
 * — cartridges stay shell-agnostic. Available accents on Pulse:
 *   --po-orange  --po-pink  --po-gold  --po-green  --po-blue  --po-violet
 *
 * Per-game accent assignments are intentional, not formulaic:
 *   - Each accent fits the *physical feel* of the game (Snake = green
 *     because the snake; Flappy = blue because sky; BeatDrop = pink
 *     because music; Stacker = gold because tower).
 *   - Wager games default to gold (pot identity); The Split breaks the
 *     pattern (green = trust) because trust IS the dramatic dimension.
 *   - Trivia goes violet (knowledge); Realtime Trivia goes pink (live).
 */
export interface GameInfoEntry {
  /** Primary accent — header label color, glow, podium highlight. */
  accent: string;
  /** Secondary accent for games with duality (rare). */
  accentSecondary?: string;
  /** Atmospheric one-liner under the game name. Reality-TV title-card voice.
   *  Omit to use the CARTRIDGE_INFO `tagline` instead. */
  moodSubtitle?: string;
  /** Single dramatic word/phrase shown the moment the player loses
   *  (the DEAD beat). Examples: "Crashed.", "Pattern broken.", "Time's up." */
  deadBeat: string;
  /** Status line for AWAITING_DECISION on first attempt. */
  statusFirstRun: string;
  /** Status line for AWAITING_DECISION when a retry beats prior score. */
  statusBeatPrev: string;
  /** Status line for AWAITING_DECISION when a retry equals prior score. */
  statusMatchedPrev: string;
  /** Status line for AWAITING_DECISION when a retry falls short. */
  statusBelowPrev: string;
}

export const GAME_INFO: Record<Exclude<GameType, 'NONE'>, GameInfoEntry> = {
  // --- REFLEX ----------------------------------------------------------
  SNAKE: {
    accent: 'var(--po-green)',
    deadBeat: 'Caught your tail.',
    statusFirstRun: 'First run',
    statusBeatPrev: 'Longer than last time',
    statusMatchedPrev: 'Same length',
    statusBelowPrev: 'Shorter than last time',
  },
  FLAPPY: {
    accent: 'var(--po-blue)',
    deadBeat: 'Clipped a pipe.',
    statusFirstRun: 'First flight',
    statusBeatPrev: 'Flew further',
    statusMatchedPrev: 'Same distance',
    statusBelowPrev: 'Came up short',
  },
  GAP_RUN: {
    accent: 'var(--po-orange)',
    deadBeat: 'Hit the wall.',
    statusFirstRun: 'First run',
    statusBeatPrev: 'New personal best',
    statusMatchedPrev: 'Matched your run',
    statusBelowPrev: 'Fell short of last',
  },
  REACTION_TIME: {
    accent: 'var(--po-pink)',
    deadBeat: 'Too slow.',
    statusFirstRun: 'First reaction',
    statusBeatPrev: 'Quicker than last',
    statusMatchedPrev: 'Same reflex',
    statusBelowPrev: 'Slower than before',
  },
  AIM_TRAINER: {
    accent: 'var(--po-orange)',
    deadBeat: "Time's up.",
    statusFirstRun: 'First round',
    statusBeatPrev: 'Sharper than before',
    statusMatchedPrev: 'Same accuracy',
    statusBelowPrev: 'Off your aim',
  },
  SHOCKWAVE: {
    accent: 'var(--po-violet)',
    deadBeat: 'Caught in the wave.',
    statusFirstRun: 'First wave',
    statusBeatPrev: 'Outlasted your last',
    statusMatchedPrev: 'Same survival',
    statusBelowPrev: 'Cut short',
  },
  ORBIT: {
    accent: 'var(--po-blue)',
    deadBeat: 'Drifted into the void.',
    statusFirstRun: 'First launch',
    statusBeatPrev: 'Cleaner orbit',
    statusMatchedPrev: 'Same trajectory',
    statusBelowPrev: 'Lost the line',
  },
  BEAT_DROP: {
    accent: 'var(--po-pink)',
    deadBeat: 'Combo broken.',
    statusFirstRun: 'First track',
    statusBeatPrev: 'Tighter rhythm',
    statusMatchedPrev: 'Same beat',
    statusBelowPrev: 'Missed the pocket',
  },
  INFLATE: {
    accent: 'var(--po-orange)',
    deadBeat: 'Popped.',
    statusFirstRun: 'First pump',
    statusBeatPrev: 'Held it longer',
    statusMatchedPrev: 'Same hold',
    statusBelowPrev: 'Bailed early',
  },
  STACKER: {
    accent: 'var(--po-gold)',
    deadBeat: 'Tower fell.',
    statusFirstRun: 'First stack',
    statusBeatPrev: 'Taller than before',
    statusMatchedPrev: 'Same height',
    statusBelowPrev: 'Came up short',
  },
  BLINK: {
    accent: 'var(--po-violet)',
    deadBeat: 'Missed it.',
    statusFirstRun: 'First flash',
    statusBeatPrev: 'Sharper eye',
    statusMatchedPrev: 'Same accuracy',
    statusBelowPrev: 'Slower this time',
  },
  TOUCH_SCREEN: {
    accent: 'var(--po-pink)',
    deadBeat: 'Let go.',
    statusFirstRun: 'First hold',
    statusBeatPrev: 'Held longer',
    statusMatchedPrev: 'Same grip',
    statusBelowPrev: 'Gave in early',
  },
  COLOR_MATCH: {
    accent: 'var(--po-orange)',
    deadBeat: "Time's up.",
    statusFirstRun: 'First run',
    statusBeatPrev: 'Faster eye',
    statusMatchedPrev: 'Same speed',
    statusBelowPrev: 'Slower this time',
  },
  QUICK_MATH: {
    accent: 'var(--po-green)',
    deadBeat: "Time's up.",
    statusFirstRun: 'First round',
    statusBeatPrev: 'Quicker math',
    statusMatchedPrev: 'Same speed',
    statusBelowPrev: 'Off your pace',
  },

  // --- MEMORY / COGNITION ---------------------------------------------
  SEQUENCE: {
    accent: 'var(--po-blue)',
    deadBeat: 'Sequence broken.',
    statusFirstRun: 'First sequence',
    statusBeatPrev: 'Longer chain',
    statusMatchedPrev: 'Same length',
    statusBelowPrev: 'Shorter chain',
  },
  SIMON_SAYS: {
    accent: 'var(--po-green)',
    deadBeat: 'Pattern broken.',
    statusFirstRun: 'First round',
    statusBeatPrev: 'Deeper memory',
    statusMatchedPrev: 'Same depth',
    statusBelowPrev: 'Shorter run',
  },
  RECALL: {
    accent: 'var(--po-blue)',
    deadBeat: "Couldn't hold it.",
    statusFirstRun: 'First scene',
    statusBeatPrev: 'Sharper memory',
    statusMatchedPrev: 'Same recall',
    statusBelowPrev: 'Foggier this time',
  },
  COLOR_SORT: {
    accent: 'var(--po-violet)',
    deadBeat: 'Stuck.',
    statusFirstRun: 'First sort',
    statusBeatPrev: 'Cleaner solve',
    statusMatchedPrev: 'Same moves',
    statusBelowPrev: 'Took longer',
  },
  GRID_PUSH: {
    accent: 'var(--po-orange)',
    deadBeat: "Time's up.",
    statusFirstRun: 'First push',
    statusBeatPrev: 'Higher score',
    statusMatchedPrev: 'Same score',
    statusBelowPrev: 'Lower score',
  },

  // --- TRIVIA ----------------------------------------------------------
  TRIVIA: {
    accent: 'var(--po-violet)',
    deadBeat: 'Out of questions.',
    statusFirstRun: 'First attempt',
    statusBeatPrev: 'Sharper round',
    statusMatchedPrev: 'Same score',
    statusBelowPrev: 'Off your mark',
  },
  REALTIME_TRIVIA: {
    accent: 'var(--po-pink)',
    deadBeat: 'Last bell.',
    statusFirstRun: 'First attempt',
    statusBeatPrev: 'Faster than last',
    statusMatchedPrev: 'Same pace',
    statusBelowPrev: 'Slower this time',
  },

  // --- WAGER -----------------------------------------------------------
  BET_BET_BET: {
    accent: 'var(--po-gold)',
    deadBeat: 'Bets are in.',
    statusFirstRun: 'First bet',
    statusBeatPrev: 'Better read',
    statusMatchedPrev: 'Same call',
    statusBelowPrev: 'Misread the room',
  },
  BLIND_AUCTION: {
    accent: 'var(--po-gold)',
    deadBeat: 'Hammer down.',
    statusFirstRun: 'First bid',
    statusBeatPrev: 'Better bid',
    statusMatchedPrev: 'Same outcome',
    statusBelowPrev: 'Outbid',
  },
  KINGS_RANSOM: {
    accent: 'var(--po-gold)',
    deadBeat: 'Throne taken.',
    statusFirstRun: 'First reign',
    statusBeatPrev: 'Held the throne longer',
    statusMatchedPrev: 'Same reign',
    statusBelowPrev: 'Lost it sooner',
  },
  THE_SPLIT: {
    accent: 'var(--po-green)',
    accentSecondary: 'var(--po-pink)',
    deadBeat: 'Split or steal.',
    statusFirstRun: 'First split',
    statusBeatPrev: 'Better outcome',
    statusMatchedPrev: 'Same outcome',
    statusBelowPrev: 'Worse outcome',
  },
};

/** Helper to read GAME_INFO with a safe fallback for unknown game types. */
export function getGameInfo(gameType: string): GameInfoEntry {
  const entry = GAME_INFO[gameType as keyof typeof GAME_INFO];
  if (entry) return entry;
  return {
    accent: 'var(--po-gold)',
    deadBeat: 'Round over.',
    statusFirstRun: 'First attempt',
    statusBeatPrev: 'New personal best',
    statusMatchedPrev: 'Matched your last',
    statusBelowPrev: 'Came up short',
  };
}

/**
 * Pick the right status line given current and previous silver rewards.
 * `previousSilverReward` of 0 (or null) means this is the first attempt.
 */
export function pickStatusLine(
  info: GameInfoEntry,
  silverReward: number,
  previousSilverReward: number | null,
): string {
  if (previousSilverReward == null || previousSilverReward === 0) {
    return info.statusFirstRun;
  }
  if (silverReward > previousSilverReward) return info.statusBeatPrev;
  if (silverReward === previousSilverReward) return info.statusMatchedPrev;
  return info.statusBelowPrev;
}
