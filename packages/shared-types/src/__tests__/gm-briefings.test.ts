import { describe, it, expect } from 'vitest';
import { buildDayBriefingMessages } from '../gm-briefings';

describe('buildDayBriefingMessages', () => {
  it('returns day overview with vote type for a basic day', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 2,
      voteType: 'MAJORITY',
      gameType: 'NONE',
    }, 5);

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0]).toContain('Day 2');
    expect(messages[0]).toContain('5 players remain');
    expect(messages[0]).toContain('Majority Vote');
    expect(messages[0]).toContain('most votes is eliminated');
  });

  it('includes game preview when gameType is not NONE', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'BUBBLE',
      gameType: 'GAP_RUN',
    }, 6);

    const combined = messages.join('\n');
    expect(combined).toContain('Gap Run');
  });

  it('includes activity preview when activityType is set', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      activityType: 'HOT_TAKE',
    }, 4);

    const combined = messages.join('\n');
    expect(combined).toContain('Hot Take');
  });

  it('sends separate dilemma message when dilemmaType is set', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      dilemmaType: 'SILVER_GAMBIT',
    }, 4);

    expect(messages.length).toBe(2);
    expect(messages[1]).toContain('Silver Gambit');
    expect(messages[1]).toContain('secretly chooses to donate');
  });

  it('handles undefined optional fields gracefully', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 3,
      voteType: 'EXECUTIONER',
    }, 3);

    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('Executioner');
    expect(messages[0]).not.toContain('undefined');
  });

  it('handles NONE string values same as undefined', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      activityType: 'NONE',
      dilemmaType: 'NONE',
    }, 5);

    expect(messages.length).toBe(1);
  });
});
