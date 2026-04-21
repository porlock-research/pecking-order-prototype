import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { Events, type QaEntry } from '@pecking-order/shared-types';
import { orchestratorMachine } from '../machines/l2-orchestrator';
import { buildSyncPayload, extractCartridges, extractL3Context } from '../sync';

const QA = (i: number): QaEntry => ({ question: `Q${i}`, answer: `A${i}` } as QaEntry);

const minimalStaticManifest = {
  kind: 'STATIC',
  scheduling: 'ADMIN',
  days: [],
} as any;

const minimalRoster = {
  p1: { id: 'p1', personaName: 'P1', avatarUrl: '', status: 'ALIVE', silver: 50, gold: 0, realUserId: 'u1' },
};

function buildSyncDeps(actor: ReturnType<typeof createActor<typeof orchestratorMachine>>) {
  const snapshot = actor.getSnapshot();
  const cartridges = extractCartridges(snapshot);
  const { l3Context, l3Snapshot } = extractL3Context(snapshot, []);
  return {
    snapshot,
    l3Context,
    l3SnapshotValue: l3Snapshot?.value,
    chatLog: [],
    cartridges,
  };
}

function bootIntoPregameWithReveals() {
  const actor = createActor(orchestratorMachine);
  actor.start();
  actor.send({
    type: Events.System.INIT,
    payload: { roster: minimalRoster, manifest: minimalStaticManifest },
    gameId: 'test-game',
    inviteCode: 'TEST',
  } as any);
  actor.send({
    type: Events.System.PLAYER_JOINED,
    player: {
      id: 'p2', realUserId: 'u2', personaName: 'P2', avatarUrl: '', bio: '',
      silver: 50, gold: 0, qaAnswers: [QA(0), QA(1)],
    },
  } as any);
  actor.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p2', qIndex: 0 } as any);
  return actor;
}

describe('SYNC payload — pregame projection', () => {
  it('includes pregame slice during phase==="pregame" with reveals + players', () => {
    const actor = bootIntoPregameWithReveals();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');

    expect(payload.phase).toBe('pregame');
    expect(payload.context.pregame).toBeDefined();
    expect(payload.context.pregame.revealedAnswers.p2).toMatchObject({
      qIndex: 0,
      question: 'Q0',
      answer: 'A0',
    });
    expect(payload.context.pregame.players.p2).toBeDefined();
    expect(typeof payload.context.pregame.players.p2.joinedAt).toBe('number');
    actor.stop();
  });

  it('strips qaAnswers from the pregame.players projection (kept only on roster)', () => {
    const actor = bootIntoPregameWithReveals();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');

    // The SYNC pregame.players projection is intentionally minimal — qaAnswers
    // already live on the roster, so duplicating them in the slice would
    // bloat the payload (especially with 15+ players).
    const p2Pregame = payload.context.pregame.players.p2;
    expect((p2Pregame as any).qaAnswers).toBeUndefined();

    // Roster still has them.
    expect(payload.context.roster.p2.qaAnswers).toHaveLength(2);
    actor.stop();
  });

  it('omits the pregame slice once L2 transitions to dayLoop', () => {
    const actor = bootIntoPregameWithReveals();
    actor.send({ type: Events.System.WAKEUP } as any);

    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');

    // l3-pregame is dead — slice must NOT appear (use 'in' to distinguish
    // missing from explicit-null).
    expect('pregame' in payload.context).toBe(false);
    expect(payload.phase).not.toBe('pregame');
    actor.stop();
  });

  it('every connected player gets the same pregame slice (it is public, not per-recipient)', () => {
    const actor = bootIntoPregameWithReveals();
    const deps = buildSyncDeps(actor);
    const p1Payload = buildSyncPayload(deps, 'p1');
    const p2Payload = buildSyncPayload(deps, 'p2');

    expect(p1Payload.context.pregame).toEqual(p2Payload.context.pregame);
    actor.stop();
  });
});

