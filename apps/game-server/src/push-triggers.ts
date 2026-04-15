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
import type { PushTrigger, GameManifest, DailyManifest, DeepLinkIntent } from "@pecking-order/shared-types";
import { DEFAULT_PUSH_CONFIG, FactTypes } from "@pecking-order/shared-types";
import { getPushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";

// --- TTL Constants (seconds) ---
// Game runs across days — notifications must survive device sleep/connectivity gaps.
const EVENT_TTL = 3600;       // 1 hour — phase events, activities, games
const DM_TTL = 3600;          // 1 hour — direct messages
const ELIMINATION_TTL = 3600; // 1 hour
const WINNER_TTL = 86400;     // 24 hours — game conclusion

// --- Human-friendly mechanic labels for push notifications ---

const GAME_LABELS: Record<string, string> = {
  TRIVIA: 'Trivia',
  REALTIME_TRIVIA: 'Live Trivia',
  GAP_RUN: 'Gap Run',
  GRID_PUSH: 'Grid Push',
  SEQUENCE: 'Sequence',
  REACTION_TIME: 'Reaction Time',
  COLOR_MATCH: 'Color Match',
  STACKER: 'Stacker',
  QUICK_MATH: 'Quick Math',
  SIMON_SAYS: 'Simon Says',
  AIM_TRAINER: 'Aim Trainer',
  BET_BET_BET: 'Bet Bet Bet',
  BLIND_AUCTION: 'Blind Auction',
  KINGS_RANSOM: "King's Ransom",
  THE_SPLIT: 'The Split',
  TOUCH_SCREEN: 'Touch Screen',
};

const VOTE_LABELS: Record<string, string> = {
  MAJORITY: 'Majority Vote',
  EXECUTIONER: 'The Executioner',
  BUBBLE: 'The Bubble',
  SECOND_TO_LAST: 'Second to Last',
  PODIUM_SACRIFICE: 'Podium Sacrifice',
  SHIELD: 'The Shield',
  TRUST_PAIRS: 'Trust Pairs',
  FINALS: 'The Finals',
  DUELS: 'Duels',
};

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
  intent?: DeepLinkIntent,
): Promise<void> {
  const pushKey = pushKeyForPlayer(playerId, ctx.roster);
  const sub = await getPushSubscriptionD1(ctx.db, pushKey);
  if (!sub) {
    console.log(`[L1] [Push] Skip ${playerId} — no subscription stored`);
    return;
  }

  // Construct game URL from clientHost + inviteCode
  const url = ctx.inviteCode ? `${ctx.clientHost}/game/${ctx.inviteCode}` : ctx.clientHost;
  const enriched: Record<string, string> = { ...payload, url };
  if (intent) enriched.intent = JSON.stringify(intent);

  console.log(`[L1] [Push] Sending to ${playerId}: ${payload.body}`);
  const result = await sendPushNotification(sub, enriched, ctx.vapidPrivateJwk, undefined, ttl);
  console.log(`[L1] [Push] Result for ${playerId}: ${result}`);
  if (result === "expired") {
    await deletePushSubscriptionD1(ctx.db, pushKey);
  }
}

/** Broadcast a push notification to all players in the roster (optionally excluding some). */
export async function pushBroadcast(
  ctx: PushContext,
  payload: Record<string, string>,
  ttl?: number,
  excludePlayerIds?: string[],
  intent?: DeepLinkIntent,
): Promise<void> {
  const exclude = new Set(excludePlayerIds);
  const playerIds = Object.keys(ctx.roster).filter(pid => !exclude.has(pid));
  console.log(`[L1] [Push] Broadcasting to ${playerIds.length} players: ${payload.body}`);
  await Promise.allSettled(
    playerIds.map((pid) => pushToPlayer(ctx, pid, payload, ttl, intent)),
  );
}

/** Convert a PUSH.PHASE trigger into a push payload. Returns null if unknown trigger.
 *  Uses the day manifest to generate contextual messages (game type, vote type, etc.).
 *  No tags — each state transition fires exactly once (XState is the dedup). */
