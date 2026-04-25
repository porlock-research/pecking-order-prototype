import { describe, it, expect, vi } from 'vitest';

// Mock the Cloudflare env lookup so auth.ts's getSessionCookieName uses the
// DEFAULT_SESSION_COOKIE fallback or an override we provide per-test.
vi.mock('./db', () => ({
  getEnv: vi.fn(async () => ({})),
  getDB: vi.fn(),
}));

// Shared spy for the server-action cookies() API. Individual tests can
// reset it via cookiesSetSpy.mockClear().
const cookiesSetSpy = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: cookiesSetSpy,
    delete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { setSessionCookie, setSessionCookieOnRequest } from './auth';
import { getEnv } from './db';

function fakeResponse() {
  const set = vi.fn();
  return {
    response: { cookies: { set } } as any,
    set,
  };
}

const COMMON_EXPECTATIONS = (opts: any) => {
  expect(opts.httpOnly).toBe(true);
  expect(opts.sameSite).toBe('lax');
  expect(opts.path).toBe('/');
  expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
};

describe('setSessionCookie (response.cookies)', () => {
  it('on localhost uses insecure cookie without domain', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'localhost');
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, opts] = set.mock.calls[0];
    expect(name).toBe('po_session');
    expect(value).toBe('sid-abc');
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
    COMMON_EXPECTATIONS(opts);
  });

  it('on 127.0.0.1 and ::1 loopbacks are treated as local', async () => {
    for (const host of ['127.0.0.1', '::1']) {
      const { response, set } = fakeResponse();
      await setSessionCookie(response, 'sid-abc', host);
      const [, , opts] = set.mock.calls[0];
      expect(opts.secure).toBe(false);
      expect(opts.domain).toBeUndefined();
    }
  });

  it('on Tailscale *.ts.net is treated as local', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'manus-macbook.tail0abcd.ts.net');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
  });

  it('on mDNS *.local is treated as local', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'manus-macbook.local');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
  });

  it.each([
    '10.0.0.4',
    '10.255.255.255',
    '192.168.1.20',
    '172.16.0.1',
    '172.31.255.1',
  ])('on RFC1918 %s is treated as local', async (host) => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', host);
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
  });

  it.each([
    '172.15.0.1', // just outside the 172.16–31 range
    '172.32.0.1',
    '11.0.0.1',
    '193.168.0.1',
  ])('on non-RFC1918 %s is NOT treated as local', async (host) => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', host);
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(true);
    expect(opts.domain).toBe('.peckingorder.ca');
  });

  it('on production hostname uses secure cookie + .peckingorder.ca domain', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'lobby.peckingorder.ca');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(true);
    expect(opts.domain).toBe('.peckingorder.ca');
    COMMON_EXPECTATIONS(opts);
  });

  it('on staging hostname is treated as production', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'staging-lobby.peckingorder.ca');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(true);
    expect(opts.domain).toBe('.peckingorder.ca');
  });

  it('honours SESSION_COOKIE_NAME env override', async () => {
    vi.mocked(getEnv).mockResolvedValueOnce({ SESSION_COOKIE_NAME: 'po_session_staging' });
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'lobby.peckingorder.ca');
    const [name] = set.mock.calls[0];
    expect(name).toBe('po_session_staging');
  });
});

describe('setSessionCookieOnRequest (server-action cookies())', () => {
  it('on localhost uses insecure cookie without domain', async () => {
    cookiesSetSpy.mockClear();
    await setSessionCookieOnRequest('sid-abc', 'localhost');
    expect(cookiesSetSpy).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookiesSetSpy.mock.calls[0];
    expect(name).toBe('po_session');
    expect(value).toBe('sid-abc');
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
    COMMON_EXPECTATIONS(opts);
  });

  it('on production hostname uses secure cookie + .peckingorder.ca domain', async () => {
    cookiesSetSpy.mockClear();
    await setSessionCookieOnRequest('sid-abc', 'lobby.peckingorder.ca');
    const [, , opts] = cookiesSetSpy.mock.calls[0];
    expect(opts.secure).toBe(true);
    expect(opts.domain).toBe('.peckingorder.ca');
    COMMON_EXPECTATIONS(opts);
  });

  it('on Tailscale hostname is treated as local (fixes claimSeat secure:true-over-HTTP bug)', async () => {
    cookiesSetSpy.mockClear();
    await setSessionCookieOnRequest('sid-abc', 'manus-macbook.tail0abcd.ts.net');
    const [, , opts] = cookiesSetSpy.mock.calls[0];
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
  });

  it('mirrors setSessionCookie option matrix', async () => {
    cookiesSetSpy.mockClear();
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'lobby.peckingorder.ca');
    await setSessionCookieOnRequest('sid-abc', 'lobby.peckingorder.ca');
    const respOpts = set.mock.calls[0][2];
    const reqOpts = cookiesSetSpy.mock.calls[0][2];
    expect(reqOpts).toEqual(respOpts);
  });
});
