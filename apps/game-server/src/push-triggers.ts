/**
 * Push notification trigger logic — decides when/what to push based on
 * configurable push config from the game manifest.
 *
 * Subscriptions are stored in D1 (global, not per-DO).
 * Notification URLs are constructed from clientHost + inviteCode.
 */
import type { PushTrigger, GameManifest } from "@pecking-order/shared-types";
import { DEFAULT_PUSH_CONFIG, FactTypes } from "@pecking-order/shared-types";
import { getPushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";

// --- TTL Constants (seconds) ---
const PHASE_TTL = 300;      // 5 min — phases are time-sensitive
const GAME_TTL = 600;       // 10 min — daily game
const DM_TTL = 3600;        // 1 hour
const ELIMINATION_TTL = 3600; // 1 hour
const WINNER_TTL = 86400;   // 24 hours

export interface PushContext {
  roster: Record<string, any>;
  db: D1Database;
  vapidPrivateJwk: string;
  clientHost: string;
  inviteCode: string;
}

/** Check if a push trigger is enabled for this game's manifest. */
export function isPushEnabled(manifest: GameManifest | null | undefined, trigger: PushTrigger): boolean {
  const config = manifest?.pushConfig;
  if (!config || !(trigger in config)) return DEFAULT_PUSH_CONFIG[trigger];
  return config[trigger] ?? DEFAULT_PUSH_CONFIG[trigger];
}

/** Resolve the push storage key for a player (realUserId preferred, fallback to playerId). */
export function pushKeyForPlayer(playerId: string, roster: Record<string, any>): string {
  return roster[playerId]?.realUserId || playerId;
}

/** Send a push notification to a single player (skips if no subscription). */
export async function pushToPlayer(
  ctx: PushContext,
  playerId: string,
  payload: Record<string, string>,
  ttl?: number,
): Promise<void> {
  const pushKey = pushKeyForPlayer(playerId, ctx.roster);
  const sub = await getPushSubscriptionD1(ctx.db, pushKey);
  if (!sub) {
    console.log(`[L1] [Push] Skip ${playerId} — no subscription stored`);
    return;
  }

  // Construct game URL from clientHost + inviteCode
  const url = ctx.inviteCode ? `${ctx.clientHost}/game/${ctx.inviteCode}` : ctx.clientHost;
  const enriched = { ...payload, url };

  console.log(`[L1] [Push] Sending to ${playerId}: ${payload.body}`);
  const result = await sendPushNotification(sub, enriched, ctx.vapidPrivateJwk, undefined, ttl);
  console.log(`[L1] [Push] Result for ${playerId}: ${result}`);
  if (result === "expired") {
    await deletePushSubscriptionD1(ctx.db, pushKey);
  }
}

/** Broadcast a push notification to all players in the roster. */
export async function pushBroadcast(
  ctx: PushContext,
  payload: Record<string, string>,
  ttl?: number,
): Promise<void> {
  const playerIds = Object.keys(ctx.roster);
  console.log(`[L1] [Push] Broadcasting to ${playerIds.length} players: ${payload.body}`);
  await Promise.allSettled(
    playerIds.map((pid) => pushToPlayer(ctx, pid, payload, ttl)),
  );
}

/** Convert a PUSH.PHASE trigger into a push payload. Returns null if unknown trigger. */
export function phasePushPayload(
  trigger: string,
  dayIndex: number,
): { payload: Record<string, string>; ttl: number } | null {
  switch (trigger) {
    case 'DAY_START':
      return { payload: { title: "Pecking Order", body: `Welcome to Day ${dayIndex} of Pecking Order`, tag: "phase" }, ttl: PHASE_TTL };
    case 'VOTING':
      return { payload: { title: "Pecking Order", body: "Voting has begun!", tag: "phase" }, ttl: PHASE_TTL };
    case 'NIGHT_SUMMARY':
      return { payload: { title: "Pecking Order", body: "Night has fallen...", tag: "phase" }, ttl: PHASE_TTL };
    case 'DAILY_GAME':
      return { payload: { title: "Pecking Order", body: "Game time!", tag: "phase" }, ttl: GAME_TTL };
    case 'ACTIVITY':
      return { payload: { title: "Pecking Order", body: "Activity time!", tag: "activity" }, ttl: PHASE_TTL };
    case 'OPEN_DMS':
      return { payload: { title: "Pecking Order", body: "DMs are now open", tag: "phase" }, ttl: PHASE_TTL };
    case 'CLOSE_DMS':
      return { payload: { title: "Pecking Order", body: "DMs are now closed", tag: "phase" }, ttl: PHASE_TTL };
    case 'OPEN_GROUP_CHAT':
      return { payload: { title: "Pecking Order", body: "Group chat is open", tag: "phase" }, ttl: PHASE_TTL };
    case 'CLOSE_GROUP_CHAT':
      return { payload: { title: "Pecking Order", body: "Group chat is closed", tag: "phase" }, ttl: PHASE_TTL };
    case 'END_GAME':
      return { payload: { title: "Pecking Order", body: "Game over!", tag: "phase" }, ttl: PHASE_TTL };
    case 'END_ACTIVITY':
      return { payload: { title: "Pecking Order", body: "Activity complete!", tag: "activity" }, ttl: PHASE_TTL };
    default:
      return null;
  }
}

/** Handle push notifications for significant facts (DM_SENT, ELIMINATION, WINNER_DECLARED).
 *  Returns a promise so the caller can use ctx.waitUntil() to keep the DO alive. */
export function handleFactPush(
  ctx: PushContext,
  fact: any,
  manifest: GameManifest | null | undefined,
): Promise<void> | undefined {
  const name = (id: string) => ctx.roster[id]?.personaName || id;

  if (fact.type === FactTypes.CHAT_MSG && fact.payload?.channelId === 'MAIN') {
    if (!isPushEnabled(manifest, 'GROUP_CHAT_MSG')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.actorId)}: ${(fact.payload?.content || '').slice(0, 60)}`,
      tag: 'group-chat',
    }, PHASE_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_SENT && fact.targetId) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    return pushToPlayer(ctx, fact.targetId, {
      title: 'Pecking Order',
      body: `${name(fact.actorId)} sent you a DM`,
      tag: `dm-${fact.actorId}`,
    }, DM_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.ELIMINATION) {
    if (!isPushEnabled(manifest, 'ELIMINATION')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
      tag: 'elimination',
    }, ELIMINATION_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WINNER_DECLARED) {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} wins!`,
      tag: 'winner',
    }, WINNER_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  }
}
