import { describe, it, expect, beforeEach } from 'vitest';
import { checkAnonymousRateLimit, hashIp, recordAnonymousCreate } from './rate-limit';

// Minimal D1 mock — enough for SELECT COUNT and INSERT queries in this module.
function createMockDb() {
  const inserts: Array<{ ip_hash: string; created_at: number }> = [];

  const mock = {
    inserts,
    prepare(_sql: string) {
      return {
        bind(...args: any[]) {
          return {
            first: async () => {
              // SELECT COUNT(*) from AnonymousCreates WHERE ip_hash = ? AND created_at > ?
              const [ipHash, sinceMs] = args;
              const count = inserts.filter(
                (r) => r.ip_hash === ipHash && r.created_at > sinceMs,
              ).length;
              return { count };
            },
            run: async () => {
              // INSERT INTO AnonymousCreates (ip_hash, created_at) VALUES (?, ?)
              const [ipHash, createdAt] = args;
              inserts.push({ ip_hash: ipHash, created_at: createdAt });
              return {};
            },
          };
        },
      };
    },
  };

  return mock;
}

describe('rate-limit', () => {
  describe('hashIp', () => {
    it('is deterministic', async () => {
      const a = await hashIp('1.2.3.4');
      const b = await hashIp('1.2.3.4');
      expect(a).toBe(b);
    });

    it('produces 64-hex SHA-256', async () => {
      const h = await hashIp('1.2.3.4');
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]+$/);
    });

    it('distinguishes distinct IPs', async () => {
      const a = await hashIp('1.2.3.4');
      const b = await hashIp('1.2.3.5');
      expect(a).not.toBe(b);
    });
  });

  describe('checkAnonymousRateLimit', () => {
    let db: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      db = createMockDb();
    });

    it('allows first request from a new IP', async () => {
      const result = await checkAnonymousRateLimit(db as any, '1.2.3.4');
      expect(result.allowed).toBe(true);
    });

    it('allows repeat requests below the limit', async () => {
      for (let i = 0; i < 9; i++) {
        await recordAnonymousCreate(db as any, '1.2.3.4');
      }
      const result = await checkAnonymousRateLimit(db as any, '1.2.3.4');
      expect(result.allowed).toBe(true);
    });

    it('blocks once limit reached', async () => {
      for (let i = 0; i < 10; i++) {
        await recordAnonymousCreate(db as any, '1.2.3.4');
      }
      const result = await checkAnonymousRateLimit(db as any, '1.2.3.4');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('tracks distinct IPs independently', async () => {
      for (let i = 0; i < 10; i++) {
        await recordAnonymousCreate(db as any, '1.2.3.4');
      }
      const blocked = await checkAnonymousRateLimit(db as any, '1.2.3.4');
      const allowed = await checkAnonymousRateLimit(db as any, '5.6.7.8');
      expect(blocked.allowed).toBe(false);
      expect(allowed.allowed).toBe(true);
    });
  });
});
