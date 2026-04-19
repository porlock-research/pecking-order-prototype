import { setup, assign } from 'xstate';
import type {
  PeckingOrderRuleset,
  SchedulePreset,
  SocialPlayer,
  VoteType,
  GameType,
  PromptType,
  DilemmaType,
  DailyManifest,
  GameHistoryEntry,
  GameMasterAction,
} from '@pecking-order/shared-types';
import { VOTE_TYPE_INFO, ACTIVITY_TYPE_INFO, pickHotTakeQuestion } from '@pecking-order/shared-types';
import { generateDayTimeline, computeNextDayStart } from './timeline-presets';
import { createInactivityModule, type InactivityState } from './observations/inactivity';

// ── Input / Context types ───────────────────────────────────────────────

export interface GameMasterInput {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  startTime: string;
  gameHistory: GameHistoryEntry[];
}

export interface GameMasterContext {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  startTime: string;
  gameHistory: GameHistoryEntry[];
  dayIndex: number;
  totalDays: number;
  resolvedDay: DailyManifest | null;
  reasoning: string;
  inactivityState: InactivityState;
  gameMasterActions: GameMasterAction[];
  /** HOT_TAKE question ids picked so far this game; used to avoid intra-game repeats. */
  hotTakeHistory: string[];
}

// ── Pure resolution functions (unchanged from before) ───────────────────

function countAlivePlayers(roster: Record<string, SocialPlayer>): number {
  return Object.values(roster).filter(p => p.status === 'ALIVE').length;
}

function computeTotalDays(alive: number, rules: PeckingOrderRuleset['dayCount']): number {
  let total: number;
  if (rules.mode === 'FIXED') {
    total = rules.fixedCount ?? alive - 1;
  } else {
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
  // FINALS when exactly 2 players remain — based on actual alive count,
  // not dayIndex vs totalDays (totalDays recalculates each morning as
  // players are eliminated, causing premature FINALS).
  if (alivePlayers <= 2) return 'FINALS';

  // Whitelist mode (dynamic): pick from allowed pool
  if (rules.allowed && rules.allowed.length > 0) {
    let pool = rules.allowed.filter(v => v !== 'FINALS');
    if (rules.constraints) {
      pool = pool.filter(v => {
        const c = rules.constraints!.find(c => c.voteType === v);
        return !c || alivePlayers >= c.minPlayers;
      });
    }
    if (pool.length === 0) return 'MAJORITY';
    return pool[(dayIndex - 1) % pool.length];
  }

  // Legacy strategy mode (static) — unchanged
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    const candidate = rules.sequence[idx];
    if (rules.constraints) {
      const constraint = rules.constraints.find(c => c.voteType === candidate);
      if (constraint && alivePlayers < constraint.minPlayers) {
        return 'MAJORITY';
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
  // Whitelist mode (dynamic)
  if (rules.allowed) {
    if (rules.allowed.length === 0) return 'NONE';
    let pool = rules.allowed.filter(g => g !== 'NONE');
    if (pool.length === 0) return 'NONE';
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastGame = gameHistory[gameHistory.length - 1];
      const filtered = pool.filter(g => g !== lastGame?.gameType);
      if (filtered.length > 0) pool = filtered;
    }
    return pool[(dayIndex - 1) % pool.length];
  }

  // Legacy strategy mode (static) — unchanged
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

function resolveActivityType(
  dayIndex: number,
  rules: PeckingOrderRuleset['activities'],
  gameHistory: GameHistoryEntry[],
): PromptType | 'NONE' {
  // Whitelist mode (dynamic)
  if (rules.allowed) {
    if (rules.allowed.length === 0) return 'NONE';
    let pool = [...rules.allowed];
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastEntry = gameHistory[gameHistory.length - 1];
      if ((lastEntry as any)?.activityType) {
        const filtered = pool.filter(a => a !== (lastEntry as any).activityType);
        if (filtered.length > 0) pool = filtered;
      }
    }
    return pool[(dayIndex - 1) % pool.length];
  }

  // Legacy strategy mode
  if (rules.mode === 'NONE') return 'NONE';
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    return rules.sequence[idx];
  }
  if (rules.mode === 'POOL' && rules.pool) {
    return rules.pool[(dayIndex - 1) % rules.pool.length];
  }
  return 'NONE';
}

function resolveDilemmaType(
  dayIndex: number,
  rules: PeckingOrderRuleset['dilemmas'] | undefined,
  gameHistory: GameHistoryEntry[],
): DilemmaType | 'NONE' {
  if (!rules || rules.mode === 'NONE') return 'NONE';

  // Whitelist mode (dynamic)
  if (rules.allowed) {
    if (rules.allowed.length === 0) return 'NONE';
    let pool = [...rules.allowed];
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastEntry = gameHistory[gameHistory.length - 1];
      if ((lastEntry as any)?.dilemmaType) {
        const filtered = pool.filter(d => d !== (lastEntry as any).dilemmaType);
        if (filtered.length > 0) pool = filtered;
      }
    }
    return pool[(dayIndex - 1) % pool.length];
  }

  // Legacy strategy mode
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    return rules.sequence[idx];
  }
  if (rules.mode === 'POOL' && rules.pool) {
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastEntry = gameHistory[gameHistory.length - 1];
      if ((lastEntry as any)?.dilemmaType) {
        const filtered = rules.pool.filter(d => d !== (lastEntry as any).dilemmaType);
        if (filtered.length > 0) {
          return filtered[(dayIndex - 1) % filtered.length];
        }
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
    return rule.base;
  }
  return rule.base;
}

