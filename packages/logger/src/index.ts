import { Axiom } from '@axiomhq/js';

// Define a simplified ExecutionContext interface for Cloudflare Workers
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

const AXIOM_DATASET = "pecking-order";

export interface LogMeta {
  layer: "L1" | "L2" | "L3" | "CLIENT" | "LOBBY";
  userId?: string;
  gameId?: string;
  [key: string]: any;
}

export interface LoggerEnv {
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
  [key: string]: any;
}

// Internal cache for Axiom client to avoid re-initializing
let axiomClient: Axiom | null = null;

function getAxiom(env?: LoggerEnv) {
  // Try to find the token in the passed env or global process.env
  const token = env?.AXIOM_TOKEN || (typeof process !== 'undefined' ? process.env?.AXIOM_TOKEN : undefined);
  const orgId = env?.AXIOM_ORG_ID || (typeof process !== 'undefined' ? process.env?.AXIOM_ORG_ID : undefined);

  if (!axiomClient && token) {
    axiomClient = new Axiom({
      token,
      orgId,
    });
  }
  return axiomClient;
}

/**
 * Structured Logging Utility.
 * Supports both Console (Tail Workers) and Axiom (Async Ingestion).
 * 
 * @param ctx - ExecutionContext (for waitUntil) or null if not available
 * @param level - Log Level
 * @param message - Human readable message
 * @param meta - Structured metadata
 * @param env - Optional environment object (required for Cloudflare Workers/PartyKit if not using process.env)
 */
export function log(
  ctx: ExecutionContext | null,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  message: string,
  meta: LogMeta,
  env?: LoggerEnv
) {
  const timestamp = new Date().toISOString();
  const payload = { timestamp, level, message, ...meta };

  // 1. Console Output (visible in Cloudflare Tail / Dev Tools)
  // We use console.error for ERROR/WARN to make them pop in logs
  if (level === "ERROR" || level === "WARN") {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }

  // 2. Axiom Ingestion (Async)
  // Only attempt if context is available to keep the worker alive
  if (ctx) {
    const axiom = getAxiom(env);
    if (axiom) {
      const promise = axiom.ingest(AXIOM_DATASET, [payload]);
      // Wrap in a promise to handle errors safely without breaking the request
      const safePromise = Promise.resolve(promise).catch((err: any) => {
        // Silently fail or log to console if Axiom fails, don't crash the app
        console.error("Failed to ship logs to Axiom", err);
      });
      ctx.waitUntil(safePromise);
    }
  }
}