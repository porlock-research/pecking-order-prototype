/**
 * Game Cartridge Event Types
 *
 * GameEvent = client events (with senderId injected by L1) + internal lifecycle events.
 */
import type { GameClientEvent } from '@pecking-order/shared-types';

export type GameEvent =
  | (GameClientEvent & { senderId: string })
  | { type: 'INTERNAL.START_GAME'; payload?: any }
  | { type: 'INTERNAL.END_GAME' };
