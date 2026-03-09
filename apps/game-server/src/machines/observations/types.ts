import type { SocialPlayer, GameMasterAction, PeckingOrderRuleset } from '@pecking-order/shared-types';

/**
 * Contract for Game Master observation modules.
 * Each module is a set of pure functions — no XState dependency.
 * The Game Master machine holds module states on context and delegates to these.
 */
export interface ObservationModule<TState> {
  /** Initialize module state from roster + ruleset. */
  init(roster: Record<string, SocialPlayer>, ruleset: PeckingOrderRuleset): TState;

  /** Called at the start of each day. May produce actions (e.g. ELIMINATE). */
  onResolveDay(
    state: TState,
    dayIndex: number,
    roster: Record<string, SocialPlayer>,
    ruleset: PeckingOrderRuleset,
  ): { state: TState; actions: GameMasterAction[] };

  /** Called for each FACT.RECORD event during the day. */
  onFact(
    state: TState,
    fact: { type: string; actorId: string; targetId?: string; payload?: any; timestamp: number },
  ): TState;

  /** Called when the day ends. Settle day-level bookkeeping. */
  onDayEnded(
    state: TState,
    dayIndex: number,
    roster: Record<string, SocialPlayer>,
  ): TState;
}
