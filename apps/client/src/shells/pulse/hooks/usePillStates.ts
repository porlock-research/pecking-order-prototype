import { useMemo } from 'react';
import { CARTRIDGE_INFO } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { useNowTick } from './useNowTick';

function prettyLabel(typeKey: string | undefined, fallback: string): string {
  if (!typeKey) return fallback;
  return CARTRIDGE_INFO[typeKey]?.displayName ?? fallback;
}

export type PillLifecycle = 'upcoming' | 'starting' | 'just-started' | 'needs-action' | 'urgent' | 'in-progress' | 'completed';

/**
 * Pill kinds:
 *   Cartridges (have act + reveal phases): voting | game | prompt | dilemma
 *   Social windows (timeline-driven open/close, no acting):  dms | group
 *   Boundary anchor (gold; pregame / day-end / night):       boundary
 */
export type PillKind = 'voting' | 'game' | 'prompt' | 'dilemma' | 'dms' | 'group' | 'boundary';

export type CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma';

export interface PillState {
  id: string;
  kind: PillKind;
  label: string;
  lifecycle: PillLifecycle;
  timeRemaining?: number;
  progress?: string;
  playerActed?: boolean;
  cartridgeData?: any;

  /**
   * Pre-formatted meta string rendered after the label, e.g. "16:00",
   * "5m 00s left", "open · ends 12:00", "result". Computed in usePillStates
   * so Pill.tsx is a dumb renderer; recomputes on every useNowTick tick.
   */
  meta?: string;

  /** True for dms/group pills. Pill.tsx skips ACT_VERB / dot / urgent for these. */
  isSocialWindow?: boolean;

  /** Wall-clock window times (ms epoch) for sortable chronology + meta copy. */
  startTime?: number;
  endTime?: number;

  /**
   * Hero variant payload for boundary pills in pregame / night. When present,
   * Pill.tsx renders a 72px two-line layout (eyebrow + body + rel countdown)
   * instead of the normal label/meta line.
   */
  hero?: { eyebrow: string; body: string; rel?: string };
}

/**
 * Past-tense verb for the player's own action, shown in the in-progress
 * (acted) lifecycle as microcopy after the label. Universal per cartridge
 * kind so the acted state always reads as "you did X" — distinct from the
 * completed state's universal noun "result" which describes the all-player
 * artifact.
 *
 * The verb-vs-noun split is intentional: acted = verb (your action),
 * completed = noun (the artifact). They stop competing because they refer
 * to different concepts.
 */
export const ACT_VERB: Record<CartridgeKind, string> = {
  voting: 'cast',
  game: 'placed',
  prompt: 'sent',
  dilemma: 'chosen',
};

const ACTION_TO_KIND: Record<string, CartridgeKind> = {
  OPEN_VOTING: 'voting',
  START_GAME: 'game',
  START_ACTIVITY: 'prompt',
  START_DILEMMA: 'dilemma',
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_VOTING: 'Vote',
  START_GAME: 'Game',
  START_ACTIVITY: 'Activity',
  START_DILEMMA: 'Dilemma',
};

/** Pair OPEN/CLOSE timeline actions for social-window pills. */
const SOCIAL_OPEN_ACTIONS: Record<string, { kind: 'dms' | 'group'; closeAction: string; label: string }> = {
  OPEN_DMS:        { kind: 'dms',   closeAction: 'CLOSE_DMS',        label: 'DMs' },
  OPEN_GROUP_CHAT: { kind: 'group', closeAction: 'CLOSE_GROUP_CHAT', label: 'Group' },
};

/** Cartridge kind → close timeline action (for urgent-on-imminent-close). */
const CLOSE_ACTION_FOR_CARTRIDGE: Record<CartridgeKind, string> = {
  voting: 'CLOSE_VOTING',
  game: 'END_GAME',
  prompt: 'END_ACTIVITY',
  dilemma: 'END_DILEMMA',
};

/** Threshold (ms) before close-time at which a not-yet-acted cartridge flips to urgent. */
const URGENT_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Captured at module load — App.tsx normalizes the URL to /game/CODE on
 * load (drops query string), so reading window.location.search inside the
 * hook would always be empty by the time it runs. Capturing once at module
 * eval time wins the race with the URL strip.
 */
