// Structured log helper for lobby routes. Emits single-line JSON that
// Workers Logs + Axiom ingest with top-level fields for easy querying.
// Shape mirrors the `log(level, component, event, data?)` convention
// documented in the root CLAUDE.md, adapted to Next.js on Cloudflare
// (OpenNext) — which doesn't currently expose the game-server logger.

type Level = 'info' | 'warn' | 'error';

// The number of leading characters from a secret token to include in
// structured logs. Enough uniqueness to join against D1.InviteTokens.token
// (64-hex) or MagicLinks.token without writing the full secret. Callers
// should use `token.slice(0, LOG_TOKEN_PREFIX_LEN)`.
export const LOG_TOKEN_PREFIX_LEN = 8;

export function log(
  level: Level,
  component: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ level, component, event, ...(data ?? {}) }));
}
