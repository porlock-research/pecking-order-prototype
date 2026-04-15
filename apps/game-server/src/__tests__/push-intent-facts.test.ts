import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFactPush } from '../push-triggers';
import * as pushSend from '../push-send';
import * as d1 from '../d1-persistence';
import { FactTypes } from '@pecking-order/shared-types';

vi.mock('../push-send');
vi.mock('../d1-persistence');

const makeCtx = () => ({
  roster: { p1: { realUserId: 'p1', personaName: 'Alice' }, p2: { realUserId: 'p2', personaName: 'Bob' } },
  db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC',
});

beforeEach(() => {
  vi.resetAllMocks();
  (d1.getPushSubscriptionD1 as any).mockResolvedValue({ endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } });
  (pushSend.sendPushNotification as any).mockResolvedValue('ok');
});

describe('handleFactPush intent construction', () => {
  it('DM_SENT → dm intent with channelId', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.DM_SENT, actorId: 'p2', targetId: 'p1', payload: { channelId: 'DM-p1-p2', content: 'hi' } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'dm', channelId: 'DM-p1-p2' });
  });

  it('DM_INVITE_SENT → dm_invite intent with senderId', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.DM_INVITE_SENT, actorId: 'p2', payload: { memberIds: ['p1'] } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'dm_invite', senderId: 'p2' });
  });

  it('ELIMINATION → elimination_reveal with dayIndex', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.ELIMINATION, targetId: 'p2', payload: { dayIndex: 3 } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'elimination_reveal', dayIndex: 3 });
  });

  it('WINNER_DECLARED → winner_reveal scalar', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.WINNER_DECLARED, targetId: 'p2' },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'winner_reveal' });
  });
});