export function phasePushPayload(
  trigger: string,
  dayIndex: number,
  dayManifest?: DailyManifest | null,
): { payload: Record<string, string>; ttl: number } | null {
  const gameLabel = GAME_LABELS[dayManifest?.gameType || ''] || 'Game';
  const voteLabel = VOTE_LABELS[dayManifest?.voteType || ''] || 'Voting';

  switch (trigger) {
    case 'DAY_START':
      return { payload: { title: `Day ${dayIndex}`, body: `A new day dawns at Pecking Order. Today's vote: ${voteLabel}` }, ttl: EVENT_TTL };
    case 'VOTING':
      return { payload: { title: voteLabel, body: `Day ${dayIndex} voting is open — cast your vote now` }, ttl: EVENT_TTL };
    case 'NIGHT_SUMMARY':
      return { payload: { title: "Night has fallen", body: `Day ${dayIndex} results are in...` }, ttl: EVENT_TTL };
    case 'DAILY_GAME':
      return { payload: { title: `${gameLabel} Time`, body: `Today's game is ${gameLabel} — jump in and play` }, ttl: EVENT_TTL };
    case 'ACTIVITY':
      return { payload: { title: "Activity Time", body: `A new activity is live — earn some silver` }, ttl: EVENT_TTL };
    case 'OPEN_DMS':
      return { payload: { title: "DMs Open", body: "Send private messages, form alliances, make deals" }, ttl: EVENT_TTL };
    case 'CLOSE_DMS':
      return { payload: { title: "DMs Closed", body: "Private messages are closed for the day" }, ttl: EVENT_TTL };
    case 'OPEN_GROUP_CHAT':
      return { payload: { title: "Group Chat Open", body: "The floor is open — make your case" }, ttl: EVENT_TTL };
    case 'CLOSE_GROUP_CHAT':
      return { payload: { title: "Group Chat Closed", body: "The group chat has closed for the day" }, ttl: EVENT_TTL };
    case 'END_GAME':
      return { payload: { title: `${gameLabel} Complete`, body: "Results are in — check how you did" }, ttl: EVENT_TTL };
    case 'END_ACTIVITY':
      return { payload: { title: "Activity Complete", body: "Results are in — see who earned silver" }, ttl: EVENT_TTL };
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
      title: name(fact.actorId),
      body: (fact.payload?.content || '').slice(0, 100),
    }, EVENT_TTL, [fact.actorId], { kind: 'main' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_SENT) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    const snippet = (fact.payload?.content || '').slice(0, 100);
    const payload = { title: name(fact.actorId), body: snippet || 'Sent you a message' };
    const channelId = fact.payload?.channelId as string | undefined;
    const intent: DeepLinkIntent | undefined = channelId ? { kind: 'dm', channelId } : undefined;

    // Group DM: push to all target members
    const targetIds: string[] | undefined = fact.payload?.targetIds;
    if (targetIds && targetIds.length > 0) {
      return Promise.allSettled(
        targetIds.map((tid: string) => pushToPlayer(ctx, tid, payload, DM_TTL, intent))
      ).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
    }
    // 1:1 DM: push to single target
    if (fact.targetId) {
      return pushToPlayer(ctx, fact.targetId, payload, DM_TTL, intent)
        .catch(err => console.error('[L1] [Push] Error:', err));
    }
    return;
  } else if (fact.type === FactTypes.ELIMINATION) {
    if (!isPushEnabled(manifest, 'ELIMINATION')) return;
    const dayIndex = fact.payload?.dayIndex as number | undefined;
    const intent: DeepLinkIntent | undefined = dayIndex !== undefined
      ? { kind: 'elimination_reveal', dayIndex }
      : undefined;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
    }, ELIMINATION_TTL, undefined, intent).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WINNER_DECLARED) {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} wins!`,
    }, WINNER_TTL, undefined, { kind: 'winner_reveal' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_INVITE_SENT && fact.payload?.memberIds) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;  // reuse DM_SENT toggle
    const memberIds = fact.payload.memberIds as string[];
    const intent: DeepLinkIntent = { kind: 'dm_invite', senderId: fact.actorId };
    return Promise.all(
      memberIds.map((memberId: string) =>
        pushToPlayer(ctx, memberId, {
          title: name(fact.actorId),
          body: `${name(fact.actorId)} invited you to chat`,
        }, DM_TTL, intent)
      )
    ).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
  }
}
