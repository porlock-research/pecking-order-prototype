import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notifyLobbyGameStatus } from '../lobby-callback';
import type { Env } from '../types';

// Minimal Env stub — only the fields lobby-callback reads.
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    GameServer: {} as any,
    DEMO_SERVER: {} as any,
    DB: {} as any,
    AUTH_SECRET: 'test-secret',
    AXIOM_DATASET: 'test',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_JWK: '',
    GAME_CLIENT_HOST: 'http://localhost:5173',
    LOBBY_HOST: 'http://localhost:3000',
    ...overrides,
  };
}

describe('notifyLobbyGameStatus', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips and resolves when LOBBY_HOST is unset', async () => {
    const env = makeEnv({ LOBBY_HOST: undefined });
    await notifyLobbyGameStatus(env, 'game-1', 'COMPLETED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when AUTH_SECRET is empty', async () => {
    const env = makeEnv({ AUTH_SECRET: '' });
    await notifyLobbyGameStatus(env, 'game-1', 'COMPLETED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs to <LOBBY_HOST>/api/internal/game-status with bearer auth + body', async () => {
    const env = makeEnv();
    await notifyLobbyGameStatus(env, 'game-abc', 'IN_PROGRESS');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/internal/game-status');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer test-secret');
    expect(JSON.parse(init.body as string)).toEqual({
      gameId: 'game-abc',
      status: 'IN_PROGRESS',
    });
  });

  it('does not throw on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const env = makeEnv();
    // Caller treats this as fire-and-forget — must not reject.
    await expect(
      notifyLobbyGameStatus(env, 'game-1', 'COMPLETED'),
    ).resolves.toBeUndefined();
  });

  it('does not throw on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const env = makeEnv();
    await expect(
      notifyLobbyGameStatus(env, 'game-1', 'COMPLETED'),
    ).resolves.toBeUndefined();
  });
});
