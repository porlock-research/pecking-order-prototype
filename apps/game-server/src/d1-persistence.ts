/**
 * D1 persistence — journal writes, game lifecycle, SPY_DMS query.
 * All methods are fire-and-forget (log errors, don't throw).
 */

const JOURNALABLE_TYPES = [
  'SILVER_TRANSFER', 'VOTE_CAST', 'ELIMINATION', 'DM_SENT',
  'POWER_USED', 'PERK_USED', 'GAME_RESULT', 'PLAYER_GAME_RESULT',
  'WINNER_DECLARED', 'PROMPT_RESULT',
];

/** Returns true if the fact type should be persisted to the D1 journal. */
export function isJournalable(factType: string): boolean {
  return JOURNALABLE_TYPES.includes(factType);
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