/**
 * Read the force-urgent debug param. App.tsx stashes the URL param into
 * sessionStorage on game-route entry (before the URL strip), so we read
 * from there. Returns null when not set.
 */
function readForceUrgent(): CartridgeKind | null {
  if (typeof window === 'undefined') return null;
  // Check sessionStorage first (survives the App's URL strip), then live URL
  // for cases where the strip hasn't happened yet (e.g., showcase route).
  const stash = sessionStorage.getItem('po-force-urgent');
  const live = new URLSearchParams(window.location.search).get('force-urgent');
  const v = stash || live;
  if (!v) return null;
  return (v === 'voting' || v === 'game' || v === 'prompt' || v === 'dilemma') ? v : null;
}

export type DayPhase = 'pregame' | 'day' | 'night';

/**
 * Detect day phase from manifest's day timeline. Pregame: before first event.
 * Night: after END_DAY (or last timeline event). Day: between.
 *
 * Falls back to 'day' when there's no manifest or no timeline (DYNAMIC days
 * without a built manifest, missing scheduling, etc.) — safer to show
 * cartridges than to false-positive-hide them.
 */
export function derivePhase(manifest: any, dayIndex: number, now: number): DayPhase {
  const day = manifest?.days?.[dayIndex - 1] ?? manifest?.days?.[dayIndex];
  if (!day?.timeline || manifest?.scheduling !== 'PRE_SCHEDULED') return 'day';
  const tl = (day.timeline as any[]).filter((e) => e.time?.includes('T'));
  if (tl.length === 0) return 'day';
  const times = tl.map((e) => new Date(e.time).getTime());
  const start = Math.min(...times);
  const endDay = tl.find((e) => e.action === 'END_DAY');
  const end = endDay ? new Date(endDay.time).getTime() : Math.max(...times);
  if (now < start) return 'pregame';
  if (now >= end) return 'night';
  return 'day';
}

/**
 * Hook variant of derivePhase. Re-evaluates on store mutations only —
 * callers that need second-level granularity should pair this with their
 * own setInterval-driven re-render. (Most consumers are fine with the
 * mutation cadence + the natural re-renders on pill state changes.)
 */
export function useDayPhase(): DayPhase {
  const manifest = useGameStore((s) => s.manifest);
  const dayIndex = useGameStore((s) => s.dayIndex);
  return useMemo(() => derivePhase(manifest, dayIndex, Date.now()), [manifest, dayIndex]);
}

/** Pull the day-level type field for a given action kind from the manifest day. */
function dayTypeKeyFor(kind: CartridgeKind, day: any): string | undefined {
  switch (kind) {
    case 'voting': return day?.voteType && day.voteType !== 'NONE' ? day.voteType : undefined;
    case 'game': return day?.gameType && day.gameType !== 'NONE' ? day.gameType : undefined;
    case 'prompt': return day?.activityType && day.activityType !== 'NONE' ? day.activityType : undefined;
    case 'dilemma': return day?.dilemmaType && day.dilemmaType !== 'NONE' ? day.dilemmaType : undefined;
  }
}

/** Build a minimal cartridgeData object for upcoming/starting pills so the
 *  overlay's info splash can render the specific CARTRIDGE_INFO entry. */
function upcomingCartridgeData(kind: CartridgeKind, typeKey: string | undefined): any {
  if (!typeKey) return undefined;
  switch (kind) {
    case 'voting': return { voteType: typeKey };
    case 'game': return { gameType: typeKey };
    case 'prompt': return { promptType: typeKey };
    case 'dilemma': return { dilemmaType: typeKey };
  }
}

/** Build the cartridgeId `${kind}-${dayIndex}-${typeKey}` scheme. */
function cartridgeIdFor(kind: CartridgeKind, dayIndex: number, typeKey: string | undefined): string {
  return `${kind}-${dayIndex}-${typeKey || 'UNKNOWN'}`;
}

