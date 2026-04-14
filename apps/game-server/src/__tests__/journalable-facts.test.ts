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
});
