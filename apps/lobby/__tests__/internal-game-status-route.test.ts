import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type GameRow = { id: string; status: string };

function createMockDb(initial: GameRow | null) {
  const log: Array<{ sql: string; args: unknown[] }> = [];
  let row = initial ? { ...initial } : null;

  const db = {
    log,
    get row() {
      return row;
    },
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          log.push({ sql, args });
          return {
            first: async () => {
              if (sql.startsWith('SELECT id, status FROM GameSessions WHERE id = ?')) {
                return row && row.id === args[0] ? row : null;
              }
              return null;
            },
            run: async () => {
              if (sql.startsWith('UPDATE GameSessions SET status = ? WHERE id = ?')) {
                if (row && row.id === args[1]) {
                  row = { ...row, status: args[0] as string };
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  return db;
}

let mockDb: ReturnType<typeof createMockDb>;

vi.mock('@/lib/db', () => ({
  getEnv: vi.fn(async () => ({ AUTH_SECRET: 'test-secret' })),
  getDB: vi.fn(async () => mockDb),
}));

// Import after mocks so the route's getDB resolves to ours.
import { POST } from '@/app/api/internal/game-status/route';

const GAME_ID = 'game-1';

function req(body: unknown, authHeader?: string) {
  return new NextRequest('http://localhost/api/internal/game-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/internal/game-status', () => {
  beforeEach(() => {
    mockDb = createMockDb(null);
  });

  describe('auth', () => {
    it('401 on missing Authorization header', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'RECRUITING' });
      const res = await POST(req({ gameId: GAME_ID, status: 'IN_PROGRESS' }));
      expect(res.status).toBe(401);
      // Row must NOT be touched — auth check comes before DB access.
      expect(mockDb.row?.status).toBe('RECRUITING');
    });

    it('401 on wrong secret', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'RECRUITING' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer wrong-secret'),
      );
      expect(res.status).toBe(401);
      expect(mockDb.row?.status).toBe('RECRUITING');
    });

    it('401 on length-mismatched secret (timingSafeBearer)', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'RECRUITING' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer x'),
      );
      expect(res.status).toBe(401);
      expect(mockDb.row?.status).toBe('RECRUITING');
    });

    it('500 misconfigured when AUTH_SECRET is unset', async () => {
      const { getEnv } = await import('@/lib/db');
      vi.mocked(getEnv).mockResolvedValueOnce({} as any);
      mockDb = createMockDb({ id: GAME_ID, status: 'RECRUITING' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('misconfigured');
      // Critical: route must NOT touch the DB when fail-closed.
      expect(mockDb.row?.status).toBe('RECRUITING');
    });
  });

  describe('payload validation', () => {
    it('400 on invalid JSON body', async () => {
      const res = await POST(req('not-json{', 'Bearer test-secret'));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('invalid_json');
    });

    it('400 on missing gameId', async () => {
      const res = await POST(req({ status: 'IN_PROGRESS' }, 'Bearer test-secret'));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('missing_gameId');
    });

    it('400 on unknown status value', async () => {
      const res = await POST(
        req({ gameId: GAME_ID, status: 'BOGUS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('invalid_status');
    });
  });

  describe('happy path', () => {
    it('IN_PROGRESS lifts RECRUITING → STARTED (covers CC #49)', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'RECRUITING' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; previous: string; current: string };
      expect(body).toEqual({ ok: true, previous: 'RECRUITING', current: 'STARTED' });
      expect(mockDb.row?.status).toBe('STARTED');
    });

    it('IN_PROGRESS lifts READY → STARTED', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'READY' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      expect(mockDb.row?.status).toBe('STARTED');
    });

    it('COMPLETED lifts STARTED → COMPLETED (the canonical #49 fix)', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'STARTED' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'COMPLETED' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; previous: string; current: string };
      expect(body).toEqual({ ok: true, previous: 'STARTED', current: 'COMPLETED' });
      expect(mockDb.row?.status).toBe('COMPLETED');
    });
  });

  describe('idempotency', () => {
    it('IN_PROGRESS on already-STARTED game is a no-op', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'STARTED' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; unchanged: boolean; current: string };
      expect(body).toEqual({ ok: true, unchanged: true, current: 'STARTED' });
      // No UPDATE issued.
      const updates = mockDb.log.filter((l) => l.sql.startsWith('UPDATE'));
      expect(updates).toHaveLength(0);
    });

    it('COMPLETED on already-COMPLETED game is a no-op', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'COMPLETED' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'COMPLETED' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { unchanged: boolean };
      expect(body.unchanged).toBe(true);
    });

    it('COMPLETED on ARCHIVED game does NOT regress to COMPLETED', async () => {
      // Admin-archived games are terminal — out-of-order callbacks must not
      // bounce them backward to COMPLETED.
      mockDb = createMockDb({ id: GAME_ID, status: 'ARCHIVED' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'COMPLETED' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { unchanged: boolean; current: string };
      expect(body.unchanged).toBe(true);
      expect(body.current).toBe('ARCHIVED');
      expect(mockDb.row?.status).toBe('ARCHIVED');
    });

    it('IN_PROGRESS on COMPLETED game does NOT regress', async () => {
      // Late-arriving init callback after the game already ended.
      mockDb = createMockDb({ id: GAME_ID, status: 'COMPLETED' });
      const res = await POST(
        req({ gameId: GAME_ID, status: 'IN_PROGRESS' }, 'Bearer test-secret'),
      );
      expect(res.status).toBe(200);
      expect(mockDb.row?.status).toBe('COMPLETED');
    });
  });

  it('404 on unknown game (cleanup race)', async () => {
    mockDb = createMockDb(null);
    const res = await POST(
      req({ gameId: 'unknown', status: 'COMPLETED' }, 'Bearer test-secret'),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body).toEqual({ ok: false, reason: 'game_not_found' });
  });
});
