import { describe, it, expect, expectTypeOf } from 'vitest';
import type { DeepLinkIntent, CartridgeKind } from '../push';

describe('DeepLinkIntent', () => {
  it('CartridgeKind covers the four lowercase values', () => {
    expectTypeOf<CartridgeKind>().toEqualTypeOf<'voting' | 'game' | 'prompt' | 'dilemma'>();
  });

  it('accepts main intent', () => {
    const intent: DeepLinkIntent = { kind: 'main' };
    expect(intent.kind).toBe('main');
  });

  it('accepts dm intent with channelId', () => {
    const intent: DeepLinkIntent = { kind: 'dm', channelId: 'DM-p1-p3' };
    expect(intent.channelId).toBe('DM-p1-p3');
  });

  it('accepts cartridge_active intent with cartridgeKind', () => {
    const intent: DeepLinkIntent = {
      kind: 'cartridge_active',
      cartridgeId: 'voting-3-MAJORITY',
      cartridgeKind: 'voting',
    };
    expect(intent.cartridgeKind).toBe('voting');
  });

  it('accepts cartridge_result intent with cartridgeId', () => {
    const intent: DeepLinkIntent = { kind: 'cartridge_result', cartridgeId: 'game-3-TRIVIA' };
    expect(intent.cartridgeId).toBe('game-3-TRIVIA');
  });

  it('accepts elimination_reveal with dayIndex and winner_reveal scalar', () => {
    const elim: DeepLinkIntent = { kind: 'elimination_reveal', dayIndex: 3 };
    const winner: DeepLinkIntent = { kind: 'winner_reveal' };
    expect(elim.dayIndex).toBe(3);
    expect(winner.kind).toBe('winner_reveal');
  });
});
