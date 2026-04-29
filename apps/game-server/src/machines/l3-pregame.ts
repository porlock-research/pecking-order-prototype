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
 *   - PREGAME.REVEAL_ANSWER     → QA reveal, one-shot per player (manual path,
 *                                 currently unused with v3 auto-reveal but kept
 *                                 as a safe fallback if the client ever needs it)
 *   - SYSTEM.PLAYER_JOINED      → arrival tracking (roster mirror)
 *   - SYSTEM.PLAYER_CONNECTED   → first-time client connect → auto-reveal one
 *                                 random QA. Idempotent via firstConnectedAt
 *                                 flag so reconnects/multi-tab don't re-fire.
 *                                 Players with no qaAnswers get the flag set
 *                                 but no reveal (graceful fallback).
 *   - SOCIAL.SEND_MSG           → group chat in pregame (MAIN only). DMs stay
 *                                 closed; guard rejects any payload naming
 *                                 recipients. Emits CHAT_MSG fact with
 *                                 mentionedIds/replyToAuthorId resolved the
 *                                 same way as l3-social.emitChatFact.
 *   - SOCIAL.REACT              → emoji reactions on pregame MAIN messages.
 *                                 Mirrors l3-social's processReaction.
 *   - SOCIAL.WHISPER            → pregame intrigue — reuses buildChatMessage +
 *                                 appendToChatLog from l3-social's helpers,
 *                                 WHISPER fact is already in JOURNALABLE_TYPES
 *                                 so it lands in D1 unchanged. The guard here
 *                                 is a cut-down copy of isWhisperAllowed that
 *                                 drops the `dmsOpen` gate (pregame is always-
 *                                 on) but keeps alive / self-not-target / text-
 *                                 non-empty + requires MAIN to carry WHISPER cap.
 *   - SOCIAL.NUDGE              → "hey, I see you" ping to a specific player
 *                                 before Day 1. Emits NUDGE fact (sendParent →
 *                                 L2) which the journal+push pipeline turns
 *                                 into a notification. No throttle in pregame —
 *                                 there's no day boundary, and the design is
 *                                 "meet the cast" so repeat-pings are fine.
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

/** Synthetic MAIN channel seeded at spawn. Pregame allows group chat
 *  (CHAT + REACTIONS), whispers, and nudges; silver/DMs stay closed — the
 *  design is "meet the cast, gossip before Day 1 starts" without the
 *  full economy yet. Nudges intentionally bypass the per-day throttle
 *  since pregame has no day; clients can repeat-ping if they want. */
const PREGAME_MAIN_CHANNEL: Channel = {
  id: 'MAIN',
  type: 'MAIN' as const,
  memberIds: [],
  createdBy: 'SYSTEM',
  createdAt: Date.now(),
  capabilities: ['CHAT', 'REACTIONS', 'WHISPER', 'NUDGE'] as const,
};

