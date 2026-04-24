'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';

// D1Database type isn't available in the lobby's TS config (no @cloudflare/workers-types).
// We type it loosely here — all D1 usage is via prepared statements which are untyped anyway.

export interface D1RunResult {
  success: boolean;
  meta?: { changes?: number; rows_written?: number; duration?: number };
}

export interface D1PreparedResult {
  run(): Promise<D1RunResult>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export type D1 = {
  prepare(sql: string): D1PreparedResult & {
    bind(...values: unknown[]): D1PreparedResult;
  };
  batch(stmts: unknown[]): Promise<unknown[]>;
};

/**
 * Get Cloudflare environment bindings (D1, R2, env vars).
 * Retries once on failure — the OpenNext dev bridge caches a global proxy
 * that can go stale after HMR reloads. Resetting the cached context symbol
 * forces re-initialization on retry.
 */
export async function getEnv(): Promise<Record<string, unknown>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as Record<string, unknown>;
  } catch (err) {
    // Reset the cached context and retry once
    const CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');
    delete (globalThis as any)[CONTEXT_SYMBOL];
    const { env } = await getCloudflareContext({ async: true });
    return env as Record<string, unknown>;
  }
}

export async function getDB(): Promise<D1> {
  const env = await getEnv();
  return env.DB as D1;
}
