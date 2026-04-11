import type { VoteType, GameType, PromptType } from './index';

// ── Mechanic metadata ──
// Each mechanic has a minimum player count below which it degenerates
// (e.g. Executioner with 4 players has only 1 valid target because top 3 are immune).

interface MechanicSpec<T extends string> { type: T; minPlayers: number }

// Voting: narrative arc from economic awareness → alliances → power shifts → survival.
// EXECUTIONER needs 5+ because at 4 players top-3 immunity leaves only 1 target.
// PODIUM_SACRIFICE needs 5+ because at 4 players only 1 non-podium voter exists.
const VOTE_POOL: MechanicSpec<VoteType>[] = [
  { type: 'BUBBLE', minPlayers: 6 },
  { type: 'TRUST_PAIRS', minPlayers: 5 },
  { type: 'PODIUM_SACRIFICE', minPlayers: 5 },
  { type: 'EXECUTIONER', minPlayers: 5 },
  { type: 'SHIELD', minPlayers: 4 },
  { type: 'SECOND_TO_LAST', minPlayers: 3 },
  { type: 'MAJORITY', minPlayers: 3 },
];

// Games: alternating categories for variety (knowledge → social → arcade → social → ...).
// Social games (4+) naturally filter out in later days when player count drops.
const GAME_POOL: MechanicSpec<GameType>[] = [
  { type: 'TRIVIA', minPlayers: 2 },
  { type: 'THE_SPLIT', minPlayers: 4 },
  { type: 'GRID_PUSH', minPlayers: 2 },
  { type: 'KINGS_RANSOM', minPlayers: 4 },
  { type: 'BET_BET_BET', minPlayers: 4 },
  { type: 'REALTIME_TRIVIA', minPlayers: 2 },
  { type: 'BLIND_AUCTION', minPlayers: 4 },
  { type: 'SEQUENCE', minPlayers: 2 },
  { type: 'TOUCH_SCREEN', minPlayers: 3 },
  { type: 'REACTION_TIME', minPlayers: 2 },
  { type: 'COLOR_MATCH', minPlayers: 2 },
  { type: 'QUICK_MATH', minPlayers: 2 },
  { type: 'STACKER', minPlayers: 2 },
  { type: 'GAP_RUN', minPlayers: 2 },
  { type: 'SIMON_SAYS', minPlayers: 2 },
  { type: 'AIM_TRAINER', minPlayers: 2 },
  { type: 'SHOCKWAVE', minPlayers: 2 },
  { type: 'ORBIT', minPlayers: 2 },
  { type: 'BEAT_DROP', minPlayers: 2 },
];

// Activities: icebreaker → suspense → fun → deeper social → opinion → deduction.
const ACTIVITY_POOL: MechanicSpec<PromptType>[] = [
  { type: 'PLAYER_PICK', minPlayers: 3 },
  { type: 'PREDICTION', minPlayers: 3 },
  { type: 'WOULD_YOU_RATHER', minPlayers: 3 },
  { type: 'CONFESSION', minPlayers: 3 },
  { type: 'HOT_TAKE', minPlayers: 3 },
  { type: 'GUESS_WHO', minPlayers: 3 },
];

const LIVE_GAMES: ReadonlySet<GameType> = new Set<GameType>(['TOUCH_SCREEN']);

// ── Public API ──

export interface CycleDayDefaults {
  voteType: VoteType;
  gameType: GameType;
  gameMode?: 'SOLO' | 'LIVE';
  activityType: PromptType | 'NONE';
}

function pickNext<T extends string>(
  pool: MechanicSpec<T>[],
  used: Set<string>,
  playerCount: number,
): T | undefined {
  return pool.find(m => !used.has(m.type) && playerCount >= m.minPlayers)?.type;
}

/**
 * Generate intelligent defaults for a configurable cycle tournament.
 *
 * Player count on day i (1-indexed) = dayCount + 1 - (i - 1).
 * The last day is always FINALS. Mechanics are never repeated across days.
 * When dayCount changes, the entire schedule adapts — mechanics that need
 * large groups appear early, simpler ones fill later days.
 */
export function generateCycleDefaults(dayCount: number): CycleDayDefaults[] {
  const usedVotes = new Set<string>();
  const usedGames = new Set<string>();
  const usedActivities = new Set<string>();

  return Array.from({ length: dayCount }, (_, i) => {
    const playerCount = dayCount + 1 - i; // Day 1 has all players, decreasing by 1 each day
    const isLastDay = i === dayCount - 1;

    const voteType: VoteType = isLastDay
      ? 'FINALS'
      : (pickNext(VOTE_POOL, usedVotes, playerCount) ?? 'MAJORITY');
    usedVotes.add(voteType);

    const gameType: GameType = pickNext(GAME_POOL, usedGames, playerCount) ?? 'TRIVIA';
    usedGames.add(gameType);

    const activityType: PromptType | 'NONE' = isLastDay
      ? 'NONE'
      : (pickNext(ACTIVITY_POOL, usedActivities, playerCount) ?? 'NONE');
    usedActivities.add(activityType);

    return {
      voteType,
      gameType,
      ...(LIVE_GAMES.has(gameType) && { gameMode: 'LIVE' as const }),
      activityType,
    };
  });
}

/** Check whether a game type requires LIVE mode. */
export function isLiveGame(gameType: GameType): boolean {
  return LIVE_GAMES.has(gameType);
}
