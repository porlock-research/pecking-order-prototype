import type { ActorRefFrom } from "xstate";
import type { Connection } from "partyserver";
import type { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import type { orchestratorMachine } from "./machines/l2-orchestrator";
import { extractL3Context, extractCartridges, broadcastSync } from "./sync";
import { buildDebugSummary, broadcastTicker, broadcastDebugTicker, stateToTicker } from "./ticker";
import { updateGameEnd, creditGold } from "./d1-persistence";
import { notifyLobbyGameStatus } from "./lobby-callback";
import { log } from "./log";
import type { Env } from "./types";
import { getOnlinePlayerIds } from "./ws-handlers";

/**
 * Pure gate for the IN_PROGRESS → lobby STARTED callback. Fires once when
 * L2 first leaves `preGame` (i.e. when joiners are no longer accepted —
 * handlePlayerJoined already 409s past preGame). dayLoop is a compound
 * state so `snapshot.value` is `{ dayLoop: ... }` (object); excluding only
 * the two simple pre-game atomic states keeps this correct without
 * enumerating dayLoop's substates.
 *
 * The original PR #130 fired this at /init time, which broke email
 * invites: invitees who hadn't yet clicked their link found the game
 * already STARTED and were rejected by getInviteInfo() with "this game is
 * no longer accepting players".
 */
export function shouldFireInProgress(
  l2State: unknown,
  gameId: unknown,
  alreadyNotified: boolean,
): boolean {
  if (alreadyNotified) return false;
  if (typeof gameId !== 'string' || gameId.length === 0) return false;
  return l2State !== 'uninitialized' && l2State !== 'preGame';
}

/** Mutable state owned by the server, updated by the subscription callback. */
export interface SubscriptionState {
  lastKnownChatLog: any[];
  lastBroadcastState: string;
  lastKnownDmsOpen: boolean;
  lastKnownGroupChatOpen: boolean;
  tickerHistory: TickerMessage[];
  lastDebugSummary: string;
  goldCredited: boolean;
  /** Per-side flags so a transient failure on one path doesn't strand the
   *  other (one shared flag would mean a D1 hiccup permanently skips the
   *  lobby callback, or vice versa). Both still set optimistically — the
   *  underlying calls are fire-and-forget and don't surface failures, so
   *  full retry-on-failure is a future improvement. Issue #49 review. */
  d1CompletionWritten: boolean;
  lobbyCompletionNotified: boolean;
  /** IN_PROGRESS → lobby STARTED is fired exactly once on the first
   *  subscription tick where L2 has left preGame (the original PR #130
   *  fired this on /init, which broke email invites — invitees would land
   *  on a STARTED game that no longer accepted joiners). */
  lobbyStartedNotified: boolean;
}

export interface SubscriptionDeps {
  getActor: () => ActorRefFrom<typeof orchestratorMachine> | undefined;
  storage: DurableObjectStorage;
  env: Env;
  scheduler: Scheduler<Env>;
  state: SubscriptionState;
  connectedPlayers: Map<string, Set<string>>;
  getConnections: () => Iterable<Connection>;
  /** Keep cross-isolate promises alive past the actor's tick. */
  waitUntil: (p: Promise<unknown>) => void;
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

  // Debounce SYNC broadcast — complex transitions (nightSummary, FACT.RECORD chains)
  // trigger 10-15+ assign() calls, each firing this subscription. Without debouncing,
  // each fires a full SYNC broadcast + snapshot serialize, flooding the client.
  // The save is kept synchronous for durability; only broadcasts are batched.
  let syncPending = false;

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

    // C. Broadcast SYSTEM.SYNC to all clients (debounced via microtask)
    // Multiple rapid assign() calls within a single transition batch into one broadcast.
    if (!syncPending) {
      syncPending = true;
      queueMicrotask(() => {
        syncPending = false;
        const currentActor = deps.getActor();
        if (!currentActor) return;
        const latestSnapshot = currentActor.getSnapshot();
        const { l3Context: latestL3, l3Snapshot: latestL3Snap, chatLog: latestChat } =
          extractL3Context(latestSnapshot, deps.state.lastKnownChatLog);
        const latestCartridges = extractCartridges(latestSnapshot);
        broadcastSync(
          { snapshot: latestSnapshot, l3Context: latestL3, l3SnapshotValue: latestL3Snap?.value, chatLog: latestChat, cartridges: latestCartridges },
          deps.getConnections,
          getOnlinePlayerIds(deps.connectedPlayers),
        );
      });
    }

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
    //
    // Fire on `gameSummary` (winner declared) rather than `gameOver` (actor
    // stopped). gameSummary → gameOver requires an admin NEXT_STAGE today,
    // so gating on gameOver leaves the lobby AND game-server `Games.status`
    // stranded at STARTED/IN_PROGRESS indefinitely after the winner is
    // decided. Issue #49 surfaced the lobby half; the game-server half had
    // the same wedge. Strict equality on snapshot.value (top-level L2
    // states are simple strings) avoids any substring collision with L3
    // state JSON.
    const l2State = snapshot.value;

    // IN_PROGRESS → lobby STARTED. See shouldFireInProgress() for the gate
    // rationale and the regression it prevents.
    if (shouldFireInProgress(l2State, snapshot.context.gameId, state.lobbyStartedNotified)) {
      state.lobbyStartedNotified = true;
      deps.storage.sql.exec(
        `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('lobby_started_notified', 'true', unixepoch())`
      );
      deps.waitUntil(notifyLobbyGameStatus(deps.env, snapshot.context.gameId, 'IN_PROGRESS'));
    }

    const isGameEnded = l2State === 'gameSummary' || l2State === 'gameOver';
    if (isGameEnded && snapshot.context.gameId) {
      // game-server D1: write Games.status='COMPLETED' once.
      if (!state.d1CompletionWritten) {
        state.d1CompletionWritten = true;
        deps.storage.sql.exec(
          `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('d1_completion_written', 'true', unixepoch())`
        );
        updateGameEnd(deps.env.DB, snapshot.context.gameId, snapshot.context.roster);
      }
      // Lobby: notify once, kept alive past the actor's tick via waitUntil.
      if (!state.lobbyCompletionNotified) {
        state.lobbyCompletionNotified = true;
        deps.storage.sql.exec(
          `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('lobby_completion_notified', 'true', unixepoch())`
        );
        deps.waitUntil(notifyLobbyGameStatus(deps.env, snapshot.context.gameId, 'COMPLETED'));
      }

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
