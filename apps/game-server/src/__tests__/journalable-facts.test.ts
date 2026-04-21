import { describe, it, expect } from 'vitest';
import { FactTypes } from '@pecking-order/shared-types';
import { isJournalable } from '../d1-persistence';

describe('isJournalable', () => {
  // Per machine-actions.ts persistFactToD1: isJournalable is the upstream gate for
  // factToTicker AND handleFactPush as well as D1 writes. Any fact type that
  // needs to surface a ticker message or trigger a push MUST be journalable.
  it.each([
    FactTypes.SILVER_TRANSFER,
    FactTypes.VOTE_CAST,
    FactTypes.ELIMINATION,
    FactTypes.DM_SENT,
    FactTypes.DM_INVITE_SENT,     // regression: SOCIAL_INVITE ticker + DM invite push
    FactTypes.WINNER_DECLARED,
    FactTypes.CHAT_MSG,
    FactTypes.GAME_RESULT,
    FactTypes.PROMPT_RESULT,
    FactTypes.DILEMMA_RESULT,
    FactTypes.POWER_USED,
    FactTypes.PERK_USED,
    FactTypes.PLAYER_GAME_RESULT,
  ])('%s is journalable', (factType) => {
    expect(isJournalable(factType)).toBe(true);
  });

  it('rejects an unknown fact type', () => {
    expect(isJournalable('COMPLETELY.MADE.UP.TYPE')).toBe(false);
  });

  // Confessions feature — Plan 1, T2
  it.each([
    FactTypes.CONFESSION_POSTED,
    FactTypes.CONFESSION_PHASE_STARTED,
    FactTypes.CONFESSION_PHASE_ENDED,
  ])('%s is journalable', (factType) => {
    expect(isJournalable(factType)).toBe(true);
  });

  // Pregame engagement (l3-pregame). Journal-only — no ticker, no push.
  // The journal in D1 is the only persistent record; SYNC slice carries
  // live state during pregame and disappears at Day 1.
  it.each([
    FactTypes.PREGAME_PLAYER_JOINED,
    FactTypes.PREGAME_REVEAL_ANSWER,
  ])('%s is journalable', (factType) => {
    expect(isJournalable(factType)).toBe(true);
  });
});

// PREGAME facts must NOT emit a ticker message or a push notification.
// They are journal-only by design — pregame engagement is ephemeral and
// doesn't carry into Day 1. If a default ticker/push handler is ever added
// that would catch these, it should explicitly skip PREGAME_* fact types.
import { factToTicker } from '../ticker';
import { handleFactPush } from '../push-triggers';

describe('PREGAME facts produce no side-effects beyond D1 journal', () => {
  const stubRoster = { p1: { personaName: 'P1' }, p2: { personaName: 'P2' } } as any;

  it.each([FactTypes.PREGAME_PLAYER_JOINED, FactTypes.PREGAME_REVEAL_ANSWER])(
    '%s does not produce a ticker message',
    (factType) => {
      const fact = { type: factType, actorId: 'p1', timestamp: Date.now(), payload: {} };
      expect(factToTicker(fact, stubRoster)).toBeNull();
    },
  );

  it.each([FactTypes.PREGAME_PLAYER_JOINED, FactTypes.PREGAME_REVEAL_ANSWER])(
    '%s does not trigger a push notification',
    (factType) => {
      const fact = { type: factType, actorId: 'p1', timestamp: Date.now(), payload: {} };
      // Minimal stub PushContext — handleFactPush should bail before touching anything.
      const ctx = { roster: stubRoster, db: null, getConnections: () => [] } as any;
      const result = handleFactPush(ctx, fact, null);
      expect(result).toBeUndefined();
    },
  );
});
