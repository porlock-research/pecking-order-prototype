import { describe, it, expect, vi } from 'vitest';

// Mock the Cloudflare env lookup so auth.ts's getSessionCookieName uses the
// DEFAULT_SESSION_COOKIE fallback or an override we provide per-test.
vi.mock('./db', () => ({
  getEnv: vi.fn(async () => ({})),
  getDB: vi.fn(),
}));

// Stub next/headers so auth.ts imports cleanly under Node (it only uses
// cookies() in code paths we don't exercise here).
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { setSessionCookie } from './auth';
import { getEnv } from './db';

function fakeResponse() {
  const set = vi.fn();
  return {
    response: { cookies: { set } } as any,
    set,
  };
}

describe('setSessionCookie', () => {
  it('on localhost uses insecure cookie without domain', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'localhost');
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, opts] = set.mock.calls[0];
    expect(name).toBe('po_session');
    expect(value).toBe('sid-abc');
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('on 127.0.0.1 is also treated as local', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', '127.0.0.1');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
  });

  it('on production hostname uses secure cookie + .peckingorder.ca domain', async () => {
    const { response, set } = fakeResponse();
    await setSessionCookie(response, 'sid-abc', 'lobby.peckingorder.ca');
    const [, , opts] = set.mock.calls[0];
    expect(opts.secure).toBe(true);
    expect(opts.domain).toBe('.peckingorder.ca');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
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
