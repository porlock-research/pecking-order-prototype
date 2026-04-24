import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPushNotification } from '../push-send';

// @pushforge/builder does real crypto inside buildPushHTTPRequest; stub it
// out so these tests only exercise the response-status branching.
vi.mock('@pushforge/builder', () => ({
  buildPushHTTPRequest: vi.fn(async () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    headers: {},
    body: new Uint8Array(),
  })),
}));

const SUB = { endpoint: 'x', keys: { p256dh: 'x', auth: 'x' } };
const PAYLOAD = { title: 'hi' };
const VAPID = '{}';

function mockFetch(status: number) {
  return vi.fn(async () => new Response(null, { status }));
}

describe('sendPushNotification — response status branching', () => {
  const origFetch = globalThis.fetch;
  const origError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    console.error = origError;
  });

  it('returns "sent" on 200/201', async () => {
    globalThis.fetch = mockFetch(200) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('sent');
    globalThis.fetch = mockFetch(201) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('sent');
  });

  it('returns "expired" on 404 and 410 (RFC 8030 subscription-gone)', async () => {
    globalThis.fetch = mockFetch(404) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('expired');
    globalThis.fetch = mockFetch(410) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('expired');
  });

  it('returns "expired" on 403 — FCM token revoked (playtest LR8W3U regression)', async () => {
    globalThis.fetch = mockFetch(403) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('expired');
    // No error-level log; expired is a silent prune signal upstream.
    expect(console.error).not.toHaveBeenCalled();
  });

  it('returns "error" for unexpected non-gone statuses (e.g., 500)', async () => {
    globalThis.fetch = mockFetch(500) as any;
    expect(await sendPushNotification(SUB, PAYLOAD, VAPID)).toBe('error');
    expect(console.error).toHaveBeenCalled();
  });
});
