import { useMemo } from 'react';
import { useDayPhase, type DayPhase, type PillState } from '../hooks/usePillStates';
import { useNowTick } from '../hooks/useNowTick';
import { useGameStore } from '../../../store/useGameStore';

/**
 * NowLine — a single tracked-caps line above the pill row that names the
 * day's most-relevant *now* and *next* events. Tells the day at speech speed;
 * the pills underneath are the visual map.
 *
 * Algorithm (priority order for the Now slot):
 *   1. urgent cartridge        → Now goes pink ("has-urgent")
 *   2. active cartridge        → Now is body color
 *   3. acted (in-progress)     → Now is body color (you're in)
 *   4. social-window active    → Now is faded; Next gets gold emphasis
 *   5. nothing live            → "Day clear"
 *
 * Next slot:
 *   - Next upcoming pill (chronologically), with relative or wall-clock
 *     time depending on distance. < 60min → "in 5m". ≥ 60min → "16:00".
 *   - If no upcoming → boundary's countdown ("Day ends · in 12m").
 */
interface NowLineProps {
  pills: PillState[];
  /** Override Date.now() for tests. */
  now?: number;
}

export function NowLine({ pills, now }: NowLineProps) {
  // Re-render every second so the "Next · in 5m" copy ticks live. The Now
  // copy already ticks because pill.meta strings are recomputed in
  // usePillStates each second, but the Next slot does its own time-math.
  const tickNow = useNowTick(1000, now === undefined);
  const effectiveNow = now ?? tickNow;
  const phase = useDayPhase();
  const dayIndex = useGameStore((s) => s.dayIndex);
  const computed = useMemo(
    () => computeNowLine(pills, effectiveNow, phase, dayIndex),
    [pills, effectiveNow, phase, dayIndex],
  );
  if (!computed) return null;

  const { nowText, nextText, hasUrgent, isFaded } = computed;

  return (
    <div
      data-testid="pulse-now-line"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px 4px',
        flexWrap: 'wrap',
        fontFamily: 'var(--po-font-display, var(--po-font-body))',
        fontSize: 10,
        letterSpacing: 0.22 * 10,
        textTransform: 'uppercase',
        fontWeight: 800,
        color: 'var(--pulse-text-3)',
        background: 'var(--pulse-surface)',
        borderBottom: '1px solid var(--pulse-border)',
      }}
    >
      <Slot
        labelText="Now"
        bodyText={nowText}
        labelColor={hasUrgent ? 'var(--pulse-accent)' : 'var(--pulse-text-3)'}
        bodyColor={
          hasUrgent
            ? 'var(--pulse-accent)'
            : isFaded
              ? 'var(--pulse-text-3)'
              : 'var(--pulse-text-1)'
        }
      />
      <Slot
        labelText="Next"
        bodyText={nextText}
        labelColor={isFaded ? 'var(--pulse-gold)' : 'var(--pulse-text-3)'}
        bodyColor={isFaded ? 'var(--pulse-gold)' : 'var(--pulse-text-1)'}
      />
    </div>
  );
}

function Slot({
  labelText,
  bodyText,
  labelColor,
  bodyColor,
}: {
  labelText: string;
  bodyText: string;
  labelColor: string;
  bodyColor: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: labelColor }}>{labelText}</span>
      <span style={{ color: bodyColor }}>{bodyText}</span>
    </div>
  );
}

/**
 * Pure derivation of now-line copy from a pill array. Exported for tests.
 *
 * Phase awareness:
 *   - pregame: Now = "Pregame", Next = "Day N · in Xm" from boundary
 *   - day:     Now = primary active (or "Day clear"), Next = next upcoming
 *   - night:   Now = "Night", Next = "Day N+1 · in Xh Ym"
 */
