type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const METHODS: Record<LogLevel, 'debug' | 'log' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error',
};

/**
 * Structured logger for game-server.
 *
 * Outputs a single JSON object per call so that Cloudflare Workers Logs
 * can auto-extract and index every field. Axiom then receives each field
 * as a queryable column (e.g. `| where component == "L2"`).
 */
export function log(
  level: LogLevel,
  component: string,
  event: string,
  data?: Record<string, unknown>,
) {
  console[METHODS[level]](JSON.stringify({ level, component, event, ...data }));
}
