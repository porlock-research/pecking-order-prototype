import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { Events, FactTypes, type Fact, type QaEntry } from '@pecking-order/shared-types';
import { pregameMachine } from '../l3-pregame';

const QA = (i: number): QaEntry => ({
  question: `Q${i}`,
  answer: `A${i}`,
} as QaEntry);

/** Wraps pregameMachine in a parent that captures bubbled FACT.RECORD events,
 *  so we can assert the journal emissions without spinning up L2. */
function createPregameHarness() {
  const wrapper = setup({
    types: {
      context: {} as { facts: Fact[] },
    },
    actors: { pregame: pregameMachine },
  }).createMachine({
    id: 'pregame-harness',
    context: { facts: [] },
    invoke: { id: 'l3-pregame', src: 'pregame' },
    on: {
      'FACT.RECORD': {
        actions: assign({
          facts: ({ context, event }: any) => [...context.facts, event.fact],
        }),
      },
    },
  } as any);
  const parent = createActor(wrapper).start();
  return {
    send: (event: any) => (parent.getSnapshot().children as any)['l3-pregame']!.send(event),
    facts: () => parent.getSnapshot().context.facts,
    pregame: () => (parent.getSnapshot().children as any)['l3-pregame']!.getSnapshot(),
    stop: () => parent.stop(),
  };
}

describe('l3-pregame — SYSTEM.PLAYER_JOINED', () => {
  it('records player into context.players with qaAnswers', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    const ctx: any = h.pregame().context;
    expect(ctx.players.p1).toBeDefined();
    expect(ctx.players.p1.qaAnswers).toHaveLength(3);
    expect(typeof ctx.players.p1.joinedAt).toBe('number');
    h.stop();
  });

  it('emits PREGAME_PLAYER_JOINED fact to parent', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p2', qaAnswers: [QA(0), QA(1)] },
    });
    const facts = h.facts();
    expect(facts).toHaveLength(1);
    expect(facts[0].type).toBe(FactTypes.PREGAME_PLAYER_JOINED);
    expect(facts[0].actorId).toBe('p2');
    expect((facts[0].payload as any).qaCount).toBe(2);
    h.stop();
  });

  it('handles missing qaAnswers gracefully (defaults to empty array)', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p3' },
    });
    const ctx: any = h.pregame().context;
    expect(ctx.players.p3.qaAnswers).toEqual([]);
    h.stop();
  });
});

describe('l3-pregame — PREGAME.REVEAL_ANSWER', () => {
  it('records reveal in context + emits PREGAME_REVEAL_ANSWER fact with full payload', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: 1 });

    const ctx: any = h.pregame().context;
    expect(ctx.revealedAnswers.p1).toMatchObject({
      qIndex: 1,
      question: 'Q1',
      answer: 'A1',
    });

    const facts = h.facts();
    const reveal = facts.find(f => f.type === FactTypes.PREGAME_REVEAL_ANSWER);
    expect(reveal).toBeDefined();
    expect(reveal!.actorId).toBe('p1');
    expect((reveal!.payload as any)).toMatchObject({
      qIndex: 1,
      question: 'Q1',
      answer: 'A1',
    });
    h.stop();
  });

  it('rejects reveal from a player who has not joined', () => {
    const h = createPregameHarness();
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'pX', qIndex: 0 });
    const ctx: any = h.pregame().context;
    expect(ctx.revealedAnswers).toEqual({});
    expect(h.facts()).toHaveLength(0);
    h.stop();
  });

  it('rejects reveal with out-of-range qIndex', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', qaAnswers: [QA(0)] },
    });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: 5 });
    expect(h.pregame().context.revealedAnswers).toEqual({});
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: -1 });
    expect(h.pregame().context.revealedAnswers).toEqual({});
    h.stop();
  });

  it('one-shot per player — second reveal is rejected', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: 0 });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: 2 });

    const ctx: any = h.pregame().context;
    expect(ctx.revealedAnswers.p1.qIndex).toBe(0); // first reveal sticks
    const reveals = h.facts().filter(f => f.type === FactTypes.PREGAME_REVEAL_ANSWER);
    expect(reveals).toHaveLength(1);
    h.stop();
  });

  it('different players can each reveal once', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', qaAnswers: [QA(0), QA(1)] },
    });
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p2', qaAnswers: [QA(0), QA(1)] },
    });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: 0 });
    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p2', qIndex: 1 });

    const ctx: any = h.pregame().context;
    expect(ctx.revealedAnswers.p1.qIndex).toBe(0);
    expect(ctx.revealedAnswers.p2.qIndex).toBe(1);
    h.stop();
  });
});

