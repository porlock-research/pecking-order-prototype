import type { ActorRefFrom } from "xstate";
import type { Connection } from "partyserver";
import type { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import type { orchestratorMachine } from "./machines/l2-orchestrator";
import { extractL3Context, extractCartridges, broadcastSync } from "./sync";
import { buildDebugSummary, broadcastTicker, broadcastDebugTicker, stateToTicker } from "./ticker";
import { updateGameEnd, creditGold } from "./d1-persistence";
import { log } from "./log";
import type { Env } from "./types";
import { getOnlinePlayerIds } from "./ws-handlers";

/** Mutable state owned by the server, updated by the subscription callback. */
export interface SubscriptionState {
  lastKnownChatLog: any[];
  lastBroadcastState: string;
  lastKnownDmsOpen: boolean;
  lastKnownGroupChatOpen: boolean;
  tickerHistory: TickerMessage[];
  lastDebugSummary: string;
  goldCredited: boolean;
}

export interface SubscriptionDeps {
  getActor: () => ActorRefFrom<typeof orchestratorMachine> | undefined;
  storage: DurableObjectStorage;
  env: Env;
  scheduler: Scheduler<Env>;
  state: SubscriptionState;
  connectedPlayers: Map<string, Set<string>>;
  getConnections: () => Iterable<Connection>;
}

/**
 * Set up the actor subscription callback.
 * Handles: auto-save, SYNC broadcast, ticker, D1 game-end, gold payout, task flush.
 */
export function setupActorSubscription(
  actor: ActorRefFrom<typeof orchestratorMachine>,
  deps: SubscriptionDeps,
): void {
  // The first subscription fire happens synchronously during actor.start()
  // with the restored snapshot — suppress ticker emissions to avoid duplicates.
  let isRestoreFire = true;

  actor.subscribe(async (snapshot) => {
    const { state } = deps;
    const { l3Context, l3Snapshot, chatLog } = extractL3Context(snapshot, state.lastKnownChatLog);
    if (l3Context.chatLog) state.lastKnownChatLog = l3Context.chatLog;

    // Debug ticker for connected dev clients (not logged to Axiom)
    const debugSummary = buildDebugSummary(snapshot, l3Snapshot);
    if (debugSummary !== state.lastDebugSummary) {
      state.lastDebugSummary = debugSummary;
      broadcastDebugTicker(debugSummary, deps.getConnections);
    }

    // A. Save state to disk (SQL — ADR-092)
    const persistedSnapshot = deps.getActor()?.getPersistedSnapshot();
    deps.storage.sql.exec(
      `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('game_state', ?, unixepoch())`,
      JSON.stringify({
        l2: persistedSnapshot,
        l3Context: { chatLog: l3Context.chatLog ?? state.lastKnownChatLog },
        tickerHistory: state.tickerHistory,
      })
    );

    // B. (Scheduling moved to handleInit — manifest events pre-scheduled at game creation)

    // C. Broadcast SYSTEM.SYNC to all clients
    const cartridges = extractCartridges(snapshot);
    broadcastSync(
      { snapshot, l3Context, l3SnapshotValue: l3Snapshot?.value, chatLog, cartridges },
      deps.getConnections,
      getOnlinePlayerIds(deps.connectedPlayers),
    );

    // D. Ticker: detect state transitions
    const l3StateJson = l3Snapshot ? JSON.stringify(l3Snapshot.value) : '';
    const currentStateStr = JSON.stringify(snapshot.value) + l3StateJson;
    if (currentStateStr !== state.lastBroadcastState) {
      if (!isRestoreFire) {
        // Flush ticker history on new day so previous-day messages don't carry over
        if (currentStateStr.includes('morningBriefing') && !state.lastBroadcastState.includes('morningBriefing')) {
          state.tickerHistory = [];
        }

        const tickerMsg = stateToTicker(currentStateStr, snapshot.context);
        if (tickerMsg) {
          state.tickerHistory = broadcastTicker(tickerMsg, state.tickerHistory, deps.getConnections);
        }
      }
      state.lastBroadcastState = currentStateStr;
    }

    // E. Update D1 when game ends + persist gold payouts + flush scheduled tasks
    if (currentStateStr.includes('gameOver') && snapshot.context.gameId) {
      updateGameEnd(deps.env.DB, snapshot.context.gameId, snapshot.context.roster);

      // Persist gold payouts to cross-tournament wallets (idempotent guard)
      if (!state.goldCredited) {
        const payouts = snapshot.context.goldPayouts || [];
        for (const payout of payouts) {
          const realUserId = snapshot.context.roster[payout.playerId]?.realUserId;
          if (realUserId && payout.amount > 0) {
            creditGold(deps.env.DB, realUserId, payout.amount);
          }
        }
        if (payouts.length > 0) {
          state.goldCredited = true;
          deps.storage.sql.exec(
            `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('gold_credited', 'true', unixepoch())`
          );
        }
      }

      // Flush remaining PartyWhen tasks — game is done
      try {
        (deps.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
      } catch (e) {
        log('error', 'L1', 'Failed to flush tasks on game end', { error: String(e) });
      }
    }

    // F. Ticker: detect DM open/close changes
    //    Toggle events replace their complement (open removes close, vice versa)
    const currentDmsOpen = l3Context.dmsOpen ?? false;
    if (currentDmsOpen !== state.lastKnownDmsOpen) {
      if (!isRestoreFire) {
        const opposite = currentDmsOpen ? 'GATE.DMS_CLOSE' : 'GATE.DMS_OPEN';
        state.tickerHistory = state.tickerHistory.filter(m => m.category !== opposite);
        state.tickerHistory = broadcastTicker({
          id: crypto.randomUUID(),
          text: currentDmsOpen ? 'DMs are now open!' : 'DMs are now closed.',
          category: currentDmsOpen ? 'GATE.DMS_OPEN' : 'GATE.DMS_CLOSE',
          timestamp: Date.now(),
        }, state.tickerHistory, deps.getConnections);
      }
      state.lastKnownDmsOpen = currentDmsOpen;
    }

    // G. Ticker: detect group chat open/close changes
    const currentGroupChatOpen = l3Context.groupChatOpen ?? false;
    if (currentGroupChatOpen !== state.lastKnownGroupChatOpen) {
      if (!isRestoreFire) {
        const opposite = currentGroupChatOpen ? 'GATE.CHAT_CLOSE' : 'GATE.CHAT_OPEN';
        state.tickerHistory = state.tickerHistory.filter(m => m.category !== opposite);
        state.tickerHistory = broadcastTicker({
          id: crypto.randomUUID(),
          text: currentGroupChatOpen ? 'Group chat is now open!' : 'Group chat is now closed.',
          category: currentGroupChatOpen ? 'GATE.CHAT_OPEN' : 'GATE.CHAT_CLOSE',
          timestamp: Date.now(),
        }, state.tickerHistory, deps.getConnections);
      }
      state.lastKnownGroupChatOpen = currentGroupChatOpen;
    }

    isRestoreFire = false;
  });
}
