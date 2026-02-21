import { SignJWT, jwtVerify, decodeJwt } from 'jose';

// ── Game Token (lobby → client → game server) ──────────────────────────

export interface GameTokenPayload {
  sub: string;        // userId
  gameId: string;
  playerId: string;   // e.g. "p1"
  personaName: string;
  iat?: number;
  exp?: number;
}

export async function signGameToken(
  payload: Pick<GameTokenPayload, 'sub' | 'gameId' | 'playerId' | 'personaName'>,
  secret: string,
  expiresIn: string = '30d',
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyGameToken(
  token: string,
  secret: string,
): Promise<GameTokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as GameTokenPayload;
}

/** Client-side decode (no verification — for display only) */
export function decodeGameToken(token: string): GameTokenPayload {
  return decodeJwt(token) as unknown as GameTokenPayload;
}

// ── Session Token (lobby cookie) ────────────────────────────────────────

export interface SessionPayload {
  sub: string;   // userId
  sid: string;   // sessionId
  iat?: number;
  exp?: number;
}

export async function signSessionToken(
  payload: Pick<SessionPayload, 'sub' | 'sid'>,
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as SessionPayload;
}