describe('l3-pregame — SOCIAL.WHISPER (v2)', () => {
  function seed(h: ReturnType<typeof createPregameHarness>) {
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', personaName: 'P1', qaAnswers: [] },
    });
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p2', personaName: 'P2', qaAnswers: [] },
    });
  }

  it('appends a whisper ChatMessage to chatLog + emits WHISPER fact upward', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.WHISPER, senderId: 'p1', targetId: 'p2', text: 'psst' });

    const ctx: any = h.pregame().context;
    expect(ctx.chatLog).toHaveLength(1);
    const msg = ctx.chatLog[0];
    expect(msg.senderId).toBe('p1');
    expect(msg.content).toBe('psst');
    expect(msg.whisperTarget).toBe('p2');
    expect(msg.channelId).toBe('MAIN');

    const whisperFact = h.facts().find(f => f.type === FactTypes.WHISPER);
    expect(whisperFact).toBeDefined();
    expect(whisperFact!.actorId).toBe('p1');
    expect(whisperFact!.targetId).toBe('p2');
    h.stop();
  });

  it('rejects whisper if sender or target is not in the pregame player set', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.WHISPER, senderId: 'pX', targetId: 'p2', text: 'ghost' });
    h.send({ type: Events.Social.WHISPER, senderId: 'p1', targetId: 'pZ', text: 'ghost' });
    expect(h.pregame().context.chatLog).toHaveLength(0);
    expect(h.facts().filter(f => f.type === FactTypes.WHISPER)).toHaveLength(0);
    h.stop();
  });

  it('rejects whisper to self, or with empty text', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.WHISPER, senderId: 'p1', targetId: 'p1', text: 'me' });
    h.send({ type: Events.Social.WHISPER, senderId: 'p1', targetId: 'p2', text: '' });
    expect(h.pregame().context.chatLog).toHaveLength(0);
    h.stop();
  });

  it('seeds MAIN channel with WHISPER capability on spawn', () => {
    const h = createPregameHarness();
    const ctx: any = h.pregame().context;
    expect(ctx.channels.MAIN).toBeDefined();
    expect(ctx.channels.MAIN.capabilities).toContain('WHISPER');
    h.stop();
  });

  it('adds each joined player to MAIN.memberIds (enables the whisper flow)', () => {
    const h = createPregameHarness();
    seed(h);
    const ctx: any = h.pregame().context;
    expect(ctx.channels.MAIN.memberIds.sort()).toEqual(['p1', 'p2']);
    h.stop();
  });
});

describe('l3-pregame — SOCIAL.SEND_MSG (group chat)', () => {
  function seed(h: ReturnType<typeof createPregameHarness>) {
    h.send({ type: Events.System.PLAYER_JOINED, player: { id: 'p1', personaName: 'Alex', qaAnswers: [] } });
    h.send({ type: Events.System.PLAYER_JOINED, player: { id: 'p2', personaName: 'Sam',  qaAnswers: [] } });
  }

  it('MAIN channel carries CHAT + REACTIONS + WHISPER capabilities', () => {
    const h = createPregameHarness();
    const caps = h.pregame().context.channels.MAIN.capabilities;
    expect(caps).toEqual(expect.arrayContaining(['CHAT', 'REACTIONS', 'WHISPER']));
    h.stop();
  });

  it('appends message to chatLog and emits CHAT_MSG fact', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.SEND_MSG, senderId: 'p1', content: 'hey cast' });
    const ctx: any = h.pregame().context;
    expect(ctx.chatLog).toHaveLength(1);
    expect(ctx.chatLog[0].content).toBe('hey cast');
    expect(ctx.chatLog[0].channelId).toBe('MAIN');
    expect(ctx.chatLog[0].whisperTarget).toBeUndefined();
    const f = h.facts().find(x => x.type === FactTypes.CHAT_MSG);
    expect(f).toBeDefined();
    expect(f!.actorId).toBe('p1');
    expect((f!.payload as any).channelId).toBe('MAIN');
    h.stop();
  });

  it('resolves @mention personaNames into payload.mentionedIds', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.SEND_MSG, senderId: 'p1', content: 'hey @Sam how are you' });
    const f = h.facts().find(x => x.type === FactTypes.CHAT_MSG);
    expect((f!.payload as any).mentionedIds).toEqual(['p2']);
    h.stop();
  });

  it('rejects a DM-shaped payload (recipientIds or targetId present)', () => {
    const h = createPregameHarness();
    seed(h);
    h.send({ type: Events.Social.SEND_MSG, senderId: 'p1', content: 'dm attempt', recipientIds: ['p2'] } as any);
    h.send({ type: Events.Social.SEND_MSG, senderId: 'p1', content: 'dm attempt', targetId: 'p2' } as any);
    expect(h.pregame().context.chatLog).toHaveLength(0);
    expect(h.facts().filter(f => f.type === FactTypes.CHAT_MSG)).toHaveLength(0);
    h.stop();
  });
});

