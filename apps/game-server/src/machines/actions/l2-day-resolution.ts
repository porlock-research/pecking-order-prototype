import { assign, enqueueActions, type AnyActorRef } from 'xstate';
import type { DailyManifest, GameMasterAction, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, PlayerStatuses, GameMasterActionTypes } from '@pecking-order/shared-types';
import type { GameMasterInput } from '../game-master';
import { log } from '../../log';

export const l2DayResolutionActions = {
  /**
   * Resolve the current day's manifest. For STATIC manifests, the day already
   * exists in manifest.days[] — no-op. For DYNAMIC manifests, read the
   * Game Master's resolved day and append it to manifest.days[].
   */
  resolveCurrentDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return {};

    const snap = gameMasterRef.getSnapshot();
    const resolvedDay = snap?.context?.resolvedDay as DailyManifest | null;
    if (!resolvedDay) return {};

    const alreadyExists = manifest.days.some((d: DailyManifest) => d.dayIndex === resolvedDay.dayIndex);
    if (alreadyExists) return {};

    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
    };
  }),

  /**
   * Spawn Game Master actor at game init (dynamic mode only).
   * Long-lived: lives from pregame through postgame.
   */
  spawnGameMasterIfDynamic: assign(({ context, spawn: spawnFn }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    // Don't re-spawn if already exists (e.g., snapshot restore)
    if (context.gameMasterRef) return {};

    const input: GameMasterInput = {
      roster: context.roster,
      ruleset: manifest.ruleset,
      schedulePreset: manifest.schedulePreset,
      startTime: manifest.startTime,
      gameHistory: context.gameHistory || [],
    };

    const ref = spawnFn('gameMasterMachine', {
      id: 'game-master',
      input,
    });

    return { gameMasterRef: ref };
  }),

  /**
   * Send RESOLVE_DAY to Game Master and capture the resolved day in one action.
   * Must be a single assign() so the send is synchronous — enqueueActions queues
   * the sendTo for after ALL entry actions, which means a separate captureGameMasterDay
   * would read stale state (XState v5 batches entry actions).
   */
  sendAndCaptureGameMasterDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return {};

    // Send directly — spawned actor processes synchronously
    gameMasterRef.send({
      type: Events.GameMaster.RESOLVE_DAY,
      dayIndex: context.dayIndex,
      roster: context.roster,
    });

    // Read snapshot immediately after synchronous processing
    const snap = gameMasterRef.getSnapshot();
    const resolvedDay = snap?.context?.resolvedDay as DailyManifest | null;
    if (!resolvedDay) return {};

    const alreadyExists = manifest.days.some((d: DailyManifest) => d.dayIndex === resolvedDay.dayIndex);
    if (alreadyExists) return {};

    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
    };
  }),

  /**
   * Forward FACT.RECORD events to the Game Master (dynamic mode only).
   * Uses direct .send() — enqueueActions would queue the delivery after the
   * current action batch, but we need the GM to process facts immediately
   * so subsequent actions in the same batch see updated state.
   */
  forwardFactToGameMaster: ({ context, event }: any) => {
    if (!context.gameMasterRef) return;
    if (event.type !== Events.Fact.RECORD) return;
    context.gameMasterRef.send(event);
  },

  /**
   * Send DAY_ENDED to Game Master at nightSummary.
   * Direct .send() — must execute before processGameMasterActions in the
   * same entry batch would read stale state (though currently DAY_ENDED
   * runs AFTER processGameMasterActions, keeping this consistent).
   */
  sendDayEndedToGameMaster: ({ context }: any) => {
    if (!context.gameMasterRef) return;
    context.gameMasterRef.send({
      type: Events.GameMaster.DAY_ENDED,
      dayIndex: context.dayIndex,
      roster: context.roster,
    });
  },

  /**
   * Send GAME_ENDED to Game Master at gameSummary.
   */
  sendGameEndedToGameMaster: ({ context }: any) => {
    if (!context.gameMasterRef) return;
    context.gameMasterRef.send({
      type: Events.GameMaster.GAME_ENDED,
    });
  },

  /**
   * Process Game Master actions at nightSummary (runs AFTER processNightSummary).
   * Reads gameMasterActions from Game Master snapshot and applies eliminations.
   * Separate action — does NOT modify the existing elimination pipeline.
   */
  processGameMasterActions: enqueueActions(({ context, enqueue }: any) => {
    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return;

    const snap = gameMasterRef.getSnapshot();
    const actions: GameMasterAction[] = snap?.context?.gameMasterActions ?? [];
    if (actions.length === 0) return;

    const rosterUpdate = { ...context.roster };
    let rosterChanged = false;

    // XState v5 entry action batching: processNightSummary's enqueue.assign
    // hasn't been applied yet, so context.roster still has the voted-out player
    // as ALIVE. Pre-apply the pending voting elimination to our local copy so
    // we count alive correctly and don't overwrite the voting elimination.
    const pendingId = context.pendingElimination?.eliminatedId;
    if (pendingId && rosterUpdate[pendingId]?.status === PlayerStatuses.ALIVE) {
      rosterUpdate[pendingId] = { ...rosterUpdate[pendingId], status: PlayerStatuses.ELIMINATED };
      rosterChanged = true;
    }

    const aliveCount = Object.values(rosterUpdate).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
    let remaining = aliveCount;

    for (const action of actions) {
      if (action.action === GameMasterActionTypes.ELIMINATE) {
        const player = rosterUpdate[action.playerId];
        if (!player || player.status !== PlayerStatuses.ALIVE) continue;
        if (remaining <= 2) break;

        log('info', 'L2', 'Game Master eliminating player', {
          playerId: action.playerId,
          reason: action.reason,
        });

        rosterUpdate[action.playerId] = { ...player, status: PlayerStatuses.ELIMINATED };
        rosterChanged = true;
        remaining--;

        enqueue.raise({
          type: Events.Fact.RECORD,
          fact: {
            type: FactTypes.ELIMINATION,
            actorId: 'GAME_MASTER',
            targetId: action.playerId,
            payload: { mechanism: 'INACTIVITY', reason: action.reason, dayIndex: context.dayIndex },
            timestamp: Date.now(),
          },
        } as any);
      }
    }

    if (rosterChanged) {
      enqueue.assign({ roster: rosterUpdate });
    }
  }),
};

export const l2DayResolutionGuards = {
  /**
   * Check if the game should end after a completed day.
   * For STATIC: dayIndex >= manifest.days.length
   * For DYNAMIC: winner set or only 1 alive
   */
  isGameComplete: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (context.winner !== null) return true;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
      return alive <= 1;
    }

    return context.dayIndex >= (manifest.days.length ?? Infinity);
  },

  /**
   * Safety guard on the dayLoop state — catches overshoot.
   */
  isDayIndexPastEnd: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
      return alive <= 1;
    }

    return context.dayIndex > (manifest.days.length ?? 7);
  },
};
