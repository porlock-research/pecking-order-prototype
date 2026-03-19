import type { SchedulePreset, TimelineEvent } from '@pecking-order/shared-types';

type TimelineAction = TimelineEvent['action'];

interface DayOptions {
  gameType: string;
  activityType: string;
}

// ── Preset definitions ──────────────────────────────────────────────────

interface CalendarEventDef {
  action: TimelineAction;
  clockTime: string;  // "HH:MM"
  condition?: 'hasGame' | 'hasActivity';
}

interface OffsetEventDef {
  action: TimelineAction;
  offsetMin: number;
  condition?: 'hasGame' | 'hasActivity';
}

interface CalendarPresetConfig {
  type: 'calendar';
  firstEventTime: string;  // "HH:MM" — used for next-day-start scheduling
  events: CalendarEventDef[];
}

interface OffsetPresetConfig {
  type: 'offset';
  dayDurationMin: number;
  interDayGapMin: number;
  events: OffsetEventDef[];
}

type PresetConfig = CalendarPresetConfig | OffsetPresetConfig;

const PRESET_CONFIGS: Record<SchedulePreset, PresetConfig> = {
  DEFAULT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'OPEN_DMS', clockTime: '10:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:00' },
      { action: 'START_GAME', clockTime: '10:00', condition: 'hasGame' },
      { action: 'END_GAME', clockTime: '12:00', condition: 'hasGame' },
      { action: 'START_ACTIVITY', clockTime: '14:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', clockTime: '16:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', clockTime: '20:00' },
      { action: 'CLOSE_VOTING', clockTime: '23:00' },
      { action: 'CLOSE_DMS', clockTime: '23:00' },
      { action: 'END_DAY', clockTime: '23:59' },
    ],
  },
  COMPACT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'OPEN_DMS', clockTime: '09:30' },
      { action: 'START_GAME', clockTime: '09:30', condition: 'hasGame' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:30' },
      { action: 'END_GAME', clockTime: '11:30', condition: 'hasGame' },
      { action: 'START_ACTIVITY', clockTime: '12:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', clockTime: '13:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', clockTime: '14:00' },
      { action: 'CLOSE_VOTING', clockTime: '17:00' },
      { action: 'CLOSE_DMS', clockTime: '17:00' },
      { action: 'END_DAY', clockTime: '17:30' },
    ],
  },
  SPEED_RUN: {
    type: 'offset',
    dayDurationMin: 23,
    interDayGapMin: 3,
    events: [
      { action: 'OPEN_GROUP_CHAT', offsetMin: 0 },
      { action: 'OPEN_DMS', offsetMin: 2 },
      { action: 'CLOSE_GROUP_CHAT', offsetMin: 2 },
      { action: 'START_GAME', offsetMin: 3, condition: 'hasGame' },
      { action: 'END_GAME', offsetMin: 8, condition: 'hasGame' },
      { action: 'START_ACTIVITY', offsetMin: 10, condition: 'hasActivity' },
      { action: 'END_ACTIVITY', offsetMin: 15, condition: 'hasActivity' },
      { action: 'OPEN_VOTING', offsetMin: 17 },
      { action: 'CLOSE_VOTING', offsetMin: 20 },
      { action: 'CLOSE_DMS', offsetMin: 20 },
      { action: 'END_DAY', offsetMin: 23 },
    ],
  },
  PLAYTEST: {
    type: 'calendar',
    firstEventTime: '10:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '10:00' },
      { action: 'OPEN_DMS', clockTime: '11:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '12:00' },
      { action: 'START_GAME', clockTime: '12:00', condition: 'hasGame' },
      { action: 'START_ACTIVITY', clockTime: '12:00', condition: 'hasActivity' },
      { action: 'END_GAME', clockTime: '14:00', condition: 'hasGame' },
      { action: 'END_ACTIVITY', clockTime: '15:00', condition: 'hasActivity' },
      { action: 'OPEN_GROUP_CHAT', clockTime: '15:00' },
      { action: 'OPEN_VOTING', clockTime: '15:00' },
      { action: 'CLOSE_DMS', clockTime: '16:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '16:00' },
      { action: 'CLOSE_VOTING', clockTime: '17:00' },
      { action: 'END_DAY', clockTime: '17:00' },
    ],
  },
  SMOKE_TEST: {
    type: 'offset',
    dayDurationMin: 5,
    interDayGapMin: 1,
    events: [
      { action: 'OPEN_GROUP_CHAT', offsetMin: 0 },
      { action: 'OPEN_DMS', offsetMin: 0.5 },
      { action: 'CLOSE_GROUP_CHAT', offsetMin: 0.5 },
      { action: 'START_GAME', offsetMin: 1, condition: 'hasGame' },
      { action: 'END_GAME', offsetMin: 2, condition: 'hasGame' },
      { action: 'START_ACTIVITY', offsetMin: 2.5, condition: 'hasActivity' },
      { action: 'END_ACTIVITY', offsetMin: 3.5, condition: 'hasActivity' },
      { action: 'OPEN_VOTING', offsetMin: 3.5 },
      { action: 'CLOSE_VOTING', offsetMin: 4.5 },
      { action: 'CLOSE_DMS', offsetMin: 4.5 },
      { action: 'END_DAY', offsetMin: 5 },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function meetsCondition(condition: string | undefined, opts: DayOptions): boolean {
  if (!condition) return true;
  if (condition === 'hasGame') return opts.gameType !== 'NONE';
  if (condition === 'hasActivity') return opts.activityType !== 'NONE';
  return true;
}

function computeCalendarDayBase(startTime: string, dayIndex: number): string {
  // Extract date from startTime, add (dayIndex - 1) calendar days
  const base = new Date(startTime);
  base.setUTCDate(base.getUTCDate() + (dayIndex - 1));
  return base.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function computeOffsetDayBase(startTime: string, dayIndex: number, config: OffsetPresetConfig): number {
  const base = new Date(startTime).getTime();
  return base + (dayIndex - 1) * (config.dayDurationMin + config.interDayGapMin) * 60_000;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generate concrete timeline events (with ISO timestamps) for a given day.
 *
 * - Calendar presets (DEFAULT, COMPACT): `startTime` determines the date.
 *   Day 1 uses that date, Day 2 uses date+1, etc.
 *   Events use fixed UTC clock times on each date.
 * - Offset preset (SPEED_RUN): `startTime` is the exact start moment.
 *   Events use minute offsets. Day N base = startTime + (N-1) * (dayDuration + gap).
 * - Conditional events: game events only if gameType !== 'NONE',
 *   activity events only if activityType !== 'NONE'.
 */
export function generateDayTimeline(
  preset: SchedulePreset,
  dayIndex: number,
  startTime: string,
  opts: DayOptions,
): TimelineEvent[] {
  const config = PRESET_CONFIGS[preset];

  if (config.type === 'calendar') {
    const dateStr = computeCalendarDayBase(startTime, dayIndex);
    return config.events
      .filter(e => meetsCondition(e.condition, opts))
      .map(e => ({
        action: e.action,
        time: new Date(`${dateStr}T${e.clockTime}:00.000Z`).toISOString(),
      }));
  }

  // Offset-based (SPEED_RUN)
  const dayBase = computeOffsetDayBase(startTime, dayIndex, config);
  return config.events
    .filter(e => meetsCondition(e.condition, opts))
    .map(e => ({
      action: e.action,
      time: new Date(dayBase + e.offsetMin * 60_000).toISOString(),
    }));
}

/**
 * Compute when the next day starts.
 *
 * - Calendar presets: returns next calendar day at firstEventTime.
 * - Offset preset: returns base + dayDuration + gap.
 */
export function computeNextDayStart(
  preset: SchedulePreset,
  dayIndex: number,
  startTime: string,
): string {
  const config = PRESET_CONFIGS[preset];

  if (config.type === 'calendar') {
    const nextDateStr = computeCalendarDayBase(startTime, dayIndex + 1);
    return new Date(`${nextDateStr}T${config.firstEventTime}:00.000Z`).toISOString();
  }

  // Offset-based
  const nextBase = computeOffsetDayBase(startTime, dayIndex + 1, config);
  return new Date(nextBase).toISOString();
}
