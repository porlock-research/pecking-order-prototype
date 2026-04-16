import { describe, it, expect } from 'vitest';
import { parseIntentFromData, buildIntentUrl } from '../sw-intent-helpers';

describe('parseIntentFromData', () => {
  it('parses a valid stringified intent', () => {
    expect(parseIntentFromData({ intent: JSON.stringify({ kind: 'main' }) })).toEqual({ kind: 'main' });
  });
  it('returns null for missing intent field', () => {
    expect(parseIntentFromData({ url: 'https://x' })).toBeNull();
  });
  it('returns null for malformed JSON', () => {
    expect(parseIntentFromData({ intent: '{not-json' })).toBeNull();
  });
  it('returns null for non-object parse result', () => {
    expect(parseIntentFromData({ intent: '"string"' })).toBeNull();
  });
  it('returns null for missing kind field', () => {
    expect(parseIntentFromData({ intent: '{"channelId":"x"}' })).toBeNull();
  });
  it('returns null for unknown kind', () => {
    expect(parseIntentFromData({ intent: '{"kind":"unknown"}' })).toBeNull();
  });
});

describe('buildIntentUrl', () => {
  it('appends ?intent=<base64> to URL without query', () => {
    const url = buildIntentUrl('https://x/game/ABC', { kind: 'main' });
    expect(url).toMatch(/^https:\/\/x\/game\/ABC\?intent=/);
    const intentParam = new URL(url).searchParams.get('intent');
    const decoded = JSON.parse(atob(intentParam!));
    expect(decoded).toEqual({ kind: 'main' });
  });
  it('appends &intent= to URL with existing query', () => {
    const url = buildIntentUrl('https://x/game/ABC?foo=1', { kind: 'main' });
    expect(url).toContain('&intent=');
  });
});
