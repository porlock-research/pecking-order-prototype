import { ACTION_INFO } from '@pecking-order/shared-types';
import type { CompletedCartridge } from '../../../../store/useGameStore';

/** Visual state for a timeline event card */
export type CardState = 'upcoming' | 'active' | 'completed';

/** A timeline event enriched with display state and optional result data */
export interface DashboardEvent {
  /** Original manifest time string ("09:00" or ISO) */
  time: string;
  /** Manifest action (OPEN_VOTING, START_GAME, etc.) */
  action: string;
  /** Visual card state */
  state: CardState;
  /** Human-readable label */
  label: string;
  /** Event category for styling/icons */
  category: 'voting' | 'game' | 'prompt' | 'social' | 'day';
  /** Completed cartridge snapshot (only when state === 'completed') */
  result?: CompletedCartridge['snapshot'];
  /** Optional payload from manifest */
  payload?: any;
}

/** Category mapping for actions — labels derived from ACTION_INFO */
const ACTION_CATEGORIES: Record<string, DashboardEvent['category']> = {
  OPEN_GROUP_CHAT: 'social',
  CLOSE_GROUP_CHAT: 'social',
  OPEN_DMS: 'social',
  CLOSE_DMS: 'social',
  OPEN_VOTING: 'voting',
  CLOSE_VOTING: 'voting',
  START_GAME: 'game',
  END_GAME: 'game',
  START_ACTIVITY: 'prompt',
  END_ACTIVITY: 'prompt',
  END_DAY: 'day',
};

function getActionMeta(action: string): { label: string; category: DashboardEvent['category'] } {
  const category = ACTION_CATEGORIES[action] ?? 'day';
  const info = ACTION_INFO[action];
  return { label: info?.name ?? action, category };
}

/**
 * Pairs that represent a single logical event (open/close, start/end).
 * We collapse these into one card keyed by the "open" action.
 */
const PAIRED_ACTIONS: Record<string, string> = {
  CLOSE_VOTING: 'OPEN_VOTING',
  END_GAME: 'START_GAME',
  END_ACTIVITY: 'START_ACTIVITY',
  CLOSE_GROUP_CHAT: 'OPEN_GROUP_CHAT',
  CLOSE_DMS: 'OPEN_DMS',
};

interface ManifestEvent {
  time: string;
  action: string;
  payload?: any;
}

interface BuildDashboardEventsInput {
  timeline: ManifestEvent[];
  completedCartridges: CompletedCartridge[];
  serverState: unknown;
  dayIndex: number;
}

/**
 * Transform manifest timeline events into enriched dashboard events.
 * Collapses paired events, determines card state, merges results.
 */
export function buildDashboardEvents(input: BuildDashboardEventsInput): DashboardEvent[] {
  const { timeline, completedCartridges, serverState, dayIndex } = input;

  // Determine what phase is currently active from serverState
  const activePhase = getActivePhase(serverState);

  // Build a set of completed categories for this day
  const completedByKind: Record<string, CompletedCartridge['snapshot']> = {};
  for (const c of completedCartridges) {
    if ((c.snapshot.dayIndex ?? 0) === dayIndex || (c.snapshot.dayIndex ?? 0) === 0) {
      completedByKind[c.kind] = c.snapshot;
    }
  }

  const events: DashboardEvent[] = [];

  for (const event of timeline) {
    // Skip "close" halves — they're merged into the "open" card
    if (PAIRED_ACTIONS[event.action]) continue;
    // Skip internal-only actions not meant for player-facing schedule
    if (event.action === 'INJECT_PROMPT' || event.action === 'START_CARTRIDGE') continue;

    const meta = getActionMeta(event.action);

    // Determine card state
    let state: CardState = 'upcoming';

    if (meta.category === 'voting') {
      if (completedByKind['voting']) {
        state = 'completed';
      } else if (activePhase === 'voting') {
        state = 'active';
      }
    } else if (meta.category === 'game') {
      if (completedByKind['game']) {
        state = 'completed';
      } else if (activePhase === 'game') {
        state = 'active';
      }
    } else if (meta.category === 'prompt') {
      if (completedByKind['prompt']) {
        state = 'completed';
      } else if (activePhase === 'prompt') {
        state = 'active';
      }
    } else if (meta.category === 'social') {
      // Social events are "active" once we're past the initial phase
      if (activePhase) {
        state = 'active';
      }
    }

    events.push({
      time: event.time,
      action: event.action,
      state,
      label: meta.label,
      category: meta.category,
      result: state === 'completed' ? completedByKind[meta.category] : undefined,
      payload: event.payload,
    });
  }

  return events;
}

/** Infer which phase is active from the server state value */
function getActivePhase(serverState: unknown): string | null {
  if (!serverState) return null;
  // XState value can be string or nested object — flatten to string
  const s = typeof serverState === 'string'
    ? serverState.toLowerCase()
    : JSON.stringify(serverState).toLowerCase();
  if (s.includes('voting') || s.includes('nightsummary')) return 'voting';
  if (s.includes('game')) return 'game';
  if (s.includes('prompt') || s.includes('activity')) return 'prompt';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'social';
  return null;
}

/**
 * Format a time string for display.
 * Handles both "09:00" (clock time) and ISO strings.
 */
export function formatEventTime(time: string): string {
  // ISO string
  if (time.includes('T')) {
    try {
      const d = new Date(time);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return time;
    }
  }
  // "HH:MM" clock time
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }
  return time;
}
