/**
 * Snapshot persistence — read/write game state to DO SQLite storage.
 * Handles the KV → SQL migration path for pre-ADR-092 games.
 */
import { normalizeManifest } from "@pecking-order/shared-types";
import { log } from "./log";

const LEGACY_KV_KEY = "game_state_snapshot";

/** Ensure the snapshots table exists. */
export function ensureSnapshotsTable(storage: DurableObjectStorage): void {
  storage.sql.exec(`CREATE TABLE IF NOT EXISTS snapshots (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
}

/**
 * Read a snapshot string from SQL, falling back to legacy KV storage.
 * If found in KV, migrates it to SQL and deletes the KV key.
 */
export async function readSnapshot(storage: DurableObjectStorage): Promise<string | undefined> {
  // SQL first
  const sqlRows = storage.sql.exec(
    "SELECT value FROM snapshots WHERE key = 'game_state'"
  ).toArray();
  const sqlValue = sqlRows[0]?.value as string | undefined;
  if (sqlValue) return sqlValue;

  // KV fallback — lazily migrate on first wake after deploy
  const kvValue = await storage.get<string>(LEGACY_KV_KEY);
  if (kvValue) {
    storage.sql.exec(
      `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('game_state', ?, unixepoch())`,
      kvValue
    );
    await storage.delete(LEGACY_KV_KEY);
    log('info', 'L1', 'Migrated snapshot from KV to SQL');
  }
  return kvValue;
}

/**
 * Read goldCredited flag from SQL, falling back to legacy KV.
 * If found in KV, migrates it to SQL and deletes the KV key.
 */
export async function readGoldCredited(storage: DurableObjectStorage): Promise<boolean> {
  const goldRows = storage.sql.exec(
    "SELECT value FROM snapshots WHERE key = 'gold_credited'"
  ).toArray();
  if (goldRows.length > 0) {
    return goldRows[0].value === 'true';
  }

  // KV fallback
  const kvGold = await storage.get<boolean>('goldCredited');
  if (kvGold) {
    storage.sql.exec(
      `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('gold_credited', 'true', unixepoch())`
    );
    await storage.delete('goldCredited');
    log('info', 'L1', 'Migrated goldCredited from KV to SQL');
    return true;
  }
  return false;
}

/** Generic boolean-flag reader for the `snapshots` key/value table. */
function readBooleanFlag(storage: DurableObjectStorage, key: string): boolean {
  const rows = storage.sql.exec(
    "SELECT value FROM snapshots WHERE key = ?",
    key,
  ).toArray();
  return rows.length > 0 && rows[0].value === 'true';
}

/** Issue #49 idempotency flags — split per side so a transient failure on
 *  one path doesn't strand the other. */
export function readD1CompletionWritten(storage: DurableObjectStorage): boolean {
  return readBooleanFlag(storage, 'd1_completion_written');
}
export function readLobbyCompletionNotified(storage: DurableObjectStorage): boolean {
  return readBooleanFlag(storage, 'lobby_completion_notified');
}
export function readLobbyStartedNotified(storage: DurableObjectStorage): boolean {
  return readBooleanFlag(storage, 'lobby_started_notified');
}

/** Result of parsing a stored snapshot for actor restoration. */
export interface ParsedSnapshot {
  l2Snapshot: any;
  chatLog: any[] | undefined;
  tickerHistory: any[] | undefined;
  gameId: string;
}

/** Parse a raw snapshot string into its constituent parts. */
export function parseSnapshot(snapshotStr: string): ParsedSnapshot {
  const storedData = JSON.parse(snapshotStr);
  let l2Snapshot = storedData;
  let chatLog: any[] | undefined;

  if (storedData.l2) {
    l2Snapshot = storedData.l2;
    chatLog = storedData.l3Context?.chatLog;
  }
  if (chatLog) {
    l2Snapshot.context.restoredChatLog = chatLog;
  }

  // Normalize legacy manifests (no `kind` field) to StaticManifest
  if (l2Snapshot?.context?.manifest) {
    l2Snapshot.context.manifest = normalizeManifest(l2Snapshot.context.manifest);
  }

  let gameId = 'unknown';
  try {
    gameId = l2Snapshot?.context?.gameId || 'unknown';
  } catch { /* ignore */ }

  return {
    l2Snapshot,
    chatLog,
    tickerHistory: storedData.tickerHistory,
    gameId,
  };
}
