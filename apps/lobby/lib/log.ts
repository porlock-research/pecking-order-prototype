// Structured log helper for lobby routes. Emits single-line JSON that
// Workers Logs + Axiom ingest with top-level fields for easy querying.
// Shape mirrors the `log(level, component, event, data?)` convention
// documented in the root CLAUDE.md, adapted to Next.js on Cloudflare
// (OpenNext) — which doesn't currently expose the game-server logger.

type Level = 'info' | 'warn' | 'error';

export function log(
  level: Level,
  component: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ level, component, event, ...(data ?? {}) }));
}
