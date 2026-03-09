import { assign, enqueueActions, type AnyActorRef } from 'xstate';
import type { DailyManifest, DynamicManifest } from '@pecking-order/shared-types';
import { createGameMasterMachine, type GameMasterInput } from '../game-master';

export const l2DayResolutionActions = {
  /**
   * Resolve the current day's manifest. For STATIC manifests, the day already
   * exists in manifest.days[] — no-op. For DYNAMIC manifests, read the
   * Game Master's resolved day and append it to manifest.days[].
   */
  resolveCurrentDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    // Game Master should have resolved a day — read from gameMasterResolvedDay
    const resolvedDay = context.gameMasterResolvedDay as DailyManifest | null;
    if (!resolvedDay) {
      // Day 1: no Game Master output yet. Game Master spawns in activeSession
      // and resolves immediately via its context factory.
      return {};
    }

    // Append the resolved day to the manifest's days array
    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
      gameMasterResolvedDay: null, // consumed
    };
  }),

  /**
   * Spawn a Game Master actor for dynamic manifests. No-op for static.
   * The Game Master resolves the current day's config in its context factory,
   * then observes FACT.* events throughout the day.
   */
  spawnGameMasterIfDynamic: assign(({ context, spawn: spawnFn }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    // Stop previous Game Master if any
    if (context.gameMasterRef) {
      try { context.gameMasterRef.stop(); } catch (_) { /* already stopped */ }
    }

    const input: GameMasterInput = {
      dayIndex: context.dayIndex,
      roster: context.roster,
      ruleset: manifest.ruleset,
      schedulePreset: manifest.schedulePreset,
      gameHistory: context.gameHistory || [],
    };

    const ref = spawnFn(createGameMasterMachine(), {
      id: 'game-master',
      input,
    });

    return { gameMasterRef: ref };
  }),

  /**
   * After the Game Master actor is spawned, read its initial resolvedDay
   * and append to manifest.days[] so L3 can find it via dayIndex lookup.
   */
  captureGameMasterDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return {};

    const gameMasterSnap = gameMasterRef.getSnapshot();
    const resolvedDay = gameMasterSnap?.context?.resolvedDay as DailyManifest | null;
    if (!resolvedDay) return {};

    // Idempotent: don't append if already exists
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
   * Forward FACT.RECORD events to the Game Master actor (dynamic mode only).
   * No-op if no Game Master is active.
   */
  forwardFactToGameMaster: enqueueActions(({ context, event, enqueue }: any) => {
    if (!context.gameMasterRef) return;
    if (event.type !== 'FACT.RECORD') return;
    enqueue.sendTo(context.gameMasterRef, event);
  }),

  /**
   * Cleanup Game Master on activeSession exit. Stops the Game Master actor.
   */
  captureGameMasterOutput: assign(({ context }: any) => {
    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return {};

    // Stop the Game Master — we'll spawn a new one for the next day
    try { gameMasterRef.stop(); } catch (_) { /* already stopped */ }

    return {
      gameMasterResolvedDay: null,
      gameMasterRef: null,
    };
  }),
};

export const l2DayResolutionGuards = {
  /**
   * Check if the game should end after a completed day (nightSummary context).
   * dayIndex has been set and the day has finished running.
   * For STATIC: dayIndex >= manifest.days.length (day N of N just finished)
   * For DYNAMIC: winner set or only 1 alive
   */
  isGameComplete: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (context.winner !== null) return true;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === 'ALIVE').length;
      return alive <= 1;
    }

    return context.dayIndex >= (manifest.days.length ?? Infinity);
  },

  /**
   * Safety guard on the dayLoop state — catches overshoot.
   * dayIndex was just incremented but the day hasn't run yet.
   * Uses strict `>` to avoid blocking the last valid day.
   */
  isDayIndexPastEnd: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === 'ALIVE').length;
      return alive <= 1;
    }

    return context.dayIndex > (manifest.days.length ?? 7);
  },
};
