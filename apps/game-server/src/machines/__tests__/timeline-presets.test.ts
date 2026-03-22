import { describe, it, expect } from 'vitest';
import { generateDayTimeline, computeNextDayStart } from '../timeline-presets';

describe('generateDayTimeline', () => {
  describe('SPEED_RUN preset', () => {
    const startTime = '2026-03-10T14:00:00.000Z';

    it('generates all core events for Day 1 (with game + activity)', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).toEqual([
        'OPEN_GROUP_CHAT', 'OPEN_DMS', 'CLOSE_GROUP_CHAT',
        'START_GAME', 'END_GAME',
        'START_ACTIVITY', 'END_ACTIVITY',
        'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'END_DAY',
      ]);
    });

    it('uses minute offsets from startTime for Day 1', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const base = new Date(startTime).getTime();
      // First event at +0min, last (END_DAY) at +23min
      expect(new Date(events[0].time).getTime()).toBe(base);
      expect(new Date(events[events.length - 1].time).getTime()).toBe(base + 23 * 60_000);
    });

    it('offsets Day 2 by dayDuration + interDayGap (26min)', () => {
      const events = generateDayTimeline('SPEED_RUN', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'NONE',
        dilemmaType: 'NONE',
      });
      const base = new Date(startTime).getTime();
      const day2Base = base + (23 + 3) * 60_000; // 26min offset
      expect(new Date(events[0].time).getTime()).toBe(day2Base);
    });

    it('omits START_GAME/END_GAME when gameType is NONE', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'NONE',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_GAME');
      expect(actions).not.toContain('END_GAME');
    });

    it('omits START_ACTIVITY/END_ACTIVITY when activityType is NONE', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'NONE',
        dilemmaType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_ACTIVITY');
      expect(actions).not.toContain('END_ACTIVITY');
    });
  });

  describe('DEFAULT preset', () => {
    const startTime = '2026-03-10T00:00:00.000Z';

    it('uses clock times on the start date for Day 1', () => {
      const events = generateDayTimeline('DEFAULT', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      // First event: OPEN_GROUP_CHAT at 09:00 on March 10
      expect(events[0].action).toBe('OPEN_GROUP_CHAT');
      expect(events[0].time).toBe('2026-03-10T09:00:00.000Z');
      // Last event: END_DAY at 23:59
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T23:59:00.000Z');
    });

    it('advances to next calendar day for Day 2', () => {
      const events = generateDayTimeline('DEFAULT', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(events[0].time).toBe('2026-03-11T09:00:00.000Z');
    });
  });

  describe('COMPACT preset', () => {
    const startTime = '2026-03-10T00:00:00.000Z';

    it('uses compressed clock times', () => {
      const events = generateDayTimeline('COMPACT', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(events[0].time).toBe('2026-03-10T09:00:00.000Z');
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T17:30:00.000Z');
    });
  });
});

describe('computeNextDayStart', () => {
  it('returns next calendar day at first event time for DEFAULT', () => {
    const next = computeNextDayStart('DEFAULT', 1, '2026-03-10T00:00:00.000Z');
    expect(next).toBe('2026-03-11T09:00:00.000Z');
  });

  it('returns offset-based start for SPEED_RUN', () => {
    const startTime = '2026-03-10T14:00:00.000Z';
    const next = computeNextDayStart('SPEED_RUN', 1, startTime);
    // Day 1 ends at +23min, gap 3min, so Day 2 starts at +26min
    const expected = new Date(new Date(startTime).getTime() + 26 * 60_000).toISOString();
    expect(next).toBe(expected);
  });
});
