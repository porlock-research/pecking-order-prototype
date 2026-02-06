import { Axiom } from '@axiomhq/js';

// Define a simplified ExecutionContext interface for Cloudflare Workers
// This avoids needing the full @cloudflare/workers-types in this package
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

const AXIOM_DATASET = "pecking-order";

// Lazy initialization of Axiom client to avoid issues during build time
let axiomClient: Axiom | null = null;

function getAxiom() {
  if (!axiomClient && process.env.AXIOM_TOKEN) {
    axiomClient = new Axiom({
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
    });
  }
  return axiomClient;
}

export interface LogMeta {
  layer: "L1" | "L2" | "L3" | "CLIENT" | "LOBBY";
  userId?: string;
  gameId?: string;
  [key: string]: any;
}

export function log(
  ctx: ExecutionContext | null,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  message: string,
  meta: LogMeta
) {
  const timestamp = new Date().toISOString();
  const payload = { timestamp, level, message, ...meta };

  // 1. Console Output (visible in Cloudflare Tail / Dev Tools)
  console.log(JSON.stringify(payload));

  // 2. Axiom Ingestion (Async)
  // Only attempt if context and token exist
  if (ctx && process.env.AXIOM_TOKEN) {
    const axiom = getAxiom();
    if (axiom) {
      const promise = axiom.ingest(AXIOM_DATASET, [payload]);
      // Wrap in a promise to handle errors safely without breaking types if ingest returns void/unknown
      const safePromise = Promise.resolve(promise).catch((err: any) => {
        console.error("Failed to ship logs to Axiom", err);
      });
      ctx.waitUntil(safePromise);
    }
  }
}