describe('l3-pregame — SOCIAL.REACT', () => {
  function seedWithMsg(h: ReturnType<typeof createPregameHarness>) {
    h.send({ type: Events.System.PLAYER_JOINED, player: { id: 'p1', personaName: 'P1', qaAnswers: [] } });
    h.send({ type: Events.System.PLAYER_JOINED, player: { id: 'p2', personaName: 'P2', qaAnswers: [] } });
    h.send({ type: Events.Social.SEND_MSG, senderId: 'p1', content: 'hi' });
    return h.pregame().context.chatLog[0].id as string;
  }

  it('adds the emoji reactor to the message and emits a REACTION fact', () => {
    const h = createPregameHarness();
    const msgId = seedWithMsg(h);
    h.send({ type: Events.Social.REACT, senderId: 'p2', messageId: msgId, emoji: '🔥' });
    const msg = h.pregame().context.chatLog[0];
    expect(msg.reactions['🔥']).toEqual(['p2']);
    expect(h.facts().some(f => f.type === FactTypes.REACTION)).toBe(true);
    h.stop();
  });

  it('toggles a reactor off on second send (same emoji + same sender)', () => {
    const h = createPregameHarness();
    const msgId = seedWithMsg(h);
    h.send({ type: Events.Social.REACT, senderId: 'p2', messageId: msgId, emoji: '🔥' });
    h.send({ type: Events.Social.REACT, senderId: 'p2', messageId: msgId, emoji: '🔥' });
    const msg = h.pregame().context.chatLog[0];
    expect(msg.reactions).toBeUndefined();
    h.stop();
  });
});

describe('l3-pregame — SYSTEM.PLAYER_CONNECTED auto-reveal (v3)', () => {
  it('on first connect with qaAnswers, picks a random qIndex and emits PREGAME_REVEAL_ANSWER', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', personaName: 'P1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });

    const ctx: any = h.pregame().context;
    expect(ctx.players.p1.firstConnectedAt).toBeTypeOf('number');
    const reveal = ctx.revealedAnswers.p1;
    expect(reveal).toBeDefined();
    expect(reveal.qIndex).toBeGreaterThanOrEqual(0);
    expect(reveal.qIndex).toBeLessThan(3);
    // Question + answer match the picked qIndex from the player's QAs
    expect(reveal.question).toBe(`Q${reveal.qIndex}`);
    expect(reveal.answer).toBe(`A${reveal.qIndex}`);

    const fact = h.facts().find(f => f.type === FactTypes.PREGAME_REVEAL_ANSWER);
    expect(fact).toBeDefined();
    expect(fact!.actorId).toBe('p1');
    expect((fact!.payload as any).qIndex).toBe(reveal.qIndex);
    h.stop();
  });

  it('is idempotent: second PLAYER_CONNECTED does not change the recorded reveal', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', personaName: 'P1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });
    const firstReveal = h.pregame().context.revealedAnswers.p1;
    const firstStamp = h.pregame().context.players.p1.firstConnectedAt;

    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });

    const ctx: any = h.pregame().context;
    expect(ctx.players.p1.firstConnectedAt).toBe(firstStamp);
    expect(ctx.revealedAnswers.p1).toEqual(firstReveal);
    const reveals = h.facts().filter(f => f.type === FactTypes.PREGAME_REVEAL_ANSWER);
    expect(reveals).toHaveLength(1); // Only the first connect emitted a fact
    h.stop();
  });

  it('player without qaAnswers gets firstConnectedAt set but no reveal', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', personaName: 'P1', qaAnswers: [] },
    });
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });

    const ctx: any = h.pregame().context;
    expect(ctx.players.p1.firstConnectedAt).toBeTypeOf('number');
    expect(ctx.revealedAnswers.p1).toBeUndefined();
    expect(h.facts().filter(f => f.type === FactTypes.PREGAME_REVEAL_ANSWER)).toHaveLength(0);
    h.stop();
  });

  it('PLAYER_CONNECTED for unknown player is a no-op', () => {
    const h = createPregameHarness();
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'pX' });
    const ctx: any = h.pregame().context;
    expect(ctx.players.pX).toBeUndefined();
    expect(ctx.revealedAnswers).toEqual({});
    h.stop();
  });

  it('after auto-reveal, manual REVEAL_ANSWER for the same player is rejected (defense in depth)', () => {
    const h = createPregameHarness();
    h.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: 'p1', personaName: 'P1', qaAnswers: [QA(0), QA(1), QA(2)] },
    });
    h.send({ type: Events.System.PLAYER_CONNECTED, playerId: 'p1' });
    const autoQIdx = h.pregame().context.revealedAnswers.p1.qIndex;
    const otherIdx = (autoQIdx + 1) % 3;

    h.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p1', qIndex: otherIdx });

    // canRevealAnswer guard rejects (already in revealedAnswers); reveal sticks
    expect(h.pregame().context.revealedAnswers.p1.qIndex).toBe(autoQIdx);
    h.stop();
  });
});
