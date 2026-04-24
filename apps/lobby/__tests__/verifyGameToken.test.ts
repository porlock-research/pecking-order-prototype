import { describe, it, expect } from 'vitest';
import { SignJWT, errors as joseErrors } from 'jose';
import { signGameToken, verifyGameToken } from '@pecking-order/auth';

const SECRET = 'test-secret-for-verifyGameToken-tests';
const OTHER_SECRET = 'different-secret-for-signature-tests';

async function signExpired(secret: string) {
  // Produce a signed token whose exp is already in the past.
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    sub: 'user-1',
    gameId: 'game-1',
    playerId: 'p1',
    personaName: 'Test',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(key);
}

describe('verifyGameToken', () => {
  it('returns payload for a valid unexpired token', async () => {
    const token = await signGameToken(
      { sub: 'u', gameId: 'g', playerId: 'p1', personaName: 'X' },
      SECRET,
      '5m',
    );
    const payload = await verifyGameToken(token, SECRET);
    expect(payload.sub).toBe('u');
    expect(payload.gameId).toBe('g');
  });

  it('throws JWTExpired on expired token when ignoreExpiration is omitted', async () => {
    const token = await signExpired(SECRET);
    await expect(verifyGameToken(token, SECRET)).rejects.toBeInstanceOf(
      joseErrors.JWTExpired,
    );
  });

  it('returns payload for expired token when ignoreExpiration: true', async () => {
    const token = await signExpired(SECRET);
    const payload = await verifyGameToken(token, SECRET, { ignoreExpiration: true });
    expect(payload.sub).toBe('user-1');
    expect(payload.playerId).toBe('p1');
  });

  it('throws on bad signature regardless of ignoreExpiration', async () => {
    const token = await signGameToken(
      { sub: 'u', gameId: 'g', playerId: 'p1', personaName: 'X' },
      OTHER_SECRET,
      '5m',
    );
    await expect(verifyGameToken(token, SECRET)).rejects.toThrow();
    await expect(
      verifyGameToken(token, SECRET, { ignoreExpiration: true }),
    ).rejects.toThrow();
  });

  it('throws on malformed token regardless of ignoreExpiration', async () => {
    await expect(verifyGameToken('not.a.jwt', SECRET)).rejects.toThrow();
    await expect(
      verifyGameToken('not.a.jwt', SECRET, { ignoreExpiration: true }),
    ).rejects.toThrow();
  });

  it('throws on expired+bad-signature even with ignoreExpiration (signature check first)', async () => {
    const token = await signExpired(OTHER_SECRET);
    await expect(
      verifyGameToken(token, SECRET, { ignoreExpiration: true }),
    ).rejects.toThrow();
  });
});
