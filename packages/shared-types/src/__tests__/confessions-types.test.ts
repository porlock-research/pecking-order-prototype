import { describe, it, expect } from 'vitest';
import {
  Events,
  FactTypes,
  TickerCategories,
  PeckingOrderRulesetSchema,
  TimelineEventSchema,
  ChannelTypeSchema,
} from '../index';
import { Config } from '../config';

describe('Confessions shared types', () => {
  it('declares Events.Confession namespace + POST', () => {
    expect(Events.Confession.PREFIX).toBe('CONFESSION.');
    expect(Events.Confession.POST).toBe('CONFESSION.POST');
  });

  it('declares three new fact types', () => {
    expect(FactTypes.CONFESSION_POSTED).toBe('CONFESSION_POSTED');
    expect(FactTypes.CONFESSION_PHASE_STARTED).toBe('CONFESSION_PHASE_STARTED');
    expect(FactTypes.CONFESSION_PHASE_ENDED).toBe('CONFESSION_PHASE_ENDED');
  });

  it('declares SOCIAL_PHASE ticker category', () => {
    expect(TickerCategories.SOCIAL_PHASE).toBe('SOCIAL.PHASE');
  });

  it('TimelineEventSchema accepts START_CONFESSION_CHAT', () => {
    const parsed = TimelineEventSchema.parse({ time: '12:00', action: 'START_CONFESSION_CHAT' });
    expect(parsed.action).toBe('START_CONFESSION_CHAT');
  });

  it('TimelineEventSchema accepts END_CONFESSION_CHAT', () => {
    const parsed = TimelineEventSchema.parse({ time: '14:00', action: 'END_CONFESSION_CHAT' });
    expect(parsed.action).toBe('END_CONFESSION_CHAT');
  });

  it('TimelineEventSchema rejects unknown actions', () => {
    expect(() => TimelineEventSchema.parse({ time: '12:00', action: 'BOGUS_ACTION' })).toThrow();
  });

  it('ChannelTypeSchema accepts CONFESSION', () => {
    expect(ChannelTypeSchema.parse('CONFESSION')).toBe('CONFESSION');
  });

  it('Config.confession.maxConfessionLength = 280', () => {
    expect(Config.confession.maxConfessionLength).toBe(280);
  });

  it('ruleset accepts confessions.enabled: true', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse({ ...base, confessions: { enabled: true } });
    expect(parsed.confessions?.enabled).toBe(true);
  });

  it('ruleset accepts confessions.enabled: false', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse({ ...base, confessions: { enabled: false } });
    expect(parsed.confessions?.enabled).toBe(false);
  });

  it('ruleset accepts absent confessions block (backward compat)', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse(base);
    expect(parsed.confessions).toBeUndefined();
  });

  it('ruleset rejects confessions as a non-object', () => {
    const base = minimalRuleset();
    expect(() => PeckingOrderRulesetSchema.parse({ ...base, confessions: 'yes' })).toThrow();
  });
});

function minimalRuleset() {
  return {
    kind: 'PECKING_ORDER' as const,
    voting: { mode: 'SEQUENCE' as const, sequence: ['MAJORITY'] },
    games: { mode: 'NONE' as const, avoidRepeat: false },
    activities: { mode: 'NONE' as const, avoidRepeat: false },
    social: {
      dmChars: { mode: 'FIXED' as const, base: 1200 },
      dmPartners: { mode: 'FIXED' as const, base: 3 },
      dmCost: 1, groupDmEnabled: true, requireDmInvite: false, dmSlotsPerPlayer: 5,
    },
    inactivity: { enabled: true, thresholdDays: 2, action: 'ELIMINATE' as const },
    dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' as const },
  };
}