function votingTypeKey(c: any): string | undefined {
  return c?.mechanism || c?.voteType;
}
function gameTypeKey(c: any): string | undefined {
  return c?.gameType;
}
function promptTypeKey(c: any): string | undefined {
  return c?.promptType;
}
function dilemmaTypeKey(c: any): string | undefined {
  return c?.dilemmaType;
}

export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemma);
  const completed = useGameStore(s => s.completedCartridges);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const playerId = useGameStore(s => s.playerId);
  // Tick once per second so countdown meta strings update without store
  // mutations driving the re-render.
  const tickNow = useNowTick(1000);

  return useMemo(() => {
    const pills: PillState[] = [];
    // Only today's completed cartridges are relevant to the pill bar.
    // completedCartridges accumulates across the whole game; without this filter
    // Day 1's pills would bleed into Day 2+.
    const todayCompleted = (completed ?? []).filter(c => c.dayIndex === dayIndex);
    const todayCompletedIds = new Set(todayCompleted.map(c => c.key));

    // Active voting
    if (voting) {
      const typeKey = votingTypeKey(voting);
      const cartridgeId = cartridgeIdFor('voting', dayIndex, typeKey);
      const totalVoters = voting.eligibleVoters?.length ?? 0;
      const castCount = Object.keys(voting.votes || {}).length;
      const playerActed = playerId ? Boolean(voting.votes?.[playerId]) : false;
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      pills.push({
        id: cartridgeId,
        kind: 'voting',
        label: prettyLabel(typeKey, 'Vote'),
        lifecycle: thisCompleted || voting.phase === 'REVEAL' || voting.phase === 'WINNER'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        progress: totalVoters > 0 ? `${castCount}/${totalVoters}` : undefined,
        playerActed,
        cartridgeData: voting,
      });
    }

    // Active game
    if (game) {
      const typeKey = gameTypeKey(game);
      const cartridgeId = cartridgeIdFor('game', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // Async games (trivia/arcade) expose per-player `status` dict;
      // sync-decision games expose a top-level `phase`. Check both.
      //
      // Completion signal: `thisCompleted` (L2 wrote completedCartridges) or
      // sync-decision `phase`. Do NOT use `game.allPlayerResults` as a
      // completion signal — the projection emits it the moment the calling
      // player's status flips to AWAITING_DECISION (so ArcadeGameWrapper can
      // render the in-game leaderboard during the post-run retry screen).
      // It does not mean the cartridge is done. Treating it as done flips the
      // pill to 'completed' early, which makes CartridgeOverlay swap the
      // playable mount for the result card, robbing the player of the score
      // countdown / retry decision phase.
      const perPlayerStatus = playerId ? (game.status as any)?.[playerId] : undefined;
      const playerActed =
        perPlayerStatus === 'PLAYING'
        || perPlayerStatus === 'COMPLETED'
        || perPlayerStatus === 'AWAITING_DECISION';
      const gameLifecycle: PillLifecycle =
        thisCompleted
          || game.phase === 'COMPLETED' || game.phase === 'REVEAL'
          ? 'completed'
        : game.phase === 'PLAYING' || game.phase === 'ACTIVE' || playerActed
          ? 'in-progress'
        : 'needs-action';

      pills.push({
        id: cartridgeId,
        kind: 'game',
        label: prettyLabel(typeKey, 'Game'),
        lifecycle: gameLifecycle,
        playerActed,
        cartridgeData: game,
      });
    }

    // Active prompt
    if (prompt) {
      const typeKey = promptTypeKey(prompt);
      const cartridgeId = cartridgeIdFor('prompt', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // Use the uniform `participated` projection (projections.ts). Each
      // prompt type stores submissions under a different field — some
      // stripped from SYNC during active phases — so the client must not
      // depend on any single type-specific field.
      const playerActed = playerId ? Boolean(prompt.participated?.[playerId]) : false;
      pills.push({
        id: cartridgeId,
        kind: 'prompt',
        label: prettyLabel(typeKey, 'Activity'),
        lifecycle: thisCompleted || prompt.phase === 'RESULTS'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        playerActed,
        cartridgeData: prompt,
      });
    }

    // Active dilemma
    if (dilemma) {
      const typeKey = dilemmaTypeKey(dilemma);
      const cartridgeId = cartridgeIdFor('dilemma', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // `decisions` is stripped from the projection during COLLECTING —
      // use the uniform `participated` (mirrored as `submitted`) field.
      const playerActed = playerId
        ? Boolean(dilemma.participated?.[playerId] || dilemma.submitted?.[playerId])
        : false;
      pills.push({
        id: cartridgeId,
        kind: 'dilemma',
        label: prettyLabel(typeKey, 'Dilemma'),
        lifecycle: thisCompleted || dilemma.phase === 'REVEAL'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        playerActed,
        cartridgeData: dilemma,
      });
    }

    // Today's completed cartridges not already represented by an active slot
    // (active slots keep their refs live per ADR-126 result-hold, but can be
    // absent after gameSummary teardown; render completed-only pills to fill
    // the gap).
    //
    // Attach cartridgeData with the appropriate type field so PulseBar's
    // `pillToCartridgeId` reconstructs the same cartridgeId the server uses
    // (`${kind}-${dayIndex}-${typeKey}`). Without cartridgeData, PulseBar
    // falls back to 'UNKNOWN' and the overlay's focusCartridge lookup fails
    // against completedCartridges.
    for (const c of todayCompleted) {
      if (!pills.some(p => p.id === c.key)) {
        const typeKey =
          c.snapshot?.mechanism ||
          c.snapshot?.voteType ||
          c.snapshot?.gameType ||
          c.snapshot?.promptType ||
          c.snapshot?.dilemmaType ||
          '';
        const cartridgeData =
          typeKey
            ? c.kind === 'voting' ? { mechanism: typeKey, voteType: typeKey, ...c.snapshot }
            : c.kind === 'game' ? { gameType: typeKey, ...c.snapshot }
            : c.kind === 'prompt' ? { promptType: typeKey, ...c.snapshot }
            : { dilemmaType: typeKey, ...c.snapshot }
            : c.snapshot;
        pills.push({
          id: c.key,
          kind: c.kind,
          label: prettyLabel(typeKey, c.kind),
          lifecycle: 'completed',
          cartridgeData,
        });
      }
    }

    // Timeline-driven pills from current day (PRE_SCHEDULED only — ADMIN events
    // have no fixed times). Emits 'upcoming' for future events; 'starting' for
    // past-due events whose active slot hasn't populated yet (ADR-128 SYNC gap).
    //
    // Suppress any upcoming/starting pill whose kind already has an ACTIVE or
    // COMPLETED representation (completed included: a Day N completed cartridge
    // makes any past-due timeline entry for that kind redundant).
    const day = manifest?.days?.[dayIndex - 1] ?? manifest?.days?.[dayIndex];
    if (day?.timeline && manifest?.scheduling === 'PRE_SCHEDULED') {
      const now = Date.now();
      for (const ev of day.timeline as any[]) {
        const kind = ACTION_TO_KIND[ev.action];
        if (!kind) continue;
        let eventTime: number | null = null;
        if (ev.time?.includes('T')) {
          eventTime = new Date(ev.time).getTime();
        }
        if (eventTime === null) continue;

        const alreadyRepresented = pills.some(p => p.kind === kind);
        if (alreadyRepresented) continue;

        // Resolve the day-level type so the overlay splash can render the
        // specific CARTRIDGE_INFO entry instead of a generic "Activity"/"Vote".
        const typeKey = dayTypeKeyFor(kind, day);
        const label = prettyLabel(typeKey, ACTION_LABELS[ev.action] || kind);
        const cartridgeData = upcomingCartridgeData(kind, typeKey);

        if (eventTime > now) {
          pills.push({
            id: `upcoming-${ev.action}-${ev.time}`,
            kind,
            label,
            lifecycle: 'upcoming',
            timeRemaining: Math.floor((eventTime - now) / 1000),
            cartridgeData,
            startTime: eventTime,
          });
        } else {
          pills.push({
            id: `starting-${ev.action}-${ev.time}`,
            kind,
            label,
            lifecycle: 'starting',
            cartridgeData,
            startTime: eventTime,
          });
        }
      }
    }

    // ── Social-window pills (DMs / group chat) ──────────────────────────────
    // Pair OPEN_* and CLOSE_* timeline events into single window pills with
    // start + end times. Skip the urgent / acted / unread treatments (per
    // mockup): social windows are not cartridges and have no "result".
    if (day?.timeline && manifest?.scheduling === 'PRE_SCHEDULED') {
      const now = Date.now();
      const tl = day.timeline as any[];
      // Collect already-paired open events keyed by (action, time) so duplicates
      // (rare, but possible if a manifest is regenerated) don't double-emit.
      for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        const meta = SOCIAL_OPEN_ACTIONS[ev.action];
        if (!meta) continue;
        const openTime = ev.time?.includes('T') ? new Date(ev.time).getTime() : null;
        if (openTime === null) continue;

        // Find the next CLOSE_* of the same kind after this open. The playtest
        // preset interleaves multiple open/close pairs — pair to the nearest
        // future close.
        let closeTime: number | null = null;
        for (let j = i + 1; j < tl.length; j++) {
          if (tl[j].action === meta.closeAction && tl[j].time?.includes('T')) {
            const t = new Date(tl[j].time).getTime();
            if (t >= openTime) { closeTime = t; break; }
          }
        }
        // Lifecycle: upcoming → needs-action (during window) → completed.
        // Reuse needs-action visually because the design "active treatment"
        // applies; ACT_VERB / urgent / dot are gated on isSocialWindow in
        // Pill.tsx so the social pill stays calm-active without action verbs.
        const lifecycle: PillLifecycle =
          now < openTime ? 'upcoming'
          : (closeTime !== null && now >= closeTime) ? 'completed'
          : 'needs-action';

        pills.push({
          id: `${meta.kind}-${dayIndex}-${ev.time}`,
          kind: meta.kind,
          label: meta.label,
          lifecycle,
          isSocialWindow: true,
          startTime: openTime,
          endTime: closeTime ?? undefined,
        });
      }
    }

    // ── Cartridge close-time stamping + urgent upgrade ──────────────────────
    // PRE_SCHEDULED only. Walks CLOSE_VOTING / END_GAME / END_ACTIVITY /
    // END_DILEMMA timeline entries. For every matching active pill, stamp
    // endTime so countdowns can be formatted. Additionally upgrade
    // needs-action → urgent when the player hasn't acted and close is within
    // URGENT_THRESHOLD_MS.
    if (day?.timeline && manifest?.scheduling === 'PRE_SCHEDULED') {
      const now = tickNow;
      for (const ev of day.timeline as any[]) {
        if (!ev.time?.includes('T')) continue;
        const closeTime = new Date(ev.time).getTime();
        for (const k of Object.keys(CLOSE_ACTION_FOR_CARTRIDGE) as CartridgeKind[]) {
          if (CLOSE_ACTION_FOR_CARTRIDGE[k] !== ev.action) continue;
          // Stamp endTime on every active-or-acted pill of this kind.
          const live = pills.find(
            p => p.kind === k && (p.lifecycle === 'needs-action' || p.lifecycle === 'in-progress'),
          );
          if (live && live.endTime === undefined) live.endTime = closeTime;
          // Urgent upgrade
          if (closeTime > now && closeTime - now <= URGENT_THRESHOLD_MS) {
            const pill = pills.find(p => p.kind === k && p.lifecycle === 'needs-action');
            if (pill && !pill.playerActed) {
              pill.lifecycle = 'urgent';
              pill.endTime = closeTime;
            }
          }
        }
      }
    }

    // ── Phase detection ────────────────────────────────────────────────────
    // pregame: before the day's first timeline event
    // night:   after END_DAY (or last timeline event)
    // day:     between
    let phase: 'pregame' | 'day' | 'night' = 'day';
    let dayStartMs: number | null = null;
    let dayEndMs: number | null = null;
    if (day?.timeline && manifest?.scheduling === 'PRE_SCHEDULED') {
      const tl = (day.timeline as any[]).filter(e => e.time?.includes('T'));
      if (tl.length > 0) {
        const times = tl.map(e => new Date(e.time).getTime());
        dayStartMs = Math.min(...times);
        const endDay = tl.find(e => e.action === 'END_DAY');
        dayEndMs = endDay ? new Date(endDay.time).getTime() : Math.max(...times);
        const now = Date.now();
        if (now < dayStartMs) phase = 'pregame';
        else if (dayEndMs !== null && now >= dayEndMs) phase = 'night';
        else phase = 'day';
      }
    }

    // ── Debug: ?force-urgent=voting|game|prompt|dilemma ────────────────────
    // Visual-test path for the urgent visual when timing/manifest doesn't
    // naturally produce one. App.tsx stashes the param into sessionStorage
    // before stripping the URL on game-route entry; readForceUrgent() pulls
    // from there.
    const forced = readForceUrgent();
    if (forced) {
      let target = pills.find(p => p.kind === forced);
      if (!target) {
        target = {
          id: `forced-${forced}`,
          kind: forced,
          label: forced === 'voting' ? 'Vote' : forced === 'game' ? 'Wager' : forced === 'prompt' ? 'Prompt' : 'Dilemma',
          lifecycle: 'urgent',
          startTime: tickNow - 60_000,
        };
        pills.push(target);
      }
      target.lifecycle = 'urgent';
      target.endTime = tickNow + 4 * 60 * 1000;
      target.playerActed = false;
    }

    // ── Format meta strings ────────────────────────────────────────────────
    // Per-state copy that ticks with `tickNow`. Pill.tsx is a dumb renderer
    // for these strings.
    for (const p of pills) {
      p.meta = formatPillMeta(p, tickNow);
    }

    // ── Chronological sort (active/upcoming pills) ─────────────────────────
    // Sort by startTime ascending. Active pills without startTime go first
    // (they're already running). Completed pills go after upcoming so the
    // row reads chronologically left-to-right within a day.
    pills.sort((a, b) => {
      const sa = a.startTime ?? 0;
      const sb = b.startTime ?? 0;
      return sa - sb;
    });

    // ── Boundary pill ──────────────────────────────────────────────────────
    // Always present, anchors the day's right edge (mini variant during day)
    // or stands alone as a hero anchor (pregame / night).
    //
    // The pregame-only-shows-boundary rule lives at the render layer
    // (PulseBar) so CartridgeOverlay's pill-by-id lookup still works during
    // pregame for programmatically-focused cartridges (e.g., deep links).
    const boundary = buildBoundaryPill({ phase, dayStartMs, dayEndMs, now: tickNow, dayIndex });
    if (boundary) {
      boundary.meta = formatPillMeta(boundary, tickNow);
      pills.push(boundary);
    }

    return pills;
  }, [voting, game, prompt, dilemma, completed, manifest, dayIndex, playerId, tickNow]);
}

/**
 * Per-state meta copy. Returns the right-of-label microcopy that pairs with
 * the pill's lifecycle. Recomputes on every tick so countdowns are live.
 */
function formatPillMeta(p: PillState, now: number): string | undefined {
  // Boundary mini variant: "17:00 · in 12m" (the hero variant uses pill.hero
  // and ignores meta).
  if (p.kind === 'boundary') {
    if (p.hero) return undefined;
    if (p.endTime === undefined) return undefined;
    return `${formatClock(p.endTime)} · in ${formatRelative(p.endTime - now)}`;
  }

  // Social windows
  if (p.isSocialWindow) {
    if (p.lifecycle === 'upcoming' && p.startTime !== undefined) return formatClock(p.startTime);
    if (p.lifecycle === 'needs-action') {
      if (p.endTime !== undefined) {
        const remaining = p.endTime - now;
        return remaining < 60 * 60 * 1000
          ? `open · ${formatCountdown(remaining)}`
          : `open · ends ${formatClock(p.endTime)}`;
      }
      return 'open';
    }
    if (p.lifecycle === 'completed') return 'closed';
    return undefined;
  }

  // Cartridges
  switch (p.lifecycle) {
    case 'upcoming':
      return p.startTime !== undefined ? formatClock(p.startTime) : undefined;
    case 'starting':
      return 'starting…';
    case 'just-started':
    case 'needs-action':
    case 'urgent':
      return p.endTime !== undefined ? formatCountdown(p.endTime - now) : undefined;
    case 'in-progress':
      // Acted: verb microcopy is rendered separately by Pill.tsx (italic
      // kind-color span), then the countdown follows.
      return p.endTime !== undefined ? formatCountdown(p.endTime - now) : undefined;
    case 'completed':
      return 'result';
  }
  return undefined;
}

/** "5m 30s left" / "1h 12m left" — standalone meta. */
function formatCountdown(ms: number): string {
  const m = Math.max(0, ms / 60_000);
  const mInt = Math.floor(m);
  const sInt = Math.max(0, Math.floor((m - mInt) * 60));
  if (m < 60) return `${mInt}m ${String(sInt).padStart(2, '0')}s left`;
  const hh = Math.floor(mInt / 60);
  const mm = mInt % 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m left`;
}

/**
 * Build the boundary pill ("Day starts" / "Day ends" / "Night") based on
 * phase. Hero variant in pregame & night carries an eyebrow + body + rel
 * countdown. Mini variant during day shows label + meta with end-time.
 */
function buildBoundaryPill(opts: {
  phase: 'pregame' | 'day' | 'night';
  dayStartMs: number | null;
  dayEndMs: number | null;
  now: number;
  dayIndex: number;
}): PillState | null {
  const { phase, dayStartMs, dayEndMs, now, dayIndex } = opts;

  if (phase === 'pregame' && dayStartMs !== null) {
    return {
      id: 'boundary-pregame',
      kind: 'boundary',
      label: `Day ${dayIndex} starts`,
      lifecycle: 'upcoming',
      startTime: dayStartMs,
      endTime: dayStartMs,
      hero: {
        eyebrow: `Day ${dayIndex} starts`,
        body: formatClock(dayStartMs),
        rel: formatRelative(dayStartMs - now),
      },
    };
  }

  if (phase === 'night' && dayEndMs !== null) {
    // Next-day open is a guess (24h after this morning's open) — refined when
    // tomorrow's manifest day lands. Hero copy reads symmetrically with the
    // pregame anchor: eyebrow names the next day, body is the clock time,
    // rel is the bare relative — BoundaryHeroPill adds the "in" prefix.
    const nextOpen = (dayStartMs ?? dayEndMs) + 24 * 60 * 60 * 1000;
    return {
      id: 'boundary-night',
      kind: 'boundary',
      label: `Day ${dayIndex + 1} starts`,
      lifecycle: 'upcoming',
      startTime: Number.MAX_SAFE_INTEGER, // boundary always last
      endTime: nextOpen,
      hero: {
        eyebrow: `Day ${dayIndex + 1} starts`,
        body: formatClock(nextOpen),
        rel: formatRelative(nextOpen - now),
      },
    };
  }

  if (phase === 'day' && dayEndMs !== null) {
    // Escalate the lifecycle when day-end is imminent. The mini boundary
    // pill is calm by default; flipping to 'urgent' inside Pill.tsx triggers
    // the bolder "phase ending soon" treatment (accent ring + faster pulse)
    // so a row reading "Day ends · in 3m" feels appropriately loud without
    // taking over the screen.
    const remainingMs = dayEndMs - now;
    const lifecycle: PillLifecycle =
      remainingMs > 0 && remainingMs <= 5 * 60 * 1000 ? 'urgent' : 'upcoming';
    return {
      id: 'boundary-day',
      kind: 'boundary',
      label: 'Day ends',
      lifecycle,
      startTime: Number.MAX_SAFE_INTEGER, // anchors right edge
      endTime: dayEndMs,
    };
  }

  return null;
}

/** "10:00" / "16:00" — 24h clock for hero body. */
function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Used after "in" prefix; no trailing "left". "5m" / "1h 30m" / "12s". */
function formatRelative(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 1) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${s}s`;
  }
  if (m < 60) return `${m}m`;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}m`;
}
