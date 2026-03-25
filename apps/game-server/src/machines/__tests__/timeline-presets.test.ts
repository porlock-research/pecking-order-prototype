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
    // startTime at 09:00 UTC = firstEventTime for DEFAULT
    const startTime = '2026-03-10T09:00:00.000Z';

    it('anchors events relative to startTime for Day 1', () => {
      const events = generateDayTimeline('DEFAULT', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      // First event: OPEN_GROUP_CHAT at startTime + 0 offset
      expect(events[0].action).toBe('OPEN_GROUP_CHAT');
      expect(events[0].time).toBe('2026-03-10T09:00:00.000Z');
      // Last event: END_DAY at startTime + (23:59 - 09:00) = +14h59m
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T23:59:00.000Z');
    });

    it('advances to next day (24h later) for Day 2', () => {
      const events = generateDayTimeline('DEFAULT', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(events[0].time).toBe('2026-03-11T09:00:00.000Z');
    });
  });

  describe('COMPACT preset', () => {
    const startTime = '2026-03-10T09:00:00.000Z';

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

  describe('PLAYTEST preset', () => {
    // startTime at 10:00 UTC = firstEventTime for PLAYTEST
    const startTime = '2026-03-10T10:00:00.000Z';

    it('generates events anchored to startTime', () => {
      const events = generateDayTimeline('PLAYTEST', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(events[0].action).toBe('OPEN_GROUP_CHAT');
      expect(events[0].time).toBe('2026-03-10T10:00:00.000Z');
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T17:00:00.000Z');
    });

    it('advances to next day (24h later) for Day 2', () => {
      const events = generateDayTimeline('PLAYTEST', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(events[0].time).toBe('2026-03-11T10:00:00.000Z');
    });

    it('has two OPEN_GROUP_CHAT events (re-opens at +5h01m)', () => {
      const events = generateDayTimeline('PLAYTEST', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const opens = events.filter(e => e.action === 'OPEN_GROUP_CHAT');
      expect(opens).toHaveLength(2);
      expect(opens[0].time).toBe('2026-03-10T10:00:00.000Z');
      expect(opens[1].time).toBe('2026-03-10T15:01:00.000Z');
    });

    it('omits game/activity events when types are NONE', () => {
      const events = generateDayTimeline('PLAYTEST', 1, startTime, {
        gameType: 'NONE',
        activityType: 'NONE',
        dilemmaType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_GAME');
      expect(actions).not.toContain('END_GAME');
      expect(actions).not.toContain('START_ACTIVITY');
      expect(actions).not.toContain('END_ACTIVITY');
      expect(actions).not.toContain('START_DILEMMA');
      expect(actions).not.toContain('END_DILEMMA');
    });
  });

  describe('SMOKE_TEST preset', () => {
    const startTime = '2026-03-10T14:00:00.000Z';

    it('generates offset-based events with 5min day duration', () => {
      const events = generateDayTimeline('SMOKE_TEST', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const base = new Date(startTime).getTime();
      expect(new Date(events[0].time).getTime()).toBe(base);
      expect(new Date(events[events.length - 1].time).getTime()).toBe(base + 5 * 60_000);
    });

    it('offsets Day 2 by dayDuration + interDayGap (6min)', () => {
      const events = generateDayTimeline('SMOKE_TEST', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'NONE',
        dilemmaType: 'NONE',
      });
      const base = new Date(startTime).getTime();
      const day2Base = base + (5 + 1) * 60_000;
      expect(new Date(events[0].time).getTime()).toBe(day2Base);
    });

    it('uses same canonical event sequence as SPEED_RUN', () => {
      const smokeEvents = generateDayTimeline('SMOKE_TEST', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const speedEvents = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      expect(smokeEvents.map(e => e.action)).toEqual(speedEvents.map(e => e.action));
    });
  });

  describe('dilemma conditional events', () => {
    it('includes START_DILEMMA/END_DILEMMA when dilemmaType is not NONE (SPEED_RUN)', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, '2026-03-10T14:00:00.000Z', {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'SILVER_GAMBIT',
      });
      const actions = events.map(e => e.action);
      expect(actions).toContain('START_DILEMMA');
      expect(actions).toContain('END_DILEMMA');
    });

    it('omits START_DILEMMA/END_DILEMMA when dilemmaType is NONE (SPEED_RUN)', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, '2026-03-10T14:00:00.000Z', {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_DILEMMA');
      expect(actions).not.toContain('END_DILEMMA');
    });

    it('includes START_DILEMMA/END_DILEMMA when dilemmaType is not NONE (PLAYTEST)', () => {
      const events = generateDayTimeline('PLAYTEST', 1, '2026-03-10T10:00:00.000Z', {
        gameType: 'NONE',
        activityType: 'NONE',
        dilemmaType: 'SILVER_GAMBIT',
      });
      const actions = events.map(e => e.action);
      expect(actions).toContain('START_DILEMMA');
      expect(actions).toContain('END_DILEMMA');
      const start = events.find(e => e.action === 'START_DILEMMA');
      const end = events.find(e => e.action === 'END_DILEMMA');
      expect(start?.time).toBe('2026-03-10T10:01:00.000Z');
      expect(end?.time).toBe('2026-03-10T14:59:00.000Z');
    });
  });

  describe('timezone regression (non-midnight startTime)', () => {
    // Simulates PDT user: browser converts "10:00 AM local" to 17:00 UTC
    const pdtStartTime = '2026-03-25T17:00:00.000Z';

    it('PLAYTEST: anchors Day 1 events to startTime, not midnight UTC', () => {
      const events = generateDayTimeline('PLAYTEST', 1, pdtStartTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'SILVER_GAMBIT',
      });
      // First event at startTime (17:00 UTC = 10:00 AM PDT)
      expect(events[0].action).toBe('OPEN_GROUP_CHAT');
      expect(events[0].time).toBe('2026-03-25T17:00:00.000Z');
      // START_GAME at +121min from firstEventTime (12:01 - 10:00 = 2h01m)
      const startGame = events.find(e => e.action === 'START_GAME');
      expect(startGame?.time).toBe('2026-03-25T19:01:00.000Z'); // 12:01 PM PDT
      // END_DAY at +420min (17:00 - 10:00 = 7h)
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-26T00:00:00.000Z'); // 5:00 PM PDT
    });

    it('PLAYTEST: Day 2 starts exactly 24h after Day 1', () => {
      const day2Events = generateDayTimeline('PLAYTEST', 2, pdtStartTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      // Day 2 first event at startTime + 24h
      expect(day2Events[0].time).toBe('2026-03-26T17:00:00.000Z');
    });

    it('DEFAULT: non-UTC startTime produces correct event spacing', () => {
      // User in UTC+5:30 (IST) picks 9:00 AM local → 03:30 UTC
      const istStartTime = '2026-03-10T03:30:00.000Z';
      const events = generateDayTimeline('DEFAULT', 1, istStartTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
        dilemmaType: 'NONE',
      });
      // First event at startTime
      expect(events[0].time).toBe('2026-03-10T03:30:00.000Z');
      // END_DAY at startTime + (23:59 - 09:00) = +14h59m
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T18:29:00.000Z');
    });

    it('event spacing matches clockTime offsets regardless of startTime', () => {
      // Same preset, two different startTimes — event GAPS should be identical
      const utcEvents = generateDayTimeline('PLAYTEST', 1, '2026-03-10T10:00:00.000Z', {
        gameType: 'TRIVIA', activityType: 'PLAYER_PICK', dilemmaType: 'NONE',
      });
      const pdtEvents = generateDayTimeline('PLAYTEST', 1, pdtStartTime, {
        gameType: 'TRIVIA', activityType: 'PLAYER_PICK', dilemmaType: 'NONE',
      });

      // Same number of events
      expect(pdtEvents.length).toBe(utcEvents.length);

      // Same gaps between consecutive events
      for (let i = 1; i < utcEvents.length; i++) {
        const utcGap = new Date(utcEvents[i].time).getTime() - new Date(utcEvents[i - 1].time).getTime();
        const pdtGap = new Date(pdtEvents[i].time).getTime() - new Date(pdtEvents[i - 1].time).getTime();
        expect(pdtGap).toBe(utcGap);
      }
    });
  });
});

describe('computeNextDayStart', () => {
  it('returns startTime + 24h for DEFAULT', () => {
    const next = computeNextDayStart('DEFAULT', 1, '2026-03-10T09:00:00.000Z');
    expect(next).toBe('2026-03-11T09:00:00.000Z');
  });

  it('returns offset-based start for SPEED_RUN', () => {
    const startTime = '2026-03-10T14:00:00.000Z';
    const next = computeNextDayStart('SPEED_RUN', 1, startTime);
    // Day 1 ends at +23min, gap 3min, so Day 2 starts at +26min
    const expected = new Date(new Date(startTime).getTime() + 26 * 60_000).toISOString();
    expect(next).toBe(expected);
  });

  it('returns startTime + 24h for PLAYTEST', () => {
    const next = computeNextDayStart('PLAYTEST', 1, '2026-03-10T10:00:00.000Z');
    expect(next).toBe('2026-03-11T10:00:00.000Z');
  });

  it('returns offset-based start for SMOKE_TEST', () => {
    const startTime = '2026-03-10T14:00:00.000Z';
    const next = computeNextDayStart('SMOKE_TEST', 1, startTime);
    const expected = new Date(new Date(startTime).getTime() + 6 * 60_000).toISOString();
    expect(next).toBe(expected);
  });

  it('preserves timezone offset for non-UTC calendar presets', () => {
    // PDT: 10 AM local = 17:00 UTC
    const next = computeNextDayStart('PLAYTEST', 1, '2026-03-25T17:00:00.000Z');
    expect(next).toBe('2026-03-26T17:00:00.000Z'); // same time next day
  });
});
