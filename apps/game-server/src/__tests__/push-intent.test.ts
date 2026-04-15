import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushToPlayer } from '../push-triggers';
import * as pushSend from '../push-send';
import * as d1 from '../d1-persistence';

vi.mock('../push-send');
vi.mock('../d1-persistence');

describe('pushToPlayer — intent threading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (d1.getPushSubscriptionD1 as any).mockResolvedValue({ endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } });
    (pushSend.sendPushNotification as any).mockResolvedValue('ok');
  });

  it('includes intent in payload.data when provided', async () => {
    await pushToPlayer(
      { roster: { p1: { realUserId: 'p1' } }, db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC' } as any,
      'p1',
      { title: 'Hi', body: 'Msg' },
      3600,
      { kind: 'dm', channelId: 'ch-1' },
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    const enriched = call[1];
    expect(enriched.intent).toBe(JSON.stringify({ kind: 'dm', channelId: 'ch-1' }));
  });

  it('omits intent when not provided', async () => {
    await pushToPlayer(
      { roster: { p1: {} }, db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC' } as any,
      'p1',
      { title: 'Hi', body: 'Msg' },
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(call[1].intent).toBeUndefined();
  });
});
