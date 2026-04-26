import { describe, it, expect } from 'vitest';
import { shouldFireInProgress } from '../subscription';

// Regression coverage for the staging defect where PR #130 fired the
// IN_PROGRESS → lobby STARTED callback at /init time. CC games auto-init at
// game-CREATE time (before any invitee has clicked their email link), so
// the lobby flipped to STARTED prematurely and getInviteInfo() rejected
// every subsequent invitee with "this game is no longer accepting players".
//
// The fixed gate lives in subscription.ts and fires only once L2 has left
// preGame — the same threshold handlePlayerJoined uses to 409 late joiners.
describe('shouldFireInProgress (PR #130 regression gate)', () => {
  describe('does NOT fire while L2 is in pre-game states', () => {
    it('returns false for snapshot.value === "preGame"', () => {
      expect(shouldFireInProgress('preGame', 'game-1', false)).toBe(false);
    });

    it('returns false for snapshot.value === "uninitialized"', () => {
      expect(shouldFireInProgress('uninitialized', 'game-1', false)).toBe(false);
    });
  });

  describe('fires once L2 has left preGame', () => {
    it('returns true on the dayLoop compound state object', () => {
      // dayLoop is a compound state, so snapshot.value is `{ dayLoop: ... }`
      // (object). The gate must accept this without enumerating substates.
      expect(shouldFireInProgress({ dayLoop: 'morningBriefing' }, 'game-1', false)).toBe(true);
      expect(
        shouldFireInProgress(
          { dayLoop: { activeSession: 'waitingForChild' } },
          'game-1',
          false,
        ),
      ).toBe(true);
      expect(shouldFireInProgress({ dayLoop: 'nightSummary' }, 'game-1', false)).toBe(true);
    });

    it('returns true for terminal post-game states', () => {
      // If a game somehow reached gameSummary/gameOver without ever flipping
      // STARTED (e.g. snapshot recovery edge case), we still want STARTED to
      // fire — the lobby route's monotonic DAG keeps COMPLETED ahead anyway.
      expect(shouldFireInProgress('gameSummary', 'game-1', false)).toBe(true);
      expect(shouldFireInProgress('gameOver', 'game-1', false)).toBe(true);
    });
  });

  describe('idempotency', () => {
    it('returns false once alreadyNotified is true (post-restart)', () => {
      // After the persisted flag is read on onStart, subscription must not
      // re-fire the callback for any subsequent tick — including the first
      // synchronous restore fire.
      expect(shouldFireInProgress({ dayLoop: 'morningBriefing' }, 'game-1', true)).toBe(false);
      expect(shouldFireInProgress('gameSummary', 'game-1', true)).toBe(false);
    });
  });

  describe('gameId guards', () => {
    it('returns false when gameId is empty', () => {
      expect(shouldFireInProgress({ dayLoop: 'morningBriefing' }, '', false)).toBe(false);
    });

    it('returns false when gameId is undefined', () => {
      expect(
        shouldFireInProgress({ dayLoop: 'morningBriefing' }, undefined, false),
      ).toBe(false);
    });

    it('returns false when gameId is not a string', () => {
      expect(
        shouldFireInProgress({ dayLoop: 'morningBriefing' }, 42 as unknown, false),
      ).toBe(false);
    });
  });
});
