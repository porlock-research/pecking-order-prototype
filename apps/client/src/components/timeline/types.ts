import type { ChatMessage, TickerMessage } from '@pecking-order/shared-types';

export type TimelineEntry =
  | { kind: 'chat';   key: string; timestamp: number; data: ChatMessage }
  | { kind: 'system'; key: string; timestamp: number; data: TickerMessage }
  | { kind: 'voting'; key: 'active-voting'; timestamp: number }
  | { kind: 'game';   key: 'active-game';  timestamp: number }
  | { kind: 'prompt'; key: 'active-prompt'; timestamp: number }
  | { kind: 'completed-cartridge'; key: string; timestamp: number; data: { kind: 'voting' | 'game' | 'prompt'; snapshot: any } };
