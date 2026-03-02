/**
 * Push notification trigger logic — decides when/what to push based on
 * configurable push config from the game manifest.
 *
 * Subscriptions are stored in D1 (global, not per-DO).
 * Notification URLs are constructed from clientHost + inviteCode.
 *
 * Dedup is handled by XState — each state transition fires exactly once,
 * so each push fires exactly once. No client-side tag dedup needed.
 */
import type { PushTrigger, GameManifest } from "@pecking-order/shared-types";
import { DEFAULT_PUSH_CONFIG, FactTypes } from "@pecking-order/shared-types";
import { getPushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";

// --- TTL Constants (seconds) ---
// Game runs across days — notifications must survive device sleep/connectivity gaps.
const EVENT_TTL = 3600;       // 1 hour — phase events, activities, games
const DM_TTL = 3600;          // 1 hour — direct messages
const ELIMINATION_TTL = 3600; // 1 hour
const WINNER_TTL = 86400;     // 24 hours — game conclusion

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

/** Convert a PUSH.PHASE trigger into a push payload. Returns null if unknown trigger.
 *  No tags — each state transition fires exactly once (XState is the dedup). */
export function phasePushPayload(
  trigger: string,
  dayIndex: number,
): { payload: Record<string, string>; ttl: number } | null {
  switch (trigger) {
    case 'DAY_START':
      return { payload: { title: "Pecking Order", body: `Welcome to Day ${dayIndex} of Pecking Order` }, ttl: EVENT_TTL };
    case 'VOTING':
      return { payload: { title: "Pecking Order", body: "Voting has begun!" }, ttl: EVENT_TTL };
    case 'NIGHT_SUMMARY':
      return { payload: { title: "Pecking Order", body: "Night has fallen..." }, ttl: EVENT_TTL };
    case 'DAILY_GAME':
      return { payload: { title: "Pecking Order", body: "Game time!" }, ttl: EVENT_TTL };
    case 'ACTIVITY':
      return { payload: { title: "Pecking Order", body: "Activity time!" }, ttl: EVENT_TTL };
    case 'OPEN_DMS':
      return { payload: { title: "Pecking Order", body: "DMs are now open" }, ttl: EVENT_TTL };
    case 'CLOSE_DMS':
      return { payload: { title: "Pecking Order", body: "DMs are now closed" }, ttl: EVENT_TTL };
    case 'OPEN_GROUP_CHAT':
      return { payload: { title: "Pecking Order", body: "Group chat is open" }, ttl: EVENT_TTL };
    case 'CLOSE_GROUP_CHAT':
      return { payload: { title: "Pecking Order", body: "Group chat is closed" }, ttl: EVENT_TTL };
    case 'END_GAME':
      return { payload: { title: "Pecking Order", body: "Game over!" }, ttl: EVENT_TTL };
    case 'END_ACTIVITY':
      return { payload: { title: "Pecking Order", body: "Activity complete!" }, ttl: EVENT_TTL };
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
    }, EVENT_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_SENT && fact.targetId) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    return pushToPlayer(ctx, fact.targetId, {
      title: 'Pecking Order',
      body: `${name(fact.actorId)} sent you a DM`,
    }, DM_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.ELIMINATION) {
    if (!isPushEnabled(manifest, 'ELIMINATION')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
    }, ELIMINATION_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WINNER_DECLARED) {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} wins!`,
    }, WINNER_TTL).catch(err => console.error('[L1] [Push] Error:', err));
  }
}
