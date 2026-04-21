/**
 * L3-Pregame — sibling to l3-session, invoked by L2 in `preGame` state.
 *
 * Lifecycle: born when L2 enters `preGame`, dies when L2 transitions out
 * (to `dayLoop` via SYSTEM.WAKEUP or ADMIN.NEXT_STAGE). Holds no state
 * that needs to survive into Day 1 — pregame interactions are journaled
 * to D1 (via FACT.RECORD → L2 → persistFactToD1) but do not pollute
 * l3-session context.
 *
 * Surfaces:
 *   - PREGAME.REVEAL_ANSWER     → QA reveal, one-shot per player
 *   - SYSTEM.PLAYER_JOINED      → arrival tracking (roster mirror)
 *   - SOCIAL.WHISPER            → pregame intrigue — reuses buildChatMessage +
 *                                 appendToChatLog from l3-social's helpers,
 *                                 WHISPER fact is already in JOURNALABLE_TYPES
 *                                 so it lands in D1 unchanged. The guard here
 *                                 is a cut-down copy of isWhisperAllowed that
 *                                 drops the `dmsOpen` gate (pregame is always-
 *                                 on) but keeps alive / self-not-target / text-
 *                                 non-empty + requires MAIN to carry WHISPER cap.
 *
 * See plans/DECISIONS.md ADR-143.
 */
import { setup, assign, sendParent } from 'xstate';
import {
  Events,
  FactTypes,
  PlayerStatuses,
  type QaEntry,
  type Fact,
  type ChatMessage,
  type Channel,
} from '@pecking-order/shared-types';
import { buildChatMessage, appendToChatLog } from './actions/social-helpers';

/** Synthetic MAIN channel seeded at spawn. WHISPER cap is load-bearing —
 *  the guard below (and any reuse of the standard whisper projection on
 *  the client) checks for it. CHAT/REACTIONS/SILVER are omitted because
 *  those surfaces are NOT available in pregame. */
const PREGAME_MAIN_CHANNEL: Channel = {
  id: 'MAIN',
  type: 'MAIN' as const,
  memberIds: [],
  createdBy: 'SYSTEM',
  createdAt: Date.now(),
  capabilities: ['WHISPER'] as const,
};

export interface PregameContext {
  /** Roster snapshot built from forwarded PLAYER_JOINED events.
   *  Mirrors L2 roster but only the fields pregame needs. */
  players: Record<string, { joinedAt: number; personaName: string; status: 'ALIVE' | 'ELIMINATED'; qaAnswers: QaEntry[] }>;
  /** Recorded reveals — playerId → qIndex they revealed. One-shot per player. */
  revealedAnswers: Record<string, { qIndex: number; question: string; answer: string; revealedAt: number }>;
  /** Chat log for pregame whispers. Reuses the canonical ChatMessage shape
   *  + buildChatMessage helper so the client renders them via the existing
   *  WhisperCard without special-casing the pregame source. */
  chatLog: ChatMessage[];
  /** Synthetic channel set — currently only MAIN with WHISPER cap. */
  channels: Record<string, Channel>;
}

export type PregameEvent =
  | { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; personaName?: string; qaAnswers?: QaEntry[] } }
  | { type: 'PREGAME.REVEAL_ANSWER'; senderId: string; qIndex: number }
  | { type: 'SOCIAL.WHISPER'; senderId: string; targetId: string; text: string };

