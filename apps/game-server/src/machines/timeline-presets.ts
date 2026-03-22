import type { SchedulePreset, TimelineEvent } from '@pecking-order/shared-types';

type TimelineAction = TimelineEvent['action'];

interface DayOptions {
  gameType: string;
  activityType: string;
  dilemmaType: string;
}

// ── Canonical event ordering ────────────────────────────────────────────
// All presets use the same event sequence. Each preset only changes the
// timestamps. This ensures e2e tests (SPEED_RUN, SMOKE_TEST) exercise the
// same timeline structure as production games.
//
// RULE: Events that trigger cartridge completion (CLOSE_VOTING, END_GAME,
// END_ACTIVITY) must NEVER share a timestamp with state-transitioning
// events (END_DAY) or each other. XState v5 queues done.actor delivery,
// so compound events at the same timestamp cause race conditions.

interface OffsetEventDef {
  action: TimelineAction;
  offsetMin: number;
  condition?: 'hasGame' | 'hasActivity' | 'hasDilemma';
}

// Canonical event sequence with minute offsets. Every preset scales these.
const CANONICAL_EVENTS: OffsetEventDef[] = [
  { action: 'OPEN_GROUP_CHAT', offsetMin: 0 },
  { action: 'START_DILEMMA',   offsetMin: 1, condition: 'hasDilemma' },
  { action: 'OPEN_DMS',        offsetMin: 60 },
  { action: 'CLOSE_GROUP_CHAT', offsetMin: 61 },
  { action: 'START_GAME',      offsetMin: 62, condition: 'hasGame' },
  { action: 'END_GAME',        offsetMin: 180, condition: 'hasGame' },
  { action: 'START_ACTIVITY',  offsetMin: 300, condition: 'hasActivity' },
  { action: 'END_ACTIVITY',    offsetMin: 420, condition: 'hasActivity' },
  { action: 'END_DILEMMA',     offsetMin: 600, condition: 'hasDilemma' },
  { action: 'OPEN_VOTING',     offsetMin: 660 },
  { action: 'CLOSE_VOTING',    offsetMin: 840 },
  { action: 'CLOSE_DMS',       offsetMin: 841 },
  { action: 'END_DAY',         offsetMin: 899 },
];

// ── Preset definitions ──────────────────────────────────────────────────

interface CalendarPresetConfig {
  type: 'calendar';
  firstEventTime: string;  // "HH:MM" — used for next-day-start scheduling
  events: { action: TimelineAction; clockTime: string; condition?: 'hasGame' | 'hasActivity' | 'hasDilemma' }[];
}

interface OffsetPresetConfig {
  type: 'offset';
  dayDurationMin: number;
  interDayGapMin: number;
  events: OffsetEventDef[];
}

type PresetConfig = CalendarPresetConfig | OffsetPresetConfig;

/** Scale canonical events to fit a target day duration (in minutes).
 *  Guarantees a minimum gap between consecutive events to prevent
 *  compound timestamp collisions after rounding. */
function scaleCanonical(targetDurationMin: number): OffsetEventDef[] {
  const maxOffset = CANONICAL_EVENTS[CANONICAL_EVENTS.length - 1].offsetMin;
  const scale = targetDurationMin / maxOffset;
  const MIN_GAP = 0.1; // 6 seconds minimum between events
  let lastOffset = -MIN_GAP;
  return CANONICAL_EVENTS.map(e => {
    let scaled = Math.round(e.offsetMin * scale * 10) / 10;
    // Enforce minimum gap — nudge forward if rounding caused a collision
    if (scaled <= lastOffset) {
      scaled = Math.round((lastOffset + MIN_GAP) * 10) / 10;
    }
    lastOffset = scaled;
    return { ...e, offsetMin: scaled };
  });
}

const PRESET_CONFIGS: Record<SchedulePreset, PresetConfig> = {
  DEFAULT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'START_DILEMMA',   clockTime: '09:01', condition: 'hasDilemma' },
      { action: 'OPEN_DMS',        clockTime: '10:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:01' },
      { action: 'START_GAME',      clockTime: '10:02', condition: 'hasGame' },
      { action: 'END_GAME',        clockTime: '12:00', condition: 'hasGame' },
      { action: 'START_ACTIVITY',  clockTime: '14:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY',    clockTime: '16:00', condition: 'hasActivity' },
      { action: 'END_DILEMMA',     clockTime: '19:00', condition: 'hasDilemma' },
      { action: 'OPEN_VOTING',     clockTime: '20:00' },
      { action: 'CLOSE_VOTING',    clockTime: '22:59' },
      { action: 'CLOSE_DMS',       clockTime: '23:00' },
      { action: 'END_DAY',         clockTime: '23:59' },
    ],
  },
  COMPACT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'START_DILEMMA',   clockTime: '09:01', condition: 'hasDilemma' },
      { action: 'OPEN_DMS',        clockTime: '09:30' },
      { action: 'START_GAME',      clockTime: '09:31', condition: 'hasGame' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:30' },
      { action: 'END_GAME',        clockTime: '11:30', condition: 'hasGame' },
      { action: 'START_ACTIVITY',  clockTime: '12:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY',    clockTime: '13:00', condition: 'hasActivity' },
      { action: 'END_DILEMMA',     clockTime: '13:30', condition: 'hasDilemma' },
      { action: 'OPEN_VOTING',     clockTime: '14:00' },
      { action: 'CLOSE_VOTING',    clockTime: '16:59' },
      { action: 'CLOSE_DMS',       clockTime: '17:00' },
      { action: 'END_DAY',         clockTime: '17:30' },
    ],
  },
  SPEED_RUN: {
    type: 'offset',
    dayDurationMin: 23,
    interDayGapMin: 3,
    events: scaleCanonical(23),
  },
  PLAYTEST: {
    type: 'calendar',
    firstEventTime: '10:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '10:00' },
      { action: 'START_DILEMMA',   clockTime: '10:01', condition: 'hasDilemma' },
      { action: 'OPEN_DMS',        clockTime: '11:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '12:00' },
      { action: 'START_GAME',      clockTime: '12:01', condition: 'hasGame' },
      { action: 'START_ACTIVITY',  clockTime: '12:02', condition: 'hasActivity' },
      { action: 'END_GAME',        clockTime: '14:00', condition: 'hasGame' },
      { action: 'END_ACTIVITY',    clockTime: '15:00', condition: 'hasActivity' },
      { action: 'END_DILEMMA',     clockTime: '14:59', condition: 'hasDilemma' },
      { action: 'OPEN_GROUP_CHAT', clockTime: '15:01' },
      { action: 'OPEN_VOTING',     clockTime: '15:02' },
      { action: 'CLOSE_DMS',       clockTime: '16:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '16:01' },
      { action: 'CLOSE_VOTING',    clockTime: '16:59' },
      { action: 'END_DAY',         clockTime: '17:00' },
    ],
  },
  SMOKE_TEST: {
    type: 'offset',
    dayDurationMin: 5,
    interDayGapMin: 1,
    events: scaleCanonical(5),
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function meetsCondition(condition: string | undefined, opts: DayOptions): boolean {
  if (!condition) return true;
  if (condition === 'hasGame') return opts.gameType !== 'NONE';
  if (condition === 'hasActivity') return opts.activityType !== 'NONE';
  if (condition === 'hasDilemma') return opts.dilemmaType !== 'NONE';
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
