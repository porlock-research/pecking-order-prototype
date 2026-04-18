import { describe, it, expect } from 'vitest';
import { HOT_TAKE_POOL, pickHotTakeQuestion, type HotTakeQuestion } from '../prompt-pools/hot-take';

describe('HOT_TAKE_POOL invariants', () => {
  it('contains exactly 30 entries', () => {
    expect(HOT_TAKE_POOL).toHaveLength(30);
  });

  it('has unique kebab-case ids', () => {
    const ids = HOT_TAKE_POOL.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
    }
  });

  it('every statement is ≤100 chars', () => {
    for (const q of HOT_TAKE_POOL) {
      expect(q.statement.length).toBeLessThanOrEqual(100);
    }
  });

  it('every question has 2–4 unique options, each ≤24 chars', () => {
    for (const q of HOT_TAKE_POOL) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(new Set(q.options).size).toBe(q.options.length);
      for (const opt of q.options) {
        expect(opt.length).toBeLessThanOrEqual(24);
      }
    }
  });
});

describe('pickHotTakeQuestion', () => {
  it('picks from the full pool when usedIds is empty', () => {
    const q = pickHotTakeQuestion([]);
    expect(HOT_TAKE_POOL).toContainEqual(q);
  });

  it('never returns a used id while unused ones remain', () => {
    const allIds = HOT_TAKE_POOL.map((q) => q.id);
    const usedExceptOne = allIds.slice(0, allIds.length - 1);
    for (let i = 0; i < 20; i++) {
      const q = pickHotTakeQuestion(usedExceptOne);
      expect(q.id).toBe(allIds[allIds.length - 1]);
    }
  });

  it('resets and picks from full pool when every id is used', () => {
    const allIds = HOT_TAKE_POOL.map((q) => q.id);
    const q = pickHotTakeQuestion(allIds);
    expect(HOT_TAKE_POOL).toContainEqual(q);
  });
});