// v2 — roster qaAnswers.answer redaction (locked/revealed states on the dossier).
describe('SYNC payload — v2 roster qaAnswers redaction during pregame', () => {
  function setupWithP1AndP2QAs() {
    // Build a game mirroring the real production flow: /init with an EMPTY
    // roster, then each player's /player-joined fires SYSTEM.PLAYER_JOINED
    // individually. l3-pregame's players map is built from those PLAYER_JOINED
    // events, so the whisper/reveal guards can see participants.
    const actor = createActor(orchestratorMachine);
    actor.start();
    actor.send({
      type: Events.System.INIT,
      payload: { roster: {}, manifest: minimalStaticManifest },
      gameId: 'test-game',
      inviteCode: 'TEST',
    } as any);
    actor.send({
      type: Events.System.PLAYER_JOINED,
      player: {
        id: 'p1', realUserId: 'u1', personaName: 'P1', avatarUrl: '', bio: '',
        silver: 50, gold: 0, qaAnswers: [QA(0), QA(1), QA(2)],
      },
    } as any);
    actor.send({
      type: Events.System.PLAYER_JOINED,
      player: {
        id: 'p2', realUserId: 'u2', personaName: 'P2', avatarUrl: '', bio: '',
        silver: 50, gold: 0, qaAnswers: [QA(0), QA(1), QA(2)],
      },
    } as any);
    actor.send({ type: Events.Pregame.REVEAL_ANSWER, senderId: 'p2', qIndex: 1 } as any);
    return actor;
  }

  it('viewer sees own qaAnswers.answer intact (always)', () => {
    const actor = setupWithP1AndP2QAs();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');
    expect(payload.context.roster.p1.qaAnswers).toHaveLength(3);
    for (const qa of payload.context.roster.p1.qaAnswers) {
      expect(qa.answer).not.toBe('');
    }
    actor.stop();
  });

  it("strips other players' un-revealed answers but keeps revealed one", () => {
    const actor = setupWithP1AndP2QAs();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');
    const p2qa = payload.context.roster.p2.qaAnswers;
    expect(p2qa).toHaveLength(3);
    expect(p2qa[0].question).toBe('Q0');  // question always visible
    expect(p2qa[0].answer).toBe('');       // unrevealed → stripped
    expect(p2qa[1].question).toBe('Q1');
    expect(p2qa[1].answer).toBe('A1');     // revealed → visible
    expect(p2qa[2].answer).toBe('');       // unrevealed → stripped
    actor.stop();
  });

  it('passes roster through unchanged once L2 leaves preGame (no redaction after Day 1)', () => {
    const actor = setupWithP1AndP2QAs();
    actor.send({ type: Events.System.WAKEUP } as any);
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');
    // After WAKEUP, phase is not pregame, so the redaction passthrough
    // doesn't run — full answers should be visible again.
    const p2qa = payload.context.roster.p2.qaAnswers;
    expect(p2qa[0].answer).toBe('A0');
    expect(p2qa[2].answer).toBe('A2');
    actor.stop();
  });
});

// v2 — pregame chatLog projection via whispers.
describe('SYNC payload — v2 pregame whisper chatLog merge', () => {
  function setupWithWhisper() {
    // Real flow: /init with empty roster, then /player-joined for each.
    const actor = createActor(orchestratorMachine);
    actor.start();
    actor.send({
      type: Events.System.INIT,
      payload: { roster: {}, manifest: minimalStaticManifest },
      gameId: 'test-game',
      inviteCode: 'TEST',
    } as any);
    for (const id of ['p1', 'p2', 'p3']) {
      actor.send({
        type: Events.System.PLAYER_JOINED,
        player: { id, realUserId: 'u' + id, personaName: id.toUpperCase(), avatarUrl: '', bio: '', silver: 50, gold: 0 },
      } as any);
    }
    // p1 whispers to p2. p3 is a bystander.
    actor.send({ type: Events.Social.WHISPER, senderId: 'p1', targetId: 'p2', text: 'meet me at the pool' } as any);
    return actor;
  }

  it('sender sees whisper content intact in SYNC chatLog', () => {
    const actor = setupWithWhisper();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');
    const msg = payload.context.chatLog.find((m: any) => m.whisperTarget === 'p2');
    expect(msg).toBeDefined();
    expect(msg.content).toBe('meet me at the pool');
    expect(msg.redacted).toBeFalsy();
    actor.stop();
  });

  it('target sees whisper content intact', () => {
    const actor = setupWithWhisper();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p2');
    const msg = payload.context.chatLog.find((m: any) => m.whisperTarget === 'p2');
    expect(msg).toBeDefined();
    expect(msg.content).toBe('meet me at the pool');
    expect(msg.redacted).toBeFalsy();
    actor.stop();
  });

  it('bystander sees redacted whisper (content stripped)', () => {
    const actor = setupWithWhisper();
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p3');
    const msg = payload.context.chatLog.find((m: any) => m.whisperTarget === 'p2');
    expect(msg).toBeDefined();
    expect(msg.content).toBe('');
    expect(msg.redacted).toBe(true);
    actor.stop();
  });

  it('pregame chatLog disappears once L2 leaves preGame', () => {
    const actor = setupWithWhisper();
    actor.send({ type: Events.System.WAKEUP } as any);
    const payload = buildSyncPayload(buildSyncDeps(actor), 'p1');
    // Post-pregame, l3-pregame is dead and its chatLog is not projected.
    // The only chatLog would come from l3-session (empty in this test fixture).
    const whisperAfterStart = payload.context.chatLog.find((m: any) => m.whisperTarget === 'p2');
    expect(whisperAfterStart).toBeUndefined();
    actor.stop();
  });
});