function resolveSocialParams(
  dayIndex: number,
  totalDays: number,
  alivePlayers: number,
  rules: PeckingOrderRuleset['social'],
): { dmCharsPerPlayer: number; dmPartnersPerPlayer: number; requireDmInvite: boolean; dmSlotsPerPlayer: number } {
  let dmChars = scaleValue(dayIndex, totalDays, rules.dmChars);
  // PER_ACTIVE_PLAYER: base is per-player, multiply by alive count
  if (rules.dmChars.mode === 'PER_ACTIVE_PLAYER') {
    dmChars = dmChars * alivePlayers;
  }
  return {
    dmCharsPerPlayer: dmChars,
    dmPartnersPerPlayer: scaleValue(dayIndex, totalDays, rules.dmPartners),
    requireDmInvite: rules.requireDmInvite ?? false,
    dmSlotsPerPlayer: rules.dmSlotsPerPlayer ?? 5,
  };
}

// ── Day resolution helper ───────────────────────────────────────────────

function resolveDay(
  dayIndex: number,
  roster: Record<string, SocialPlayer>,
  ruleset: PeckingOrderRuleset,
  gameHistory: GameHistoryEntry[],
  schedulePreset: SchedulePreset,
  startTime: string,
  hotTakeHistory: string[],
): { resolvedDay: DailyManifest; totalDays: number; reasoning: string; hotTakeHistory: string[] } {
  const alive = countAlivePlayers(roster);
  const totalDays = computeTotalDays(alive, ruleset.dayCount);
  const voteType = resolveVoteType(dayIndex, totalDays, ruleset.voting, alive);
  const gameType = resolveGameType(dayIndex, ruleset.games, gameHistory);
  const activityType = resolveActivityType(dayIndex, ruleset.activities, gameHistory);
  const dilemmaType = resolveDilemmaType(dayIndex, ruleset.dilemmas, gameHistory);
  const social = resolveSocialParams(dayIndex, totalDays, alive, ruleset.social);

  // Anchor timeline to the current moment, not the fixed startTime calendar.
  // Dynamic games resolve days at runtime — events should play out from "now,"
  // not from startTime + (dayIndex-1) * 24h. dayIndex=1 because "now" IS this day's start.
  const effectiveStart = new Date().toISOString();
  const timeline = generateDayTimeline(schedulePreset, 1, effectiveStart, {
    gameType,
    activityType,
    dilemmaType,
  });

  // Attach activity payload to START_ACTIVITY event (same data the lobby sets for static games).
  // Without this, spawnPromptCartridge falls back to generic DEFAULT_PROMPT_TEXT.
  const nextHotTakeHistory = [...hotTakeHistory];
  if (activityType !== 'NONE') {
    const actInfo = ACTIVITY_TYPE_INFO[activityType as PromptType];
    const startActivity = timeline.find(e => e.action === 'START_ACTIVITY');
    if (startActivity && actInfo) {
      if (activityType === 'HOT_TAKE') {
        const q = pickHotTakeQuestion(nextHotTakeHistory);
        nextHotTakeHistory.push(q.id);
        startActivity.payload = {
          promptType: 'HOT_TAKE',
          promptText: q.statement,
          promptId: q.id,
          options: q.options,
        };
      } else {
        startActivity.payload = {
          promptType: activityType,
          promptText: actInfo.promptText,
          ...(actInfo.options || {}),
        };
      }
    }
  }

  // Prepend GM briefing message as INJECT_PROMPT before the first timeline event.
  // Static games get this from the lobby's buildManifestDays; dynamic games need
  // the Game Master to generate it since days are resolved at runtime.
  const voteInfo = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
  const briefingMsg = `Welcome to Day ${dayIndex} of Pecking Order! Tonight's vote: ${voteInfo?.name || voteType}. ${voteInfo?.howItWorks || ''}`;
  if (timeline.length > 0) {
    // Insert INJECT_PROMPT 1 second before the first event (OPEN_GROUP_CHAT)
    const firstEventTime = new Date(timeline[0].time).getTime();
    timeline.unshift({
      action: 'INJECT_PROMPT',
      time: new Date(firstEventTime - 1000).toISOString(),
      payload: { msg: briefingMsg },
    });
  }

  const isLastDay = alive <= 2;
  const nextDayStart = isLastDay
    ? undefined
    : computeNextDayStart(schedulePreset, 1, effectiveStart);

  return {
    resolvedDay: {
      dayIndex,
      theme: `Day ${dayIndex}`,
      voteType,
      gameType,
      ...(activityType !== 'NONE' ? { activityType } : {}),
      ...(dilemmaType !== 'NONE' ? { dilemmaType } : {}),
      timeline,
      ...(nextDayStart ? { nextDayStart } : {}),
      ...social,
    },
    totalDays,
    reasoning: `Day ${dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${activityType} activity, ${dilemmaType} dilemma, ${social.dmCharsPerPlayer} DM chars, ${timeline.length} timeline events`,
    hotTakeHistory: nextHotTakeHistory,
  };
}

