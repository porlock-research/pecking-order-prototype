/**
 * D1 persistence — journal writes, game lifecycle, SPY_DMS query.
 * All methods are fire-and-forget (log errors, don't throw).
 */

import { FactTypes } from '@pecking-order/shared-types';

const JOURNALABLE_TYPES = [
  FactTypes.SILVER_TRANSFER, FactTypes.VOTE_CAST, FactTypes.ELIMINATION, FactTypes.DM_SENT,
  FactTypes.POWER_USED, FactTypes.PERK_USED, FactTypes.GAME_RESULT, FactTypes.PLAYER_GAME_RESULT,
  FactTypes.WINNER_DECLARED, FactTypes.PROMPT_RESULT,
];

/** Returns true if the fact type should be persisted to the D1 journal. */
export function isJournalable(factType: string): boolean {
  return (JOURNALABLE_TYPES as readonly string[]).includes(factType);
}

/** Insert a fact into the GameJournal table. Fire-and-forget. */
export function persistFactToD1(
  db: D1Database,
  gameId: string,
  dayIndex: number,
  fact: any,
): void {
  db.prepare(
    `INSERT INTO GameJournal (id, game_id, day_index, timestamp, event_type, actor_id, target_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    gameId,
    dayIndex,
    fact.timestamp,
    fact.type,
    fact.actorId,
    fact.targetId || null,
    JSON.stringify(fact.payload || {}),
  ).run().catch(err => {
    console.error("[L1] Failed to write to Journal:", err);
  });
}

/** Query the last 3 DMs sent by a target player (for SPY_DMS perk). */
export async function querySpyDms(
  db: D1Database,
  gameId: string,
  targetId: string,
): Promise<Array<{ from: string; to: string; content: string; timestamp: number }>> {
  const results: any = await db.prepare(
    `SELECT actor_id, target_id, payload, timestamp FROM GameJournal
     WHERE game_id = ? AND event_type = 'DM_SENT' AND actor_id = ?
     ORDER BY timestamp DESC LIMIT 3`
  ).bind(gameId, targetId).all();

  return (results.results || []).map((r: any) => ({
    from: r.actor_id,
    to: r.target_id,
    content: JSON.parse(r.payload || '{}').content || '',
    timestamp: r.timestamp,
  }));
}

/** Insert Game + Player rows on POST /init. Fire-and-forget. */
export function insertGameAndPlayers(
  db: D1Database,
  gameId: string,
  mode: string,
  roster: Record<string, any>,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO Games (id, mode, status, created_at) VALUES (?, ?, 'IN_PROGRESS', ?)`
  ).bind(gameId, mode, Date.now()).run().catch((err: any) =>
    console.error('[L1] Failed to insert Game row:', err)
  );

  const playerStmt = db.prepare(
    `INSERT OR IGNORE INTO Players (game_id, player_id, real_user_id, persona_name, avatar_url, status, silver, gold, destiny_id)
     VALUES (?, ?, ?, ?, ?, 'ALIVE', ?, ?, ?)`
  );
  const batch = Object.entries(roster).map(([pid, p]: [string, any]) =>
    playerStmt.bind(gameId, pid, p.realUserId || '', p.personaName || '', p.avatarUrl || '', p.silver || 50, p.gold || 0, p.destinyId || null)
  );
  if (batch.length > 0) {
    db.batch(batch).catch((err: any) =>
      console.error('[L1] Failed to insert Player rows:', err)
    );
  }
}

// --- Push Subscriptions (D1-backed, replaces DO storage) ---

export async function savePushSubscriptionD1(
  db: D1Database,
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  const now = Date.now();
  await db.prepare(
    `INSERT INTO PushSubscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET endpoint=excluded.endpoint, p256dh=excluded.p256dh, auth=excluded.auth, updated_at=excluded.updated_at`
  ).bind(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now, now).run();
}

export async function deletePushSubscriptionD1(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db.prepare('DELETE FROM PushSubscriptions WHERE user_id = ?').bind(userId).run();
}

export async function getPushSubscriptionD1(
  db: D1Database,
  userId: string,
): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } } | null> {
  const row = await db.prepare(
    'SELECT endpoint, p256dh, auth FROM PushSubscriptions WHERE user_id = ?'
  ).bind(userId).first<{ endpoint: string; p256dh: string; auth: string }>();
  if (!row) return null;
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

/** Read gold balances for a set of real user IDs. Returns Map<realUserId, gold>. */
export async function readGoldBalances(
  db: D1Database,
  realUserIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (realUserIds.length === 0) return result;

  // D1 doesn't support array binds — batch individual queries
  const stmts = realUserIds.map(id =>
    db.prepare('SELECT real_user_id, gold FROM UserWallets WHERE real_user_id = ?').bind(id)
  );
  try {
    const results = await db.batch(stmts);
    for (const res of results) {
      const row = (res.results as any)?.[0];
      if (row) result.set(row.real_user_id, row.gold);
    }
  } catch (err) {
    console.error('[L1] Failed to read gold balances:', err);
  }
  return result;
}

/** Credit gold to a player's wallet (additive). Upserts into UserWallets. */
export async function creditGold(
  db: D1Database,
  realUserId: string,
  goldAmount: number,
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO UserWallets (real_user_id, gold, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(real_user_id) DO UPDATE SET gold = gold + ?, updated_at = ?`
    ).bind(realUserId, goldAmount, Date.now(), goldAmount, Date.now()).run();
  } catch (err) {
    console.error('[L1] Failed to credit gold:', err);
  }
}

/** Update Games status to COMPLETED and Players with final silver/gold. Fire-and-forget. */
export function updateGameEnd(
  db: D1Database,
  gameId: string,
  roster: Record<string, any>,
): void {
  const updates = Object.entries(roster).map(([pid, p]: [string, any]) =>
    db.prepare(
      `UPDATE Players SET status=?, silver=?, gold=? WHERE game_id=? AND player_id=?`
    ).bind(p.status, p.silver, p.gold || 0, gameId, pid)
  );
  updates.push(db.prepare(
    `UPDATE Games SET status='COMPLETED', completed_at=? WHERE id=?`
  ).bind(Date.now(), gameId));
  db.batch(updates).catch((err: any) =>
    console.error('[L1] Failed to update game-end D1 rows:', err)
  );
}
