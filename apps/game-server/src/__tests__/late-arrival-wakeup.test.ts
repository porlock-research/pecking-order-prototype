import { describe, it, expect } from 'vitest';
import { shouldFireLateArrivalWakeup } from '../http-handlers';

// Covers ADR-148 — late-arrival WAKEUP retry when the scheduled game-start
// alarm fires before quorum and subsequent joins push roster past minPlayers.
function snap({
  value = 'preGame',
  kind = 'DYNAMIC',
  startTime = '2026-04-23T00:00:00Z',
  minPlayers = 3,
  rosterSize = 3,
}: {
  value?: string;
  kind?: string;
  startTime?: string | null;
  minPlayers?: number;
  rosterSize?: number;
} = {}) {
  const roster: Record<string, any> = {};
  for (let i = 1; i <= rosterSize; i++) roster[`p${i}`] = { id: `p${i}` };
  return {
    value,
    context: {
      roster,
      manifest: { kind, startTime: startTime ?? undefined, minPlayers },
    },
  };
}

const AFTER_START = new Date('2026-04-23T00:10:00Z').getTime();
const BEFORE_START = new Date('2026-04-22T23:50:00Z').getTime();

describe('shouldFireLateArrivalWakeup (ADR-148)', () => {
  it('fires when DYNAMIC preGame has quorum past startTime', () => {
    expect(shouldFireLateArrivalWakeup(snap(), AFTER_START)).toBe(true);
  });

  it('does not fire before startTime (respects scheduled alarm ownership)', () => {
    expect(shouldFireLateArrivalWakeup(snap(), BEFORE_START)).toBe(false);
  });

  it('does not fire below minPlayers', () => {
    expect(shouldFireLateArrivalWakeup(snap({ rosterSize: 2 }), AFTER_START)).toBe(false);
  });

  it('does not fire once L2 has left preGame (idempotent)', () => {
    expect(shouldFireLateArrivalWakeup(snap({ value: 'dayLoop' }), AFTER_START)).toBe(false);
  });

  it('does not fire for STATIC manifests', () => {
    expect(shouldFireLateArrivalWakeup(snap({ kind: 'STATIC' }), AFTER_START)).toBe(false);
  });

  it('does not fire when manifest has no startTime', () => {
    expect(shouldFireLateArrivalWakeup(snap({ startTime: null }), AFTER_START)).toBe(false);
  });

  it('uses default minPlayers=3 when manifest omits it', () => {
    const s = snap({ rosterSize: 3 });
    // Strip minPlayers to hit the default branch
    delete (s.context.manifest as any).minPlayers;
    expect(shouldFireLateArrivalWakeup(s, AFTER_START)).toBe(true);
  });

  it('honors a custom minPlayers threshold', () => {
    expect(shouldFireLateArrivalWakeup(snap({ minPlayers: 5, rosterSize: 4 }), AFTER_START)).toBe(false);
    expect(shouldFireLateArrivalWakeup(snap({ minPlayers: 5, rosterSize: 5 }), AFTER_START)).toBe(true);
  });
});