export const pregameMachine = setup({
  types: {
    context: {} as PregameContext,
    events: {} as PregameEvent,
  },
  guards: {
    canRevealAnswer: ({ context, event }: any) => {
      if (event.type !== Events.Pregame.REVEAL_ANSWER) return false;
      const player = context.players[event.senderId];
      if (!player) return false;
      if (event.senderId in context.revealedAnswers) return false;
      return event.qIndex >= 0 && event.qIndex < player.qaAnswers.length;
    },
    // Cut-down copy of l3-social's isWhisperAllowed:
    //   - keeps: MAIN has WHISPER cap, alive check, self != target, text non-empty
    //   - drops: dmsOpen phase gate (pregame is always-on by design)
    canWhisper: ({ context, event }: any) => {
      if (event.type !== Events.Social.WHISPER) return false;
      const mainCaps = context.channels?.MAIN?.capabilities ?? [];
      if (!mainCaps.includes('WHISPER')) return false;
      const { senderId, targetId, text } = event;
      if (!senderId || !targetId || senderId === targetId) return false;
      if (!text || text.length === 0) return false;
      const sender = context.players[senderId];
      const target = context.players[targetId];
      if (!sender || sender.status !== PlayerStatuses.ALIVE) return false;
      if (!target || target.status !== PlayerStatuses.ALIVE) return false;
      return true;
    },
  } as any,
}).createMachine({
  id: 'l3-pregame',
  context: {
    players: {},
    revealedAnswers: {},
    chatLog: [],
    channels: { MAIN: PREGAME_MAIN_CHANNEL },
  },
  initial: 'open',
  states: {
    open: {
      on: {
        'SYSTEM.PLAYER_JOINED': {
          actions: [
            assign({
              players: ({ context, event }: any) => ({
                ...context.players,
                [event.player.id]: {
                  joinedAt: Date.now(),
                  personaName: event.player.personaName ?? event.player.id,
                  status: PlayerStatuses.ALIVE,
                  qaAnswers: event.player.qaAnswers ?? [],
                },
              }),
              channels: ({ context, event }: any) => {
                const main = context.channels.MAIN;
                if (!main) return context.channels;
                if ((main.memberIds ?? []).includes(event.player.id)) return context.channels;
                return {
                  ...context.channels,
                  MAIN: { ...main, memberIds: [...(main.memberIds ?? []), event.player.id] },
                };
              },
            }),
            sendParent(({ event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => ({
              type: Events.Fact.RECORD,
              fact: {
                type: FactTypes.PREGAME_PLAYER_JOINED,
                actorId: event.player.id,
                timestamp: Date.now(),
                payload: { qaCount: event.player.qaAnswers?.length ?? 0 },
              },
            })),
          ],
        },
        'PREGAME.REVEAL_ANSWER': {
          guard: 'canRevealAnswer',
          actions: [
            assign({
              revealedAnswers: ({ context, event }: any) => {
                const qa = context.players[event.senderId].qaAnswers[event.qIndex];
                return {
                  ...context.revealedAnswers,
                  [event.senderId]: {
                    qIndex: event.qIndex,
                    question: qa.question,
                    answer: qa.answer,
                    revealedAt: Date.now(),
                  },
                };
              },
            }),
            sendParent(({ context, event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => {
              const reveal = context.revealedAnswers[event.senderId];
              return {
                type: Events.Fact.RECORD,
                fact: {
                  type: FactTypes.PREGAME_REVEAL_ANSWER,
                  actorId: event.senderId,
                  timestamp: reveal.revealedAt,
                  payload: {
                    qIndex: reveal.qIndex,
                    question: reveal.question,
                    answer: reveal.answer,
                  },
                },
              };
            }),
          ],
        },
        'SOCIAL.WHISPER': {
          guard: 'canWhisper',
          actions: [
            assign({
              chatLog: ({ context, event }: any) => {
                const msg = buildChatMessage(event.senderId, event.text, 'MAIN', {
                  whisperTarget: event.targetId,
                });
                return appendToChatLog(context.chatLog, msg);
              },
            }),
            sendParent(({ event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => ({
              type: Events.Fact.RECORD,
              fact: {
                type: FactTypes.WHISPER,
                actorId: event.senderId,
                targetId: event.targetId,
                payload: {},
                timestamp: Date.now(),
              },
            })),
          ],
        },
      },
    },
  },
} as any);
