import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { signGameToken } from '@pecking-order/auth';

const AUTH_SECRET = 'test-secret-for-enter-route';
const OTHER_SECRET = 'different-secret-for-bad-signature';

type GameRow = { id: string; status: string };
type UserRow = { id: string };

function createMockDb(game: GameRow | null, users: UserRow[] = []) {
  const sessions: Array<{ id: string; user_id: string }> = [];
  return {
    sessions,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => {
              if (sql.startsWith('SELECT id, status FROM GameSessions')) {
                return game;
              }
              if (sql.startsWith('SELECT id FROM Users WHERE id = ?')) {
                const match = users.find((u) => u.id === args[0]);
                return match ?? null;
              }
              return null;
            },
            run: async () => {
              if (sql.startsWith('INSERT INTO Sessions')) {
                const [id, user_id] = args as [string, string];
                sessions.push({ id, user_id });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
            all: async () => ({ results: [] }),
          };
        },
      };
    },
    batch: async () => [],
  };
}

let mockDb: ReturnType<typeof createMockDb>;
let sessionReturn: { userId: string } | null = null;

vi.mock('@/lib/db', () => ({
  getEnv: vi.fn(async () => ({ AUTH_SECRET })),
  getDB: vi.fn(async () => mockDb),
}));

vi.mock('@/lib/auth', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/auth')>('@/lib/auth');
  return {
    ...actual,
    getSession: vi.fn(async () => sessionReturn),
    setSessionCookie: vi.fn(async () => {}),
    generateToken: () => 'fixed-session-id',
  };
});

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

// Import AFTER mocks so the route resolves against them.
import { GET, POST } from '@/app/enter/[code]/route';

const CODE = 'TESTCD';
const GAME_ID = 'game-test-1';
const USER_ID = 'user-1';

async function signExpiredFor(sub: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    sub,
    gameId: GAME_ID,
    playerId: 'p1',
    personaName: 'Test',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(key);
}

function postReq(code: string, form: FormData) {
  return new NextRequest(`http://localhost/enter/${code}`, {
    method: 'POST',
    body: form,
  });
}

function getReq(code: string) {
  return new NextRequest(`http://localhost/enter/${code}`, { method: 'GET' });
}

describe('/enter/[code]', () => {
  beforeEach(() => {
    mockDb = createMockDb({ id: GAME_ID, status: 'STARTED' }, [{ id: USER_ID }]);
    sessionReturn = null;
  });

  describe('GET', () => {
    it('no session → 307 /j/CODE', async () => {
      const res = await GET(getReq(CODE), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
    });

    it('session present → 307 /play/CODE', async () => {
      sessionReturn = { userId: USER_ID };
      const res = await GET(getReq(CODE), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain(`/play/${CODE}`);
    });
  });

  describe('POST', () => {
    it('existing session short-circuits regardless of hint', async () => {
      sessionReturn = { userId: USER_ID };
      const form = new FormData();
      form.set('hint', 'would-not-be-used');
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/play/${CODE}`);
      // No session should be minted — short-circuit happens BEFORE hint processing.
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('nonexistent game → 303 /login?error=Game+not+found', async () => {
      mockDb = createMockDb(null);
      const form = new FormData();
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('Game+not+found');
    });

    it('no hint + valid game → 303 /j/CODE (fall-through)', async () => {
      const form = new FormData();
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('empty hint + valid game → 303 /j/CODE', async () => {
      const form = new FormData();
      form.set('hint', '');
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('malformed hint → 303 /j/CODE (verify throws, caught)', async () => {
      const form = new FormData();
      form.set('hint', 'not.a.real.jwt');
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('bad-signature hint → 303 /j/CODE (rejected, no session)', async () => {
      const badHint = await signGameToken(
        { sub: USER_ID, gameId: GAME_ID, playerId: 'p1', personaName: 'X' },
        OTHER_SECRET,
        '5m',
      );
      const form = new FormData();
      form.set('hint', badHint);
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('expired-but-signature-valid hint for existing user → 303 /play/CODE + session created', async () => {
      const hint = await signExpiredFor(USER_ID, AUTH_SECRET);
      const form = new FormData();
      form.set('hint', hint);
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/play/${CODE}`);
      expect(mockDb.sessions).toHaveLength(1);
      expect(mockDb.sessions[0].user_id).toBe(USER_ID);
    });

    it('expired-but-signature-valid hint for MISSING user → 303 /j/CODE (no session)', async () => {
      mockDb = createMockDb({ id: GAME_ID, status: 'STARTED' }, []); // no users
      const hint = await signExpiredFor('ghost-user', AUTH_SECRET);
      const form = new FormData();
      form.set('hint', hint);
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('valid-unexpired hint for existing user → 303 /play/CODE + session created', async () => {
      const hint = await signGameToken(
        { sub: USER_ID, gameId: GAME_ID, playerId: 'p1', personaName: 'X' },
        AUTH_SECRET,
        '5m',
      );
      const form = new FormData();
      form.set('hint', hint);
      const res = await POST(postReq(CODE, form), { params: Promise.resolve({ code: CODE }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/play/${CODE}`);
      expect(mockDb.sessions).toHaveLength(1);
    });
  });
});
