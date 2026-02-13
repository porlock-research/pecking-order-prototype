/**
 * Push notification trigger logic — decides when/what to push based on
 * configurable push config from the game manifest.
 */
import type { PushTrigger, GameManifest } from "@pecking-order/shared-types";
import { DEFAULT_PUSH_CONFIG } from "@pecking-order/shared-types";
import { getPushSubscription, deletePushSubscription, sendPushNotification } from "./push";

export interface PushContext {
  roster: Record<string, any>;
  storage: DurableObjectStorage;
  vapidPrivateJwk: string;
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
): Promise<void> {
  const pushKey = pushKeyForPlayer(playerId, ctx.roster);
  const sub = await getPushSubscription(ctx.storage, pushKey);
  if (!sub) {
    console.log(`[L1] [Push] Skip ${playerId} — no subscription stored`);
    return;
  }

  // Inject stored returnUrl so notification click opens the game
  const returnUrl = await ctx.storage.get<string>(`push_url:${pushKey}`);
  const enriched = returnUrl ? { ...payload, url: returnUrl } : payload;

  console.log(`[L1] [Push] Sending to ${playerId}: ${payload.body}`);
  const result = await sendPushNotification(sub, enriched, ctx.vapidPrivateJwk);
  console.log(`[L1] [Push] Result for ${playerId}: ${result}`);
  if (result === "expired") {
    await deletePushSubscription(ctx.storage, pushKey);
  }
}

/** Broadcast a push notification to all players in the roster. */
export async function pushBroadcast(
  ctx: PushContext,
  payload: Record<string, string>,
): Promise<void> {
  const playerIds = Object.keys(ctx.roster);
  console.log(`[L1] [Push] Broadcasting to ${playerIds.length} players: ${payload.body}`);
  await Promise.allSettled(
    playerIds.map((pid) => pushToPlayer(ctx, pid, payload)),
  );
}

/** Convert a combined L2+L3 state string into a push payload for phase transitions. Returns null if no push needed. */
export function stateToPush(
  stateStr: string,
  context: any,
  manifest: GameManifest | null | undefined,
): Record<string, string> | null {
  const dayIndex = context?.dayIndex || 0;

  if (stateStr.includes('"activityLayer":"playing"')) {
    if (!isPushEnabled(manifest, 'ACTIVITY')) return null;
    return { title: "Pecking Order", body: "Activity time!", tag: "activity" };
  }
  if (stateStr.includes("morningBriefing") || stateStr.includes("groupChat")) {
    if (!isPushEnabled(manifest, 'DAY_START')) return null;
    return { title: "Pecking Order", body: `Day ${dayIndex} has begun!`, tag: "phase" };
  }
  if (stateStr.includes("voting")) {
    if (!isPushEnabled(manifest, 'VOTING')) return null;
    return { title: "Pecking Order", body: "Voting has begun!", tag: "phase" };
  }
  if (stateStr.includes("nightSummary")) {
    if (!isPushEnabled(manifest, 'NIGHT_SUMMARY')) return null;
    return { title: "Pecking Order", body: "Night has fallen...", tag: "phase" };
  }
  if (stateStr.includes("dailyGame")) {
    if (!isPushEnabled(manifest, 'DAILY_GAME')) return null;
    return { title: "Pecking Order", body: "Game time!", tag: "phase" };
  }
  return null;
}

/** Handle push notifications for significant facts (DM_SENT, ELIMINATION, WINNER_DECLARED). Fire-and-forget. */
export function handleFactPush(
  ctx: PushContext,
  fact: any,
  manifest: GameManifest | null | undefined,
): void {
  const name = (id: string) => ctx.roster[id]?.personaName || id;

  if (fact.type === 'DM_SENT' && fact.targetId) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    pushToPlayer(ctx, fact.targetId, {
      title: 'Pecking Order',
      body: `${name(fact.actorId)} sent you a DM`,
      tag: 'dm',
    }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === 'ELIMINATION') {
    if (!isPushEnabled(manifest, 'ELIMINATION')) return;
    pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
      tag: 'elimination',
    }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === 'WINNER_DECLARED') {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} wins!`,
      tag: 'winner',
    }).catch(err => console.error('[L1] [Push] Error:', err));
  }
}
