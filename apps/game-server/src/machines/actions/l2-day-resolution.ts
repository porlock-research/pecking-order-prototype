import { assign, enqueueActions, type AnyActorRef } from 'xstate';
import type { DailyManifest, DynamicManifest } from '@pecking-order/shared-types';
import { createDirectorMachine, type DirectorInput } from '../director';

export const l2DayResolutionActions = {
  /**
   * Resolve the current day's manifest. For STATIC manifests, the day already
   * exists in manifest.days[] — no-op. For DYNAMIC manifests, read the
   * director's resolved day and append it to manifest.days[].
   */
  resolveCurrentDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    // Director should have resolved a day — read from directorResolvedDay
    const resolvedDay = context.directorResolvedDay as DailyManifest | null;
    if (!resolvedDay) {
      // Day 1: no director output yet. Director spawns in activeSession
      // and resolves immediately via its context factory.
      return {};
    }

    // Append the resolved day to the manifest's days array
    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
      directorResolvedDay: null, // consumed
    };
  }),

  /**
   * Spawn a director actor for dynamic manifests. No-op for static.
   * The director resolves the current day's config in its context factory,
   * then observes FACT.* events throughout the day.
   */
  spawnDirectorIfDynamic: assign(({ context, spawn: spawnFn }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    // Stop previous director if any
    if (context.directorRef) {
      try { context.directorRef.stop(); } catch (_) { /* already stopped */ }
    }

    const input: DirectorInput = {
      dayIndex: context.dayIndex,
      roster: context.roster,
      ruleset: manifest.ruleset,
      schedulePreset: manifest.schedulePreset,
      gameHistory: context.gameHistory || [],
    };

    const ref = spawnFn(createDirectorMachine(), {
      id: 'director',
      input,
    });

    return { directorRef: ref };
  }),

  /**
   * After the director actor is spawned, read its initial resolvedDay
   * and append to manifest.days[] so L3 can find it via dayIndex lookup.
   */
  captureDirectorDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const directorRef = context.directorRef as AnyActorRef | null;
    if (!directorRef) return {};

    const directorSnap = directorRef.getSnapshot();
    const resolvedDay = directorSnap?.context?.resolvedDay as DailyManifest | null;
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
   * Forward FACT.RECORD events to the director actor (dynamic mode only).
   * No-op if no director is active.
   */
  forwardFactToDirector: enqueueActions(({ context, event, enqueue }: any) => {
    if (!context.directorRef) return;
    if (event.type !== 'FACT.RECORD') return;
    enqueue.sendTo(context.directorRef, event);
  }),

  /**
   * Cleanup director on activeSession exit. Stops the director actor.
   */
  captureDirectorOutputForNextDay: assign(({ context }: any) => {
    const directorRef = context.directorRef as AnyActorRef | null;
    if (!directorRef) return {};

    // Stop the director — we'll spawn a new one for the next day
    try { directorRef.stop(); } catch (_) { /* already stopped */ }

    return {
      directorResolvedDay: null,
      directorRef: null,
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
