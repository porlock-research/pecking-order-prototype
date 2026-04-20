import { describe, it, expect } from 'vitest';
import { createActor, setup } from 'xstate';
import { dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
import { Events, PlayerStatuses } from '@pecking-order/shared-types';

function makeRoster(ids: string[]): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      id,
      personaName: `P${i}`,
      avatarUrl: '',
      status: PlayerStatuses.ALIVE,
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  });
  return out;
}

const BASE_MANIFEST: DailyManifest = {
  dayIndex: 2,
  theme: 'Day 2',
  voteType: 'MAJORITY',
  gameType: 'NONE',
  timeline: [],
} as any;

const parentWrapper = setup({
  types: {
    context: {} as { l3Ref: any },
    events: {} as any,
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest: DailyManifest },
  },
  actors: { l3: dailySessionMachine },
}).createMachine({
  id: 'test-parent',
  context: { l3Ref: null },
  initial: 'running',
  states: {
    running: {
      invoke: { id: 'l3-session', src: 'l3', input: ({ event }: any) => event.input || {} },
      on: { '*': {} },
    },
    done: { type: 'final' },
  },
} as any);

function bootPhase(ids: string[]) {
  const input = { dayIndex: 2, roster: makeRoster(ids), manifest: BASE_MANIFEST };
  const parent = createActor(parentWrapper, { input });
  parent.start();
  const l3 = () => parent.getSnapshot().children['l3-session'] as any;
  l3()?.send({ type: Events.Internal.START_CONFESSION_CHAT });
  // Open DMs + group chat so other SOCIAL handlers aren't blocked by those gates —
  // isolating the capability check as the only rejection reason.
  l3()?.send({ type: Events.Internal.OPEN_DMS });
  l3()?.send({ type: Events.Internal.OPEN_GROUP_CHAT });
  return {
    send: (e: any) => l3()?.send(e),
    getL3Context: () => l3()?.getSnapshot().context,
  };
}

describe('POST validation chain — end-to-end via l3-session guard', () => {
  it('accepts a valid POST from an alive member', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'hi' });
    const posts = actor.getL3Context().confessionPhase.posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].text).toBe('hi');
  });

  it('rejects when the phase is not active (never entered posting)', () => {
    const input = { dayIndex: 2, roster: makeRoster(['p1', 'p2']), manifest: BASE_MANIFEST };
    const parent = createActor(parentWrapper, { input });
    parent.start();
    const l3 = () => parent.getSnapshot().children['l3-session'] as any;
    l3()?.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'x' });
    expect(l3()?.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when channel does not exist', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'WRONG-ID', text: 'x' });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when sender is not a member of memberIds', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p99', channelId: 'CONFESSION-d2', text: 'x' });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when text exceeds maxConfessionLength (281 chars)', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'a'.repeat(281) });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(0);
  });

  it('accepts text at exactly 280 chars', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'a'.repeat(280) });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(1);
  });

  it('rejects empty text', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: '' });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(0);
  });
});

describe('CONFESSION channel rejects non-CONFESS capability events', () => {
  // CONFESSION channel has capabilities = ['CONFESS'] only.
  // Each of these events is guarded by an existing capability check in l3-social or elsewhere,
  // so targeting a CONFESSION channel must fail without mutating state.

  it('SOCIAL.SEND_MSG on CONFESSION channel → no chat message appended', () => {
    const actor = bootPhase(['p1', 'p2']);
    const before = actor.getL3Context().chatLog.length;
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p1',
      channelId: 'CONFESSION-d2',
      content: 'leak',
    });
    const after = actor.getL3Context().chatLog.length;
    expect(after).toBe(before);
  });

  it('SOCIAL.SEND_SILVER on CONFESSION channel → no silver deducted', () => {
    const actor = bootPhase(['p1', 'p2']);
    const before = actor.getL3Context().roster.p1.silver;
    actor.send({
      type: Events.Social.SEND_SILVER,
      senderId: 'p1',
      targetId: 'p2',
      amount: 10,
      channelId: 'CONFESSION-d2',
    });
    expect(actor.getL3Context().roster.p1.silver).toBe(before);
  });

  it('SOCIAL.ADD_MEMBER on CONFESSION channel → membership unchanged', () => {
    const actor = bootPhase(['p1', 'p2', 'p3']);
    const beforeMembers = [...actor.getL3Context().channels['CONFESSION-d2'].memberIds].sort();
    actor.send({
      type: Events.Social.ADD_MEMBER,
      senderId: 'p1',
      channelId: 'CONFESSION-d2',
      memberIds: ['p3'],
    } as any);
    const afterMembers = [...actor.getL3Context().channels['CONFESSION-d2'].memberIds].sort();
    expect(afterMembers).toEqual(beforeMembers);
  });

  it('SOCIAL.REACT on CONFESSION channel → no reaction recorded on a post', () => {
    const actor = bootPhase(['p1', 'p2']);
    // First record a post so there is something that could, in principle, be reacted to.
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'secret' });
    const post = actor.getL3Context().confessionPhase.posts[0];
    expect(post).toBeDefined();
    // Attempt a reaction — should be a no-op (CONFESSION channel lacks REACTIONS capability).
    const reactionsBefore = JSON.stringify((post as any).reactions ?? null);
    actor.send({
      type: Events.Social.REACT,
      senderId: 'p2',
      messageId: post.handle + ':' + post.ts,
      emoji: '👀',
      channelId: 'CONFESSION-d2',
    } as any);
    const reactionsAfter = JSON.stringify((actor.getL3Context().confessionPhase.posts[0] as any).reactions ?? null);
    expect(reactionsAfter).toBe(reactionsBefore);
  });

  // NOTE on NUDGE / WHISPER: those handlers don't route by event.channelId — their
  // capability check is hardcoded against MAIN (see l3-social.ts `isNudgeAllowed` /
  // `isWhisperAllowed`). They are not channel-targeted events in the way SEND_MSG /
  // SEND_SILVER / ADD_MEMBER are, so "rejection when channelId is CONFESSION-d2" is
  // not a meaningful assertion — the handler ignores the channelId field entirely.
  // The CONFESSION channel's capability set being `['CONFESS']` only governs events
  // that actually resolve via event.channelId.
});

describe('CONFESSION.POST on non-CONFESSION channel is rejected by guard', () => {
  it('POST with channelId=MAIN → no post recorded, MAIN unaffected', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'MAIN', text: 'x' });
    expect(actor.getL3Context().confessionPhase.posts).toHaveLength(0);
  });
});