export function computeNowLine(
  pills: PillState[],
  now: number,
  phase: DayPhase = 'day',
  dayIndex: number = 1,
): { nowText: string; nextText: string; hasUrgent: boolean; isFaded: boolean } | null {
  if (pills.length === 0) return null;

  const boundary = pills.find((p) => p.kind === 'boundary');

  // Pregame: nothing's live; the boundary anchor is the only meaningful copy.
  if (phase === 'pregame') {
    const startMs = boundary?.startTime ?? boundary?.endTime;
    return {
      nowText: 'Pregame',
      nextText:
        startMs !== undefined
          ? `Day ${dayIndex} · in ${formatRelative(startMs - now)}`
          : `Day ${dayIndex} · soon`,
      hasUrgent: false,
      isFaded: true,
    };
  }

  // Night: day has ended; surface tomorrow's anchor explicitly. The previous
  // copy ("Day ends · in 5h 35m") read as nonsense in this phase.
  if (phase === 'night') {
    // Game over (winner crowned, or last day's night) — the boundary pill
    // already flipped to the 'boundary-gameover' variant ("Game over /
    // Crowned"). Without this branch, NowLine kept predicting a non-existent
    // Day N+1, which read as a stale countdown next to the correct boundary.
    if (boundary?.id === 'boundary-gameover') {
      return {
        nowText: 'Game over',
        nextText: 'Crowned',
        hasUrgent: false,
        isFaded: true,
      };
    }
    const nextOpenMs = boundary?.endTime;
    return {
      nowText: 'Night',
      nextText:
        nextOpenMs !== undefined
          ? `Day ${dayIndex + 1} · in ${formatRelative(nextOpenMs - now)}`
          : `Day ${dayIndex + 1} · soon`,
      hasUrgent: false,
      isFaded: true,
    };
  }

  // Day: pick the most-action-relevant active pill for Now.
  const cartridgePills = pills.filter(
    (p) => p.kind === 'voting' || p.kind === 'game' || p.kind === 'prompt' || p.kind === 'dilemma',
  );
  const urgent = pills.find((p) => p.lifecycle === 'urgent' && p.kind !== 'boundary');
  const activeCartridge = cartridgePills.find((p) => p.lifecycle === 'needs-action');
  const actedCartridge = cartridgePills.find((p) => p.lifecycle === 'in-progress');
  const activeWindow = pills.find((p) => p.isSocialWindow && p.lifecycle === 'needs-action');
  const primary = urgent || activeCartridge || actedCartridge || activeWindow;

  let nowText: string;
  if (primary) {
    nowText = primary.meta ? `${primary.label} · ${primary.meta}` : `${primary.label} · live`;
  } else {
    nowText = 'Day clear';
  }

  // Fade Now if the primary is a passive long-window with > 60min remaining
  // and no urgent cartridge is competing for attention.
  const isFaded = !!(
    !urgent &&
    primary?.isSocialWindow &&
    primary.endTime &&
    primary.endTime - now > 60 * 60 * 1000
  );

  // Next: first upcoming pill chronologically (boundary excluded — that's the
  // day-end anchor, not "what's next on the timeline"). Fall back to boundary.
  const upcoming = pills
    .filter((p) => p.lifecycle === 'upcoming' && p.kind !== 'boundary')
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  const next = upcoming[0];

  let nextText: string;
  if (next && next.startTime !== undefined) {
    const minsTo = (next.startTime - now) / 60_000;
    nextText =
      minsTo < 60
        ? `${next.label} · in ${formatRelative(next.startTime - now)}`
        : `${next.label} · ${formatClock(next.startTime)}`;
  } else if (boundary && boundary.endTime !== undefined) {
    nextText = `Day ends · in ${formatRelative(boundary.endTime - now)}`;
  } else {
    nextText = '—';
  }

  return { nowText, nextText, hasUrgent: !!urgent, isFaded };
}

/** "5m" / "1h 30m" — used after "in" prefix; no trailing "left". */
function formatRelative(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 1) return `${Math.max(0, Math.floor(ms / 1000))}s`;
  if (m < 60) return `${m}m`;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
