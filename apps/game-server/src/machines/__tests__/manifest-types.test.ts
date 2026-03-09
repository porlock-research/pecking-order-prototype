import { describe, it, expect } from 'vitest';
import {
  StaticManifestSchema,
  DynamicManifestSchema,
  GameManifestSchema,
  normalizeManifest,
  SchedulePresetSchema,
  GameRulesetSchema,
  type StaticManifest,
  type DynamicManifest,
  type PeckingOrderRuleset,
} from '@pecking-order/shared-types';

const VALID_DAY = {
  dayIndex: 1,
  theme: 'Day 1',
  voteType: 'MAJORITY' as const,
  gameType: 'NONE' as const,
  timeline: [],
};

const VALID_RULESET: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'FINALS'] },
  games: { mode: 'NONE', avoidRepeat: false },
  activities: { mode: 'NONE', avoidRepeat: false },
  social: {
    dmChars: { mode: 'FIXED', base: 1200 },
    dmPartners: { mode: 'FIXED', base: 3 },
    dmCost: 1,
    groupDmEnabled: true,
  },
  inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
  dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
};

describe('GameManifest discriminated union', () => {
  it('parses a StaticManifest', () => {
    const raw = {
      kind: 'STATIC' as const,
      scheduling: 'PRE_SCHEDULED' as const,
      days: [VALID_DAY],
    };
    const result = StaticManifestSchema.parse(raw);
    expect(result.kind).toBe('STATIC');
    expect(result.days).toHaveLength(1);
  });

  it('parses a DynamicManifest', () => {
    const raw = {
      kind: 'DYNAMIC' as const,
      scheduling: 'PRE_SCHEDULED' as const,
      ruleset: VALID_RULESET,
      schedulePreset: 'DEFAULT' as const,
      maxPlayers: 8,
      days: [],
    };
    const result = DynamicManifestSchema.parse(raw);
    expect(result.kind).toBe('DYNAMIC');
    expect(result.ruleset.kind).toBe('PECKING_ORDER');
    expect(result.days).toHaveLength(0);
  });

  it('parses via the union schema', () => {
    const staticRaw = { kind: 'STATIC' as const, scheduling: 'PRE_SCHEDULED' as const, days: [VALID_DAY] };
    const dynamicRaw = {
      kind: 'DYNAMIC' as const,
      scheduling: 'ADMIN' as const,
      ruleset: VALID_RULESET,
      schedulePreset: 'SPEED_RUN' as const,
      maxPlayers: 4,
      days: [],
    };

    const s = GameManifestSchema.parse(staticRaw);
    const d = GameManifestSchema.parse(dynamicRaw);
    expect(s.kind).toBe('STATIC');
    expect(d.kind).toBe('DYNAMIC');
  });

  it('rejects manifest with unknown kind', () => {
    const raw = { kind: 'INVALID', scheduling: 'PRE_SCHEDULED', days: [] };
    expect(() => GameManifestSchema.parse(raw)).toThrow();
  });
});

describe('normalizeManifest', () => {
  it('normalizes legacy manifest (no kind) to StaticManifest', () => {
    const legacy = {
      id: 'test',
      gameMode: 'CONFIGURABLE_CYCLE',
      scheduling: 'PRE_SCHEDULED',
      days: [VALID_DAY],
    };
    const result = normalizeManifest(legacy);
    expect(result.kind).toBe('STATIC');
    expect(result.days).toHaveLength(1);
  });

  it('passes through already-typed StaticManifest unchanged', () => {
    const typed: StaticManifest = {
      kind: 'STATIC',
      scheduling: 'PRE_SCHEDULED',
      days: [VALID_DAY],
    };
    const result = normalizeManifest(typed);
    expect(result).toEqual(typed);
  });

  it('passes through DynamicManifest unchanged', () => {
    const typed: DynamicManifest = {
      kind: 'DYNAMIC',
      scheduling: 'PRE_SCHEDULED',
      ruleset: VALID_RULESET,
      schedulePreset: 'DEFAULT',
      maxPlayers: 6,
      days: [],
    };
    const result = normalizeManifest(typed);
    expect(result).toEqual(typed);
  });
});

describe('SchedulePreset', () => {
  it('accepts valid presets', () => {
    expect(SchedulePresetSchema.parse('DEFAULT')).toBe('DEFAULT');
    expect(SchedulePresetSchema.parse('COMPACT')).toBe('COMPACT');
    expect(SchedulePresetSchema.parse('SPEED_RUN')).toBe('SPEED_RUN');
  });

  it('rejects invalid presets', () => {
    expect(() => SchedulePresetSchema.parse('INVALID')).toThrow();
  });
});

describe('GameRuleset', () => {
  it('parses PeckingOrderRuleset', () => {
    const result = GameRulesetSchema.parse(VALID_RULESET);
    expect(result.kind).toBe('PECKING_ORDER');
  });

  it('rejects ruleset with unknown kind', () => {
    expect(() => GameRulesetSchema.parse({ kind: 'UNKNOWN', foo: 'bar' })).toThrow();
  });

  it('rejects PeckingOrderRuleset with invalid vote type in sequence', () => {
    const bad = {
      ...VALID_RULESET,
      voting: { mode: 'SEQUENCE', sequence: ['INVALID_VOTE'] },
    };
    expect(() => GameRulesetSchema.parse(bad)).toThrow();
  });
});

describe('DailyManifest social parameters', () => {
  it('accepts optional dmCharsPerPlayer and dmPartnersPerPlayer', () => {
    const day = { ...VALID_DAY, dmCharsPerPlayer: 800, dmPartnersPerPlayer: 2 };
    const result = StaticManifestSchema.parse({
      kind: 'STATIC',
      scheduling: 'PRE_SCHEDULED',
      days: [day],
    });
    expect(result.days[0].dmCharsPerPlayer).toBe(800);
    expect(result.days[0].dmPartnersPerPlayer).toBe(2);
  });

  it('defaults to undefined when social params not provided', () => {
    const result = StaticManifestSchema.parse({
      kind: 'STATIC',
      scheduling: 'PRE_SCHEDULED',
      days: [VALID_DAY],
    });
    expect(result.days[0].dmCharsPerPlayer).toBeUndefined();
    expect(result.days[0].dmPartnersPerPlayer).toBeUndefined();
  });
});
