import { describe, it, expect } from 'vitest';
import { assignPhaseHandles, createSeededRng } from '../observations/confession-handles';

describe('createSeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = createSeededRng('abc');
    const rng2 = createSeededRng('abc');
    expect([rng1.next(), rng1.next(), rng1.next()])
      .toEqual([rng2.next(), rng2.next(), rng2.next()]);
  });

  it('differs across seeds', () => {
    expect(createSeededRng('abc').next()).not.toBe(createSeededRng('abd').next());
  });

  it('next() returns floats in [0, 1)', () => {
    const rng = createSeededRng('seed');
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(n) returns integers in [0, n)', () => {
    const rng = createSeededRng('seed');
    for (let i = 0; i < 50; i++) {
      const v = rng.nextInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('assignPhaseHandles', () => {
  it('assigns one unique handle per player', () => {
    const result = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:2:confession');
    const handles = Object.values(result);
    expect(handles).toHaveLength(4);
    expect(new Set(handles).size).toBe(4);
  });

  it('handle format matches "Confessor #N"', () => {
    const result = assignPhaseHandles(['p1', 'p2'], 'g1:2:confession');
    for (const h of Object.values(result)) {
      expect(h).toMatch(/^Confessor #\d+$/);
    }
  });

  it('deterministic on same (players, seed)', () => {
    const a = assignPhaseHandles(['p1', 'p2', 'p3'], 'g1:2:confession');
    const b = assignPhaseHandles(['p1', 'p2', 'p3'], 'g1:2:confession');
    expect(a).toEqual(b);
  });

  it('different seeds produce different assignments for the same roster', () => {
    const a = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:2:confession');
    const b = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:3:confession');
    expect(a).not.toEqual(b);
  });

  it('empty roster returns empty map', () => {
    expect(assignPhaseHandles([], 'seed')).toEqual({});
  });

  it('uses sequential handle numbers 1..N', () => {
    const result = assignPhaseHandles(['p1', 'p2', 'p3'], 'seed');
    const numbers = Object.values(result).map(h => Number(h.split('#')[1])).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('every input playerId receives an assignment', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p10', 'p11'];
    const result = assignPhaseHandles(ids, 'seed');
    for (const id of ids) {
      expect(result[id]).toMatch(/^Confessor #\d+$/);
    }
  });
});
