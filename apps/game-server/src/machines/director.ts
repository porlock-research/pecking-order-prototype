import { setup, assign } from 'xstate';
import type {
  PeckingOrderRuleset,
  SchedulePreset,
  SocialPlayer,
  VoteType,
  GameType,
  DailyManifest,
  GameHistoryEntry,
} from '@pecking-order/shared-types';

// ── Input / Context types ───────────────────────────────────────────────

export interface DirectorInput {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
}

export interface DirectorContext {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
  totalDays: number;
  resolvedDay: DailyManifest | null;
  observations: {
    factCounts: Record<string, number>;
    activePlayerIds: string[];
  };
  reasoning: string;
}

// ── Pure resolution functions ───────────────────────────────────────────

function countAlivePlayers(roster: Record<string, SocialPlayer>): number {
  return Object.values(roster).filter(p => p.status === 'ALIVE').length;
}

function computeTotalDays(alive: number, rules: PeckingOrderRuleset['dayCount']): number {
  let total: number;
  if (rules.mode === 'FIXED') {
    total = rules.fixedCount ?? alive - 1;
  } else {
    // ACTIVE_PLAYERS_MINUS_ONE
    total = alive - 1;
  }
  if (rules.maxDays !== undefined) {
    total = Math.min(total, rules.maxDays);
  }
  return Math.max(total, 1);
}

function resolveVoteType(
  dayIndex: number,
  totalDays: number,
  rules: PeckingOrderRuleset['voting'],
  alivePlayers: number,
): VoteType {
  // Last day is always FINALS
  if (dayIndex >= totalDays) return 'FINALS';

  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    const candidate = rules.sequence[idx];
    // Check player-count constraints
    if (rules.constraints) {
      const constraint = rules.constraints.find(c => c.voteType === candidate);
      if (constraint && alivePlayers < constraint.minPlayers) {
        return 'MAJORITY'; // safe fallback
      }
    }
    return candidate;
  }

  if (rules.mode === 'POOL' && rules.pool) {
    const idx = (dayIndex - 1) % rules.pool.length;
    return rules.pool[idx];
  }

  return 'MAJORITY';
}

function resolveGameType(
  dayIndex: number,
  rules: PeckingOrderRuleset['games'],
  gameHistory: GameHistoryEntry[],
): GameType {
  if (rules.mode === 'NONE') return 'NONE';

  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    return rules.sequence[idx];
  }

  if (rules.mode === 'POOL' && rules.pool) {
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastGame = gameHistory[gameHistory.length - 1];
      const filtered = rules.pool.filter(g => g !== lastGame?.gameType);
      if (filtered.length > 0) {
        return filtered[(dayIndex - 1) % filtered.length];
      }
    }
    return rules.pool[(dayIndex - 1) % rules.pool.length];
  }

  return 'NONE';
}

function scaleValue(
  dayIndex: number,
  totalDays: number,
  rule: { mode: string; base: number; floor?: number },
): number {
  if (rule.mode === 'FIXED') return rule.base;

  if (rule.mode === 'DIMINISHING') {
    const floor = rule.floor ?? Math.floor(rule.base * 0.3);
    const progress = Math.min((dayIndex - 1) / Math.max(totalDays - 1, 1), 1);
    return Math.round(rule.base - (rule.base - floor) * progress);
  }

  if (rule.mode === 'PER_ACTIVE_PLAYER') {
    return rule.base; // future: multiply by alive count
  }

  return rule.base;
}

function resolveSocialParams(
  dayIndex: number,
  totalDays: number,
  rules: PeckingOrderRuleset['social'],
): { dmCharsPerPlayer: number; dmPartnersPerPlayer: number } {
  return {
    dmCharsPerPlayer: scaleValue(dayIndex, totalDays, rules.dmChars),
    dmPartnersPerPlayer: scaleValue(dayIndex, totalDays, rules.dmPartners),
  };
}

// ── Exported context builder (testable without XState) ──────────────────

/** Build director context from input. Exported for unit testing. */
export function buildDirectorContext(input: DirectorInput): DirectorContext {
  const alive = countAlivePlayers(input.roster);
  const totalDays = computeTotalDays(alive, input.ruleset.dayCount);
  const voteType = resolveVoteType(input.dayIndex, totalDays, input.ruleset.voting, alive);
  const gameType = resolveGameType(input.dayIndex, input.ruleset.games, input.gameHistory);
  const social = resolveSocialParams(input.dayIndex, totalDays, input.ruleset.social);

  const resolvedDay: DailyManifest = {
    dayIndex: input.dayIndex,
    theme: `Day ${input.dayIndex}`,
    voteType,
    gameType,
    timeline: [], // Timeline stamped by L2 from schedulePreset
    ...social,
  };

  return {
    dayIndex: input.dayIndex,
    roster: input.roster,
    ruleset: input.ruleset,
    schedulePreset: input.schedulePreset,
    gameHistory: input.gameHistory,
    totalDays,
    resolvedDay,
    observations: {
      factCounts: {},
      activePlayerIds: [],
    },
    reasoning: `Day ${input.dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${social.dmCharsPerPlayer} DM chars`,
  };
}

// ── XState machine ──────────────────────────────────────────────────────

export function createDirectorMachine() {
  return setup({
    types: {
      input: {} as DirectorInput,
      context: {} as DirectorContext,
      events: {} as
        | { type: 'FACT.RECORD'; fact: { type: string; actorId: string; targetId?: string; payload?: any; timestamp: number } }
        | { type: 'ADMIN.OVERRIDE_NEXT_DAY'; day: Partial<DailyManifest> },
    },
  }).createMachine({
    id: 'director',
    initial: 'observing',
    context: ({ input }) => buildDirectorContext(input),
    states: {
      observing: {
        on: {
          'FACT.RECORD': {
            actions: assign({
              observations: ({ context, event }) => {
                const factType = event.fact.type;
                const factCounts = {
                  ...context.observations.factCounts,
                  [factType]: (context.observations.factCounts[factType] || 0) + 1,
                };
                const activePlayerIds = [...context.observations.activePlayerIds];
                if (event.fact.actorId && event.fact.actorId !== 'SYSTEM' && !activePlayerIds.includes(event.fact.actorId)) {
                  activePlayerIds.push(event.fact.actorId);
                }
                return { factCounts, activePlayerIds };
              },
            }),
          },
          'ADMIN.OVERRIDE_NEXT_DAY': {
            actions: assign({
              resolvedDay: ({ context, event }) => {
                if (!context.resolvedDay) return null;
                return { ...context.resolvedDay, ...event.day };
              },
              reasoning: ({ context }) => `${context.reasoning} [ADMIN OVERRIDE]`,
            }),
          },
        },
      },
    },
  });
}
