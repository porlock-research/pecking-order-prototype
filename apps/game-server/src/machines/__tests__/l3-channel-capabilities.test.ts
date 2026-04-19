import { describe, it, expect } from 'vitest';
import { createActor, setup } from 'xstate';
import { buildL3Context, dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
import { Events } from '@pecking-order/shared-types';

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const BASE_DAY: DailyManifest = {
  dayIndex: 1,
  theme: 'Day 1',
  voteType: 'MAJORITY',
  gameType: 'NONE',
  timeline: [],
};

const parentWrapper = setup({
  types: {
    context: {} as { l3Ref: any },
    events: {} as any,
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest: DailyManifest },
  },
  actors: {
    l3: dailySessionMachine,
  },
}).createMachine({
  id: 'test-parent',
  context: { l3Ref: null },
  initial: 'running',
  states: {
    running: {
      invoke: {
        id: 'l3-session',
        src: 'l3',
        input: ({ event }: any) => event.input || {},
      },
      on: { '*': {} },
    },
    done: { type: 'final' },
  },
} as any);

function createL3Actor() {
  const input = { dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY };
  const parentActor = createActor(parentWrapper, { input });
  parentActor.start();
  return {
    send: (event: any) => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      if (l3Child) (l3Child as any).send(event);
    },
    getL3Context: () => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      return l3Child ? (l3Child as any).getSnapshot().context : undefined;
    },
  };
}

describe('Channel capabilities', () => {
  it('MAIN channel is created with NUDGE and WHISPER capabilities', () => {
    const ctx = buildL3Context({ dayIndex: 0, roster: makeRoster(2), manifest: BASE_DAY });
    const caps = ctx.channels['MAIN'].capabilities ?? [];
    expect(caps).toContain('CHAT');
    expect(caps).toContain('REACTIONS');
    expect(caps).toContain('SILVER_TRANSFER');
    expect(caps).toContain('NUDGE');
    expect(caps).toContain('WHISPER');
  });

  it('DM channel is created with NUDGE capability (non-invite mode)', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p0',
      content: 'Hi',
      recipientIds: ['p1'],
    });
    const ctx = actor.getL3Context();
    const dm = Object.values(ctx.channels).find((c: any) => c.type === 'DM') as any;
    expect(dm).toBeDefined();
    expect(dm.capabilities).toContain('NUDGE');
    expect(dm.capabilities).toContain('SILVER_TRANSFER');
  });

  it('GROUP_DM is created WITHOUT NUDGE capability', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p0',
      content: 'Hi all',
      recipientIds: ['p1', 'p2'],
    });
    const ctx = actor.getL3Context();
    const gdm = Object.values(ctx.channels).find((c: any) => c.type === 'GROUP_DM') as any;
    expect(gdm).toBeDefined();
    expect(gdm.capabilities).not.toContain('NUDGE');
  });

  it('WHISPER is rejected when MAIN loses WHISPER capability', () => {
    const actor = createL3Actor();
    // Open DMs so the gate this test is probing (capability) is the ONLY reason to reject.
    actor.send({ type: Events.Internal.OPEN_DMS } as any);
    // Mutate MAIN's capabilities to simulate cap removal.
    const ctx = actor.getL3Context();
    (ctx.channels['MAIN'] as any).capabilities = ['CHAT', 'REACTIONS'];

    actor.send({
      type: Events.Social.WHISPER,
      senderId: 'p0',
      targetId: 'p1',
      text: 'hi',
    } as any);

    const after = actor.getL3Context();
    const whispers = after.chatLog.filter((m: any) => m.whisperTarget);
    expect(whispers).toHaveLength(0);
  });

  it('WHISPER is rejected when DMs are closed, even with the WHISPER capability', () => {
    const actor = createL3Actor();
    // Do NOT open DMs. Whisper delivers as a DM; when DMs are closed,
    // the server must reject the event regardless of channel capabilities.
    actor.send({
      type: Events.Social.WHISPER,
      senderId: 'p0',
      targetId: 'p1',
      text: 'hi',
    } as any);

    const ctx = actor.getL3Context();
    const whispers = ctx.chatLog.filter((m: any) => m.whisperTarget);
    expect(whispers).toHaveLength(0);
    expect(ctx.dmsOpen).toBe(false);
  });

  it('WHISPER succeeds when MAIN has WHISPER capability and DMs are open', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS } as any);
    actor.send({
      type: Events.Social.WHISPER,
      senderId: 'p0',
      targetId: 'p1',
      text: 'secret',
    } as any);

    const ctx = actor.getL3Context();
    const whispers = ctx.chatLog.filter((m: any) => m.whisperTarget);
    expect(whispers.length).toBeGreaterThan(0);
  });
});
