import type { ChatMessage, TickerMessage } from '@pecking-order/shared-types';

export type TimelineEntry =
  | { kind: 'chat';   key: string; timestamp: number; data: ChatMessage }
  | { kind: 'system'; key: string; timestamp: number; data: TickerMessage }
  | { kind: 'completed-cartridge'; key: string; timestamp: number; data: { kind: 'voting' | 'game' | 'prompt'; snapshot: any } };
