import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Minimal D1 mock. Represents a single InviteTokens row and the side-effect
// log of writes so tests can assert "token not consumed" vs "token consumed".
type InviteRow = {
  token: string;
  email: string;
  game_id: string;
  invite_code: string;
  expires_at: number;
  used: number;
};

function createMockDb(invite: InviteRow | null) {
  const log: Array<{ sql: string; args: unknown[] }> = [];
  const users = new Map<string, { id: string }>();
  const sessions: Array<{ id: string; user_id: string }> = [];
  let inviteState = invite ? { ...invite } : null;

  const db = {
    log,
    get invite() {
      return inviteState;
    },
    sessions,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          log.push({ sql, args });
          return {
            first: async () => {
              if (sql.startsWith('SELECT token, email, game_id, invite_code, expires_at, used')) {
                return inviteState && inviteState.token === args[0] ? inviteState : null;
              }
              if (sql.startsWith('SELECT id FROM Users WHERE email = ?')) {
                return users.get(args[0] as string) ?? null;
              }
              return null;
            },
            run: async () => {
              if (sql.startsWith('UPDATE InviteTokens SET used = 1')) {
                if (inviteState && inviteState.token === args[0]) {
                  inviteState = { ...inviteState, used: 1 };
                }
                return { success: true };
              }
              if (sql.startsWith('INSERT INTO Users')) {
                const [id, email] = args as [string, string];
                users.set(email, { id });
                return { success: true };
              }
              if (sql.startsWith('UPDATE Users SET last_login_at')) {
                return { success: true };
              }
              if (sql.startsWith('INSERT INTO Sessions')) {
                const [id, user_id] = args as [string, string];
                sessions.push({ id, user_id });
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return db;
}

let mockInvite: InviteRow | null = null;
let mockDb: ReturnType<typeof createMockDb>;

vi.mock('@/lib/db', () => ({
  getEnv: vi.fn(async () => ({})),
  getDB: vi.fn(async () => mockDb),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Import AFTER mocks so the route's getDB resolves to ours.
import { GET, POST } from '@/app/invite/[token]/route';

const VALID_TOKEN = 'a'.repeat(64);
const INVITE_CODE = 'ABC123';
const GAME_ID = 'game-1';

function freshInvite(overrides?: Partial<InviteRow>): InviteRow {
  return {
    token: VALID_TOKEN,
    email: 'test@example.com',
    game_id: GAME_ID,
    invite_code: INVITE_CODE,
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
    used: 0,
    ...overrides,
  };
}

function req(method: 'GET' | 'POST', token: string, body?: FormData) {
  const url = `http://localhost/invite/${token}`;
  return new NextRequest(url, { method, body });
}

describe('/invite/[token]', () => {
  beforeEach(() => {
    mockInvite = null;
    mockDb = createMockDb(null);
  });

  describe('GET', () => {
    it('unknown token → redirect to /login with invalid error', async () => {
      mockDb = createMockDb(null);
      const res = await GET(req('GET', 'nope'), { params: Promise.resolve({ token: 'nope' }) });
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=Invalid+invite+link');
    });

    it('expired token → redirect to /login with expired error', async () => {
      mockDb = createMockDb(freshInvite({ expires_at: Date.now() - 60_000 }));
      const res = await GET(req('GET', VALID_TOKEN), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=Invite+link+expired');
      // Token must not be consumed on GET for any branch.
      expect(mockDb.invite?.used).toBe(0);
    });

    it('already-used token → redirect to /j/CODE', async () => {
      mockDb = createMockDb(freshInvite({ used: 1 }));
      const res = await GET(req('GET', VALID_TOKEN), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain(`/j/${INVITE_CODE}`);
    });

    it('valid-unused token → 200 HTML, token STILL unused', async () => {
      mockDb = createMockDb(freshInvite());
      const res = await GET(req('GET', VALID_TOKEN), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain(`/invite/${VALID_TOKEN}`);
      expect(body).toContain(`Continue to game ${INVITE_CODE}`);
      // The critical assertion — GET must never consume the token.
      expect(mockDb.invite?.used).toBe(0);
      const updates = mockDb.log.filter((l) => l.sql.startsWith('UPDATE InviteTokens'));
      expect(updates).toHaveLength(0);
    });
  });

  describe('POST', () => {
    it('unknown token → 303 to /login with invalid error', async () => {
      mockDb = createMockDb(null);
      const form = new FormData();
      const res = await POST(req('POST', 'nope', form), {
        params: Promise.resolve({ token: 'nope' }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('/login?error=Invalid+invite+link');
    });

    it('expired token → 303 to /login with expired error, token not consumed', async () => {
      mockDb = createMockDb(freshInvite({ expires_at: Date.now() - 60_000 }));
      const form = new FormData();
      const res = await POST(req('POST', VALID_TOKEN, form), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('/login?error=Invite+link+expired');
      expect(mockDb.invite?.used).toBe(0);
    });

    it('already-used token → 303 to /j/CODE, idempotent (no session created)', async () => {
      mockDb = createMockDb(freshInvite({ used: 1 }));
      const form = new FormData();
      const res = await POST(req('POST', VALID_TOKEN, form), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/j/${INVITE_CODE}`);
      expect(mockDb.sessions).toHaveLength(0);
    });

    it('valid-unused token → 303 to /join/CODE, token consumed, session created, cookie set', async () => {
      mockDb = createMockDb(freshInvite());
      const form = new FormData();
      const res = await POST(req('POST', VALID_TOKEN, form), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain(`/join/${INVITE_CODE}`);
      expect(mockDb.invite?.used).toBe(1);
      expect(mockDb.sessions).toHaveLength(1);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('po_session=');
    });

    it('POST twice in rapid succession → second hits already-used branch (single session)', async () => {
      mockDb = createMockDb(freshInvite());
      const form1 = new FormData();
      await POST(req('POST', VALID_TOKEN, form1), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      const form2 = new FormData();
      const res2 = await POST(req('POST', VALID_TOKEN, form2), {
        params: Promise.resolve({ token: VALID_TOKEN }),
      });
      expect(res2.status).toBe(303);
      expect(res2.headers.get('location')).toContain(`/j/${INVITE_CODE}`);
      expect(mockDb.sessions).toHaveLength(1);
    });
  });
});