// ── Exported context builder ────────────────────────────────────────────

const inactivityModule = createInactivityModule();

/** Build initial Game Master context. Exported for unit testing. */
export function buildGameMasterContext(input: GameMasterInput): GameMasterContext {
  return {
    roster: input.roster,
    ruleset: input.ruleset,
    schedulePreset: input.schedulePreset,
    startTime: input.startTime,
    gameHistory: input.gameHistory,
    dayIndex: 0,
    totalDays: 0,
    resolvedDay: null,
    reasoning: '',
    inactivityState: inactivityModule.init(input.roster, input.ruleset),
    gameMasterActions: [],
    hotTakeHistory: [],
  };
}

// ── XState machine ──────────────────────────────────────────────────────

export function createGameMasterMachine() {
  return setup({
    types: {
      input: {} as GameMasterInput,
      context: {} as GameMasterContext,
      events: {} as
        | { type: 'GAME_MASTER.RESOLVE_DAY'; dayIndex: number; roster: Record<string, SocialPlayer> }
        | { type: 'GAME_MASTER.DAY_ENDED'; dayIndex: number; roster: Record<string, SocialPlayer> }
        | { type: 'GAME_MASTER.GAME_ENDED' }
        | { type: 'FACT.RECORD'; fact: { type: string; actorId: string; targetId?: string; payload?: any; timestamp: number } }
        | { type: 'ADMIN.OVERRIDE_NEXT_DAY'; day: Partial<DailyManifest> },
    },
  }).createMachine({
    id: 'game-master',
    initial: 'pregame',
    context: ({ input }) => buildGameMasterContext(input),
    states: {
      pregame: {
        on: {
          'GAME_MASTER.RESOLVE_DAY': {
            target: 'tournament',
            actions: assign(({ context, event }) => {
              const { resolvedDay, totalDays, reasoning, hotTakeHistory } = resolveDay(
                event.dayIndex, event.roster, context.ruleset, context.gameHistory,
                context.schedulePreset, context.startTime, context.hotTakeHistory,
              );
              const { state: inactivityState, actions } = inactivityModule.onResolveDay(
                context.inactivityState, event.dayIndex, event.roster, context.ruleset,
              );
              return {
                dayIndex: event.dayIndex,
                roster: event.roster,
                totalDays,
                resolvedDay,
                reasoning,
                inactivityState,
                gameMasterActions: actions,
                hotTakeHistory,
              };
            }),
          },
        },
      },
      tournament: {
        on: {
          'GAME_MASTER.RESOLVE_DAY': {
            actions: assign(({ context, event }) => {
              const { resolvedDay, totalDays, reasoning, hotTakeHistory } = resolveDay(
                event.dayIndex, event.roster, context.ruleset, context.gameHistory,
                context.schedulePreset, context.startTime, context.hotTakeHistory,
              );
              const { state: inactivityState, actions } = inactivityModule.onResolveDay(
                context.inactivityState, event.dayIndex, event.roster, context.ruleset,
              );
              return {
                dayIndex: event.dayIndex,
                roster: event.roster,
                totalDays,
                resolvedDay,
                reasoning,
                inactivityState,
                hotTakeHistory,
                gameMasterActions: actions,
              };
            }),
          },
          'GAME_MASTER.DAY_ENDED': {
            actions: assign(({ context, event }) => ({
              inactivityState: inactivityModule.onDayEnded(
                context.inactivityState, event.dayIndex, event.roster,
              ),
              gameMasterActions: [],
            })),
          },
          'GAME_MASTER.GAME_ENDED': {
            target: 'postgame',
          },
          'FACT.RECORD': {
            actions: assign(({ context, event }) => ({
              inactivityState: inactivityModule.onFact(context.inactivityState, event.fact),
            })),
          },
          'ADMIN.OVERRIDE_NEXT_DAY': {
            actions: assign(({ context, event }) => ({
              resolvedDay: context.resolvedDay
                ? { ...context.resolvedDay, ...event.day }
                : null,
              reasoning: `${context.reasoning} [ADMIN OVERRIDE]`,
            })),
          },
        },
      },
      postgame: {
        type: 'final',
      },
    },
  });
}
