/**
 * Deep-link intent shapes carried in push notification `data.intent`.
 * See: docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md §2
 */

export type CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma';

export type DeepLinkIntent =
  | { kind: 'main' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'dm_invite'; senderId: string }
  | { kind: 'cartridge_active'; cartridgeId: string; cartridgeKind: CartridgeKind }
  | { kind: 'cartridge_result'; cartridgeId: string }
  | { kind: 'elimination_reveal'; dayIndex: number }
  | { kind: 'winner_reveal' };
