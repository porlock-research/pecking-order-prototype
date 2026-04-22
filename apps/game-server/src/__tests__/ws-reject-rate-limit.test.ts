import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { recordReject, REJECT_CACHE } from '../ws-handlers';

describe('WS reject rate limit', () => {
  beforeEach(() => {
    REJECT_CACHE.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first reject for a key returns "first"', () => {
    expect(recordReject('k1')).toBe('first');
  });

  it('second and third rejects within window return "repeated"', () => {
    recordReject('k2');
    expect(recordReject('k2')).toBe('repeated');
    expect(recordReject('k2')).toBe('repeated');
  });

  it('fourth reject within window returns "permanent"', () => {
    recordReject('k3');
    recordReject('k3');
    recordReject('k3');
    expect(recordReject('k3')).toBe('permanent');
  });

  it('further rejects after permanent stay permanent', () => {
    recordReject('k4');
    recordReject('k4');
    recordReject('k4');
    expect(recordReject('k4')).toBe('permanent');
    expect(recordReject('k4')).toBe('permanent');
  });

  it('window expiry resets the counter to "first"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
    expect(recordReject('k5')).toBe('first');
    vi.advanceTimersByTime(31_000);
    expect(recordReject('k5')).toBe('first');
  });

  it('different keys are tracked independently', () => {
    recordReject('a');
    recordReject('a');
    recordReject('a');
    expect(recordReject('a')).toBe('permanent');
    expect(recordReject('b')).toBe('first');
  });
});
