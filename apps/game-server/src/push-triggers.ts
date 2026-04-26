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
import { DEFAULT_PUSH_CONFIG, FactTypes, CARTRIDGE_INFO } from "@pecking-order/shared-types";
import { getPushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";

// --- TTL Constants (seconds) ---
// Game runs across days — notifications must survive device sleep/connectivity gaps.
const EVENT_TTL = 3600;       // 1 hour — phase events, activities, games
const DM_TTL = 3600;          // 1 hour — direct messages
const ELIMINATION_TTL = 3600; // 1 hour
const WINNER_TTL = 86400;     // 24 hours — game conclusion

// Display name + tagline for a cartridge type. Falls back gracefully if the
// type is missing from CARTRIDGE_INFO (e.g. mid-rollout enum additions). We
// read from CARTRIDGE_INFO (the canonical registry) instead of a local map so
// that new games/votes/activities surface in pushes without a parallel update
// here — see `reference_cartridge_info.md`.
function displayOf(type: string, fallback: string): string {
  return CARTRIDGE_INFO[type]?.displayName ?? fallback;
}
function taglineOf(type: string): string | null {
  return CARTRIDGE_INFO[type]?.tagline ?? null;
}

// Pick a random entry from a non-empty list. Used for body-copy pools where
// variation across repeated firings keeps the notification feeling alive
// instead of templated.
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

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
): { payload: Record<string, string>; ttl: number; intent: DeepLinkIntent } | null {
  const gameType = dayManifest?.gameType || 'UNKNOWN';
  const voteType = dayManifest?.voteType || 'UNKNOWN';
  // Manifest field is `activityType` (PromptType), NOT `promptType` — earlier
  // versions of this file read the wrong key and silently degraded to 'UNKNOWN',
  // which is why ACTIVITY/END_ACTIVITY pushes never named the prompt.
  const activityType = dayManifest?.activityType || 'UNKNOWN';
  const dilemmaType = dayManifest?.dilemmaType || 'UNKNOWN';
  const gameDisplay = displayOf(gameType, 'Game');
  const voteDisplay = displayOf(voteType, 'Vote');
  const activityDisplay = displayOf(activityType, 'Today\'s prompt');
  const dilemmaDisplay = displayOf(dilemmaType, 'Dilemma');
  const voteTagline = taglineOf(voteType) ?? 'Sundown decides.';
  const gameTagline = taglineOf(gameType) ?? 'Show off, or get shown up.';
  const activityTagline = taglineOf(activityType) ?? 'Drop your answer for silver.';
  const dilemmaTagline = taglineOf(dilemmaType) ?? 'Choose carefully.';

  switch (trigger) {
    case 'DAY_START':
      return { payload: { title: `Day ${dayIndex} · ${voteDisplay}`, body: voteTagline }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'VOTING':
      return { payload: { title: `Vote · ${voteDisplay}`, body: `${voteTagline} Cast yours.` }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `voting-${dayIndex}-${voteType}`, cartridgeKind: 'voting' } };
    case 'NIGHT_SUMMARY': {
      // Name what actually happened today (game + vote) when we can; fall back
      // to a generic recap line if the manifest doesn't carry both.
      const hasGame = gameType !== 'UNKNOWN' && gameType !== 'NONE';
      const hasVote = voteType !== 'UNKNOWN';
      const body = hasGame && hasVote
        ? `${gameDisplay} · ${voteDisplay}. Recap inside.`
        : hasVote
          ? `${voteDisplay}. Recap inside.`
          : 'Recap is in. Spoilers inside.';
      return { payload: { title: `Day ${dayIndex} wrap`, body }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    }
    case 'DAILY_GAME':
      return { payload: { title: `${gameDisplay} is live`, body: gameTagline }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `game-${dayIndex}-${gameType}`, cartridgeKind: 'game' } };
    case 'ACTIVITY':
      return { payload: { title: `${activityDisplay} is live`, body: activityTagline }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `prompt-${dayIndex}-${activityType}`, cartridgeKind: 'prompt' } };
    case 'OPEN_DMS':
      return { payload: { title: 'DMs are open', body: 'Plot in private. Strike a deal. Or break one.' }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'CLOSE_DMS':
      return { payload: { title: 'DMs are locked', body: 'Whatever you said, you said. Until tomorrow.' }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'OPEN_GROUP_CHAT':
      return { payload: { title: 'The floor is open', body: 'Make your case. Plot moves. Bluff hard.' }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'CLOSE_GROUP_CHAT':
      return { payload: { title: 'Main chat is closed', body: 'Plays are in. Sundown comes for someone.' }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'END_GAME':
      return { payload: { title: `${gameDisplay} · Recap`, body: 'See who flexed, see who flopped.' }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_result', cartridgeId: `game-${dayIndex}-${gameType}` } };
    case 'END_ACTIVITY':
      return { payload: { title: `${activityDisplay} · Recap`, body: 'Silver hit. See who got paid.' }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_result', cartridgeId: `prompt-${dayIndex}-${activityType}` } };
    case 'DILEMMA':
      return { payload: { title: `${dilemmaDisplay} is live`, body: dilemmaTagline }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `dilemma-${dayIndex}-${dilemmaType}`, cartridgeKind: 'dilemma' } };
    case 'END_DILEMMA':
      return { payload: { title: `${dilemmaDisplay} · Recap`, body: 'Choices made. See the fallout.' }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_result', cartridgeId: `dilemma-${dayIndex}-${dilemmaType}` } };
    case 'CONFESSION_OPEN':
      // Plan 1 routes to chat-root (no deep-link intent into a cartridge yet — Plan 2's match
      // cartridge gets its own START_ACTIVITY push when it spawns later).
      return { payload: { title: 'Confession booth · Open', body: 'Spill in private. Just for you.' }, ttl: EVENT_TTL, intent: { kind: 'main' } };
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
    // Priority: REPLY > MENTION > GROUP_CHAT_MSG. Each recipient gets at
    // most one push per message; more-specific triggers suppress the generic
    // group-chat broadcast for that player. Mentions and replies get a
    // distinguishing title so they stand out from group-chat noise.
    const senderName = name(fact.actorId);
    const body = (fact.payload?.content || '').slice(0, 100);
    const replyToAuthorId: string | undefined = fact.payload?.replyToAuthorId;
    const mentionedIds: string[] = Array.isArray(fact.payload?.mentionedIds) ? fact.payload.mentionedIds : [];
    const exclude = new Set<string>([fact.actorId]);

    const promises: Promise<void>[] = [];
    if (replyToAuthorId && replyToAuthorId !== fact.actorId && isPushEnabled(manifest, 'REPLY')) {
      promises.push(pushToPlayer(ctx, replyToAuthorId, { title: `${senderName} replied to you`, body }, EVENT_TTL, { kind: 'main' }));
      exclude.add(replyToAuthorId);
    }
    if (isPushEnabled(manifest, 'MENTION')) {
      for (const mid of mentionedIds) {
        if (exclude.has(mid)) continue;
        promises.push(pushToPlayer(ctx, mid, { title: `${senderName} mentioned you`, body }, EVENT_TTL, { kind: 'main' }));
        exclude.add(mid);
      }
    }
    if (isPushEnabled(manifest, 'GROUP_CHAT_MSG')) {
      promises.push(pushBroadcast(ctx, { title: senderName, body }, EVENT_TTL, Array.from(exclude), { kind: 'main' }));
    }
    if (promises.length === 0) return;
    return Promise.allSettled(promises).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_SENT) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    const senderName = name(fact.actorId);
    const snippet = (fact.payload?.content || '').slice(0, 100);
    const payload = { title: senderName, body: snippet || `${senderName} DM'd you` };
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
    const targetName = name(fact.targetId || fact.actorId);
    const dayLabel = typeof dayIndex === 'number' ? `Day ${dayIndex}` : 'Today';
    return pushBroadcast(ctx, {
      title: `${targetName} is OUT`,
      body: pick([
        `${dayLabel} is brutal. Tap in.`,
        `It's bad. Tap to watch.`,
        `The replay's wild. Catch up.`,
      ]),
    }, ELIMINATION_TTL, undefined, intent).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WINNER_DECLARED) {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    const winnerName = name(fact.targetId || fact.actorId);
    return pushBroadcast(ctx, {
      title: `${winnerName} is CROWNED`,
      body: '7 days. One winner. Tap to watch.',
    }, WINNER_TTL, undefined, { kind: 'winner_reveal' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_INVITE_SENT && fact.payload?.memberIds) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;  // reuse DM_SENT toggle
    const memberIds = fact.payload.memberIds as string[];
    const inviterName = name(fact.actorId);
    const intent: DeepLinkIntent = { kind: 'dm_invite', senderId: fact.actorId };
    return Promise.all(
      memberIds.map((memberId: string) =>
        pushToPlayer(ctx, memberId, {
          title: `${inviterName} opened a DM with you`,
          body: 'Tap to accept.',
        }, DM_TTL, intent)
      )
    ).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.NUDGE && fact.targetId) {
    if (!isPushEnabled(manifest, 'NUDGE')) return;
    return pushToPlayer(ctx, fact.targetId, {
      title: `${name(fact.actorId)} nudged you`,
      body: pick(['Hey. Look up.', "Don't ghost.", 'Eyes on you.']),
    }, EVENT_TTL, { kind: 'main' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WHISPER && fact.targetId) {
    if (!isPushEnabled(manifest, 'WHISPER')) return;
    const text = (fact.payload?.text || '').slice(0, 100);
    return pushToPlayer(ctx, fact.targetId, {
      title: `${name(fact.actorId)} whispered`,
      body: text || 'Tap to read.',
    }, EVENT_TTL, { kind: 'main' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.SILVER_TRANSFER && fact.targetId) {
    if (!isPushEnabled(manifest, 'SILVER_RECEIVED')) return;
    const amount = fact.payload?.amount ?? 0;
    return pushToPlayer(ctx, fact.targetId, {
      title: `${name(fact.actorId)} sent ${amount} silver`,
      body: pick([
        'Tap. They probably want something.',
        'Bribe? Gift? Tap to see.',
        'Suspicious. Tap in.',
      ]),
    }, EVENT_TTL, { kind: 'main' }).catch(err => console.error('[L1] [Push] Error:', err));
  }
}
