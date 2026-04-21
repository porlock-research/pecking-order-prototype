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
