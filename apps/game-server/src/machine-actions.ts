/**
 * L1 .provide() action overrides — side effects that require DO context
 * (D1 persistence, WebSocket delivery, push notifications).
 *
 * These override stub actions defined in the L2 orchestrator machine,
 * injecting the real D1/WebSocket/push implementations at runtime.
 */
import type { Connection } from "partyserver";
import { Events, FactTypes } from "@pecking-order/shared-types";
import { isJournalable, persistFactToD1, querySpyDms } from "./d1-persistence";
import { factToTicker, broadcastTicker } from "./ticker";
import { isPushEnabled, phasePushPayload, handleFactPush, pushBroadcast, type PushContext } from "./push-triggers";
import { sendToPlayer } from "./ws-handlers";
import { log } from "./log";
import type { TickerMessage } from "@pecking-order/shared-types";
import type { Env } from "./types";

/** Runtime context needed by the .provide() action overrides. */
export interface ActionContext {
  getActor: () => { getSnapshot: () => any; send: (event: any) => void } | undefined;
  env: Env;
  getConnections: () => Iterable<Connection>;
  getTickerHistory: () => TickerMessage[];
  setTickerHistory: (history: TickerMessage[]) => void;
  waitUntil: (promise: Promise<any>) => void;
}

/** Build a PushContext from current actor snapshot + env. */
function buildPushContext(ctx: ActionContext): PushContext {
  const snapshot = ctx.getActor()?.getSnapshot();
  return {
    roster: snapshot?.context.roster || {},
    db: ctx.env.DB,
    vapidPrivateJwk: ctx.env.VAPID_PRIVATE_JWK,
    clientHost: ctx.env.GAME_CLIENT_HOST || 'https://play.peckingorder.ca',
    inviteCode: snapshot?.context.inviteCode || '',
  };
}

/**
 * Handle perk result delivery after D1 journal write.
 * SPY_DMS requires a D1 query; other perks return immediately.
 */
function handlePerkResult(ctx: ActionContext, fact: any, gameId: string): void {
  const perkType = fact.payload?.perkType;
  if (perkType === 'SPY_DMS' && fact.targetId) {
    querySpyDms(ctx.env.DB, gameId, fact.targetId).then((messages) => {
      ctx.getActor()?.send({
        type: Events.Perk.RESULT,
        senderId: fact.actorId,
        result: { perkType: 'SPY_DMS', success: true, data: { messages } },
      });
    }).catch((err: any) => {
      log('error', 'L1', 'SPY_DMS D1 query failed', { error: String(err) });
      ctx.getActor()?.send({
        type: Events.Perk.RESULT,
        senderId: fact.actorId,
        result: { perkType: 'SPY_DMS', success: false, data: { messages: [] } },
      });
    });
  } else {
    ctx.getActor()?.send({
      type: Events.Perk.RESULT,
      senderId: fact.actorId,
      result: { perkType, success: true },
    });
  }
}

/**
 * Build the action overrides for orchestratorMachine.provide().
 * Each action is a thin bridge from XState to the DO environment.
 */
export function buildActionOverrides(ctx: ActionContext) {
  return {
    persistFactToD1: ({ event }: any) => {
      if (event.type !== Events.Fact.RECORD) return;
      const fact = event.fact;
      if (!isJournalable(fact.type)) return;

      log('info', 'L1', 'Persisting fact to D1', { factType: fact.type });
      const snapshot = ctx.getActor()?.getSnapshot();
      const gameId = snapshot?.context.gameId || 'unknown';
      const dayIndex = snapshot?.context.dayIndex || 0;

      persistFactToD1(ctx.env.DB, gameId, dayIndex, fact);

      if (fact.type === FactTypes.PERK_USED) {
        handlePerkResult(ctx, fact, gameId);
      }

      // Ticker: convert fact to humanized message
      const roster = snapshot?.context.roster || {};
      const tickerMsg = factToTicker(fact, roster);
      if (tickerMsg) {
        ctx.setTickerHistory(broadcastTicker(tickerMsg, ctx.getTickerHistory(), ctx.getConnections));
      }

      // Push notifications for significant facts
      const manifest = snapshot?.context.manifest;
      const pushPromise = handleFactPush(buildPushContext(ctx), fact, manifest);
      if (pushPromise) ctx.waitUntil(pushPromise);
    },

    sendDmRejection: ({ event }: any) => {
      if (event.type !== Events.Rejection.DM) return;
      sendToPlayer(ctx.getConnections, event.senderId, { type: Events.Rejection.DM, reason: event.reason });
    },

    sendSilverTransferRejection: ({ event }: any) => {
      if (event.type !== Events.Rejection.SILVER_TRANSFER) return;
      sendToPlayer(ctx.getConnections, event.senderId, { type: Events.Rejection.SILVER_TRANSFER, reason: event.reason });
    },

    sendChannelRejection: ({ event }: any) => {
      if (event.type !== Events.Rejection.CHANNEL) return;
      sendToPlayer(ctx.getConnections, event.senderId, { type: Events.Rejection.CHANNEL, reason: event.reason });
    },

    deliverPerkResult: ({ event }: any) => {
      if (event.type !== Events.Perk.RESULT && event.type !== Events.Rejection.PERK) return;
      sendToPlayer(ctx.getConnections, event.senderId, event);
    },

    broadcastPhasePush: ({ context, event }: any) => {
      const { trigger } = event;
      const manifest = context.manifest;
      if (!isPushEnabled(manifest, trigger)) return;
      const dayManifest = manifest?.days?.find((d: any) => d.dayIndex === context.dayIndex);
      const result = phasePushPayload(trigger, context.dayIndex, dayManifest);
      if (result) {
        const p = pushBroadcast(buildPushContext(ctx), result.payload, result.ttl, undefined, result.intent).catch(err =>
          log('error', 'L1', 'Push phase broadcast error', { error: String(err) })
        );
        ctx.waitUntil(p);
      }
    },
  };
}
