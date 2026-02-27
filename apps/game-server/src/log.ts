type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const METHODS: Record<LogLevel, 'debug' | 'log' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error',
};

export function log(
  level: LogLevel,
  component: string,
  event: string,
  data?: Record<string, unknown>,
) {
  const entry = { level, component, event, ...data };
  const prefix = `[${component}] ${event}`;
  console[METHODS[level]](prefix, JSON.stringify(entry));
}
