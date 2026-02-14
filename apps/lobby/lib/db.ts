'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';

// D1Database type isn't available in the lobby's TS config (no @cloudflare/workers-types).
// We type it loosely here — all D1 usage is via prepared statements which are untyped anyway.

interface D1PreparedResult {
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

type D1 = {
  prepare(sql: string): D1PreparedResult & {
    bind(...values: unknown[]): D1PreparedResult;
  };
  batch(stmts: unknown[]): Promise<unknown[]>;
};

export async function getEnv(): Promise<Record<string, unknown>> {
  const { env } = await getCloudflareContext({ async: true });
  return env as Record<string, unknown>;
}

export async function getDB(): Promise<D1> {
  const env = await getEnv();
  return env.DB as D1;
}