export interface PregameContext {
  /** Roster snapshot built from forwarded PLAYER_JOINED events.
   *  Mirrors L2 roster but only the fields pregame needs.
   *  `firstConnectedAt` is null until the player's first WS connect — used
   *  by the SYSTEM.PLAYER_CONNECTED handler to make auto-reveal idempotent
   *  across reconnects, multi-tab, and DO hibernation restores. */
  players: Record<string, {
    joinedAt: number;
    personaName: string;
    status: 'ALIVE' | 'ELIMINATED';
    qaAnswers: QaEntry[];
    firstConnectedAt: number | null;
  }>;
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
  | { type: 'SYSTEM.PLAYER_CONNECTED'; playerId: string }
  | { type: 'PREGAME.REVEAL_ANSWER'; senderId: string; qIndex: number }
  | { type: 'SOCIAL.SEND_MSG'; senderId: string; content: string; replyTo?: string }
  | { type: 'SOCIAL.REACT'; senderId: string; messageId: string; emoji: string }
  | { type: 'SOCIAL.WHISPER'; senderId: string; targetId: string; text: string }
  | { type: typeof Events.Social.NUDGE; senderId: string; targetId: string };

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
    canAutoReveal: ({ context, event }: any) => {
      if (event.type !== Events.System.PLAYER_CONNECTED) return false;
      const p = context.players[event.playerId];
      if (!p) return false;
      if (p.firstConnectedAt !== null) return false; // already connected before
      return Array.isArray(p.qaAnswers) && p.qaAnswers.length > 0;
    },
    isFirstConnectWithoutQAs: ({ context, event }: any) => {
      if (event.type !== Events.System.PLAYER_CONNECTED) return false;
      const p = context.players[event.playerId];
      if (!p) return false;
      if (p.firstConnectedAt !== null) return false;
      return !Array.isArray(p.qaAnswers) || p.qaAnswers.length === 0;
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
    canSendMsg: ({ context, event }: any) => {
      if (event.type !== Events.Social.SEND_MSG) return false;
      const mainCaps = context.channels?.MAIN?.capabilities ?? [];
      if (!mainCaps.includes('CHAT')) return false;
      // Pregame only ever lands a SEND_MSG on MAIN — no DMs exist. Reject any
      // payload that names recipients (defensive; clients shouldn't produce
      // one but the L2 allowlist is broad by design).
      if (event.recipientIds?.length || event.targetId) return false;
      if (!event.senderId || !event.content || event.content.length === 0) return false;
      const sender = context.players[event.senderId];
      return !!sender && sender.status === PlayerStatuses.ALIVE;
    },
    canReact: ({ context, event }: any) => {
      if (event.type !== Events.Social.REACT) return false;
      const mainCaps = context.channels?.MAIN?.capabilities ?? [];
      if (!mainCaps.includes('REACTIONS')) return false;
      if (!event.senderId || !event.messageId || !event.emoji) return false;
      const sender = context.players[event.senderId];
      return !!sender && sender.status === PlayerStatuses.ALIVE;
    },
    // Pregame nudge: alive sender + alive target + self != target + MAIN
    // carries NUDGE cap. No throttle — pregame has no day boundary, and
    // the design is "meet the cast" so repeat-pings are fine.
    canNudge: ({ context, event }: any) => {
      if (event.type !== Events.Social.NUDGE) return false;
      const mainCaps = context.channels?.MAIN?.capabilities ?? [];
      if (!mainCaps.includes('NUDGE')) return false;
      const { senderId, targetId } = event;
      if (!senderId || !targetId || senderId === targetId) return false;
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
                  firstConnectedAt: null,
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
        // Auto-reveal trigger. Three branches in priority order:
        //   1. Player has qaAnswers AND not yet connected → pick random qIndex,
        //      record reveal, set firstConnectedAt, emit PREGAME_REVEAL_ANSWER fact.
        //   2. Player has no qaAnswers AND not yet connected → set firstConnectedAt
        //      so reconnects don't re-evaluate; no reveal (graceful fallback).
        //   3. Already-connected (firstConnectedAt set) OR unknown player → no-op.
        // Fact-emission lives in a separate sendParent that reads the just-written
        // revealedAnswers entry, mirroring the existing manual REVEAL_ANSWER pattern.
        'SYSTEM.PLAYER_CONNECTED': [
          {
            guard: 'canAutoReveal',
            actions: [
              assign({
                players: ({ context, event }: any) => ({
                  ...context.players,
                  [event.playerId]: { ...context.players[event.playerId], firstConnectedAt: Date.now() },
                }),
                revealedAnswers: ({ context, event }: any) => {
                  const p = context.players[event.playerId];
                  const qIndex = Math.floor(Math.random() * p.qaAnswers.length);
                  const qa = p.qaAnswers[qIndex];
                  return {
                    ...context.revealedAnswers,
                    [event.playerId]: {
                      qIndex,
                      question: qa.question,
                      answer: qa.answer,
                      revealedAt: Date.now(),
                    },
                  };
                },
              }),
              sendParent(({ context, event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => {
                const reveal = context.revealedAnswers[event.playerId];
                return {
                  type: Events.Fact.RECORD,
                  fact: {
                    type: FactTypes.PREGAME_REVEAL_ANSWER,
                    actorId: event.playerId,
                    timestamp: reveal.revealedAt,
                    payload: { qIndex: reveal.qIndex, question: reveal.question, answer: reveal.answer },
                  },
                };
              }),
            ],
          },
          {
            guard: 'isFirstConnectWithoutQAs',
            actions: assign({
              players: ({ context, event }: any) => ({
                ...context.players,
                [event.playerId]: { ...context.players[event.playerId], firstConnectedAt: Date.now() },
              }),
            }),
          },
        ],
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
        // Group chat in pregame. Only lands on MAIN — the guard rejects any
        // payload that names recipients, and we intentionally don't reuse
        // l3-social's processChannelMessage (which would try to spin up a
        // DM channel on first message and charge silver). @mention routing
        // for pushes mirrors the l3-social emitChatFact code path.
        'SOCIAL.SEND_MSG': {
          guard: 'canSendMsg',
          actions: [
            assign({
              chatLog: ({ context, event }: any) => {
                const msg = buildChatMessage(event.senderId, event.content, 'MAIN', {
                  replyTo: event.replyTo,
                });
                return appendToChatLog(context.chatLog, msg);
              },
            }),
            sendParent(({ context, event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => {
              let replyToAuthorId: string | undefined;
              if (event.replyTo) {
                const orig = context.chatLog.find((m: any) => m.id === event.replyTo);
                if (orig && orig.senderId !== event.senderId) replyToAuthorId = orig.senderId;
              }
              const content: string = event.content || '';
              const mentionedIds: string[] = [];
              for (const [pid, p] of Object.entries(context.players)) {
                if (pid === event.senderId) continue;
                const personaName = (p as any)?.personaName;
                if (personaName && content.includes(`@${personaName}`)) mentionedIds.push(pid);
              }
              return {
                type: Events.Fact.RECORD,
                fact: {
                  type: FactTypes.CHAT_MSG,
                  actorId: event.senderId,
                  payload: {
                    content: event.content,
                    channelId: 'MAIN',
                    ...(replyToAuthorId ? { replyToAuthorId } : {}),
                    ...(mentionedIds.length > 0 ? { mentionedIds } : {}),
                  },
                  timestamp: Date.now(),
                },
              };
            }),
          ],
        },
        // Pregame nudge: ping a specific player. Mirrors l3-social's
        // processNudge — emits a NUDGE fact (sendParent → L2) which the
        // journal+push pipeline turns into a notification on the target.
        // No state mutation in pregame context; rate-limit-free per design.
        [Events.Social.NUDGE]: {
          guard: 'canNudge',
          actions: [
            sendParent(({ event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => ({
              type: Events.Fact.RECORD,
              fact: {
                type: FactTypes.NUDGE,
                actorId: event.senderId,
                targetId: event.targetId,
                payload: {},
                timestamp: Date.now(),
              },
            })),
          ],
        },
        'SOCIAL.REACT': {
          guard: 'canReact',
          actions: [
            assign({
              chatLog: ({ context, event }: any) => {
                const ALLOWED_EMOJIS = ['😂', '👀', '🔥', '💀', '❤️'];
                if (!ALLOWED_EMOJIS.includes(event.emoji)) return context.chatLog;
                return context.chatLog.map((msg: any) => {
                  if (msg.id !== event.messageId) return msg;
                  const reactions: Record<string, string[]> = { ...(msg.reactions || {}) };
                  const reactors = reactions[event.emoji] ? [...reactions[event.emoji]] : [];
                  const idx = reactors.indexOf(event.senderId);
                  if (idx >= 0) {
                    reactors.splice(idx, 1);
                    if (reactors.length === 0) delete reactions[event.emoji];
                    else reactions[event.emoji] = reactors;
                  } else {
                    reactions[event.emoji] = [...reactors, event.senderId];
                  }
                  return { ...msg, reactions: Object.keys(reactions).length > 0 ? reactions : undefined };
                });
              },
            }),
            sendParent(({ event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => ({
              type: Events.Fact.RECORD,
              fact: {
                type: FactTypes.REACTION,
                actorId: event.senderId,
                payload: { messageId: event.messageId, emoji: event.emoji },
                timestamp: Date.now(),
              },
            })),
          ],
        },
      },
    },
  },
} as any);
