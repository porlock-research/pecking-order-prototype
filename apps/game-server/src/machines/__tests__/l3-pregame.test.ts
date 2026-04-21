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
