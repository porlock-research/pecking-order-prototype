import React, { useCallback, useMemo, useRef } from 'react';
import { useGameStore, selectCastStripEntries, type CastStripEntry } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { useHasOverflow } from '../../hooks/useHasOverflow';
import { PULSE_Z } from '../../zIndex';
import { CastChip } from './CastChip';
import { GroupChip } from './GroupChip';
import { ShareChip } from './ShareChip';
import { DayPhases } from '@pecking-order/shared-types';

/** Pull the invite code from the client URL (`/game/CODE`). The shell only
 *  mounts under that route so the match is reliable; returns null in dev
 *  harnesses or when the path shape differs (no chip rendered then). */
function getGameCodeFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

/**
 * View Transitions: each CastChip carries `data-chip-player-id`, and the
 * chip → DmHero face morph (driven from PulseShell.openDM) queries that
 * attribute to tag the source. Passive chip reorders (eliminations,
 * rank changes) don't morph — that would require wrapping the store
 * commit in `runViewTransition` and giving each chip a stable
 * `view-transition-name: chip-${playerId}` during reorder only.
 * Deferred: the same `chip-${playerId}` name is claimed transiently by
 * the DM-open morph, so a persistent stable tag would collide.
 */
export function CastStrip() {
  const entries = useGameStore(selectCastStripEntries);
  const pickingMode = useGameStore(s => s.pickingMode);
  const togglePicked = useGameStore(s => s.togglePicked);
  const channels = useGameStore(s => s.channels);
  const phase = useGameStore(s => s.phase);
  const { openDM, openSocialPanel, openDossier } = usePulse();

  const lockedIds = useMemo(() => {
    if (pickingMode?.kind !== 'add-member') return new Set<string>();
    const ch = channels?.[pickingMode.channelId];
    if (!ch) return new Set<string>();
    return new Set<string>([...(ch.memberIds ?? []), ...(ch.pendingMemberIds ?? [])]);
  }, [pickingMode, channels]);

  const handleTap = useCallback((entry: CastStripEntry) => {
    if (pickingMode) {
      if (entry.kind === 'self' || entry.kind === 'group') return;
      if (lockedIds.has(entry.id)) return;
      togglePicked(entry.id);
      return;
    }
    // Pregame override — DMs are closed and the regular tap-to-DM gesture
    // has nothing to bind to. Route taps (including self) to the Pregame
    // Dossier sheet, which surfaces persona + bio + QA and (for self) the
    // First Impressions reveal action.
    if (phase === DayPhases.PREGAME && entry.kind !== 'group') {
      openDossier(entry.id);
      return;
    }
    if (entry.kind === 'self') {
      openSocialPanel();
      return;
    }
    openDM(entry.id, entry.kind === 'group');
  }, [pickingMode, lockedIds, togglePicked, openSocialPanel, openDM, openDossier, phase]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const overflow = useHasOverflow(scrollRef);

  if (entries.length === 0) return null;

  return (
    <div style={{
      // Vertical padding moved INTO the scroll container below — `overflow-x:
      // auto` forces `overflow-y: auto` per CSS spec, clipping badges that
      // project above/below the chip (e.g. the YOU badge at top: -8). The
      // scroller needs breathing room inside its clip rect to show them.
      padding: '2px 0 6px',
      background: `
        radial-gradient(ellipse at top, color-mix(in oklch, var(--pulse-accent) 7%, transparent), transparent 60%),
        linear-gradient(to bottom, var(--pulse-surface), var(--pulse-bg))
      `,
      borderBottom: '1px solid var(--pulse-border-2)',
      position: 'relative', zIndex: PULSE_Z.flow,
    }}>
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: 'var(--pulse-space-sm)',
          // Top 12 fits the "You" badge (top: -8) + 4px safety. Bottom 10 fits
          // the typing badge (bottom: -3) + 7px safety so the chip's gap-to-
          // chat below still reads clean. Horizontal padding is the edge gutter.
          padding: 'var(--pulse-space-md) var(--pulse-space-md) 10px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
        }}
      >
        {(() => {
          // Insert a single hairline divider before the first eliminated
          // chip. Spatial grouping (gap + rule) reads better than a section
          // header in a horizontal band.
          let eliminatedDividerRendered = false;
          const rendered: React.ReactNode[] = [];
          for (const entry of entries) {
            if (entry.kind === 'group') {
              if (pickingMode) continue;
              rendered.push(<GroupChip key={entry.id} entry={entry} onTap={handleTap} />);
              continue;
            }
            if (entry.isEliminated) {
              // Picking mode never shows non-self eliminated chips — you
              // can't add an out-player to a channel. Self is rendered
              // regardless (can't remove yourself from the strip).
              if (pickingMode && entry.kind !== 'self') continue;
              // Divider is a boundary between alive and non-self eliminated
              // chips. If the current entry is self-eliminated (priority 0,
              // position 0), do NOT render a divider before it — a divider
              // at position 0 reads as broken, not as grouping.
              if (!eliminatedDividerRendered && entry.kind !== 'self') {
                rendered.push(<CastStripDivider key="__elim-divider" />);
                eliminatedDividerRendered = true;
              }
              rendered.push(
                <CastChip
                  key={entry.id}
                  entry={entry}
                  onTap={handleTap}
                  pickingMode={!!pickingMode}
                  picked={false}
                  pickable={false}
                  locked={false}
                />,
              );
              continue;
            }
            const locked = lockedIds.has(entry.id);
            const pickable = !!pickingMode && entry.kind === 'player' && !locked;
            const picked = pickingMode?.selected.includes(entry.id) ?? false;
            rendered.push(
              <CastChip
                key={entry.id}
                entry={entry}
                onTap={handleTap}
                pickingMode={!!pickingMode}
                picked={picked}
                pickable={pickable}
                locked={locked}
              />,
            );
          }
          // Share chip — pregame only, hidden during picking mode
          // (picking is a focused-action context; share would distract).
          // Tail position so it reads as "extend the cast" rather than
          // displacing real chips.
          if (phase === DayPhases.PREGAME && !pickingMode) {
            const gameCode = getGameCodeFromPath();
            if (gameCode) {
              rendered.push(<ShareChip key="__share-chip" gameCode={gameCode} />);
            }
          }
          return rendered;
        })()}
      </div>
      <CastStripEdgeFade side="left" visible={overflow.left} />
      <CastStripEdgeFade side="right" visible={overflow.right} />
    </div>
  );
}

/**
 * Cast strip edge fade. The strip's ambient background is a gradient
 * (pink radial + surface→bg linear) so we fade toward `--pulse-bg`, the
 * darkest stop — that's where the bottom edge of the strip meets the
 * chat below, and matches closely enough near the outer edges to feel
 * seamless. pointer-events:none so it never swallows chip taps.
 */
function CastStripEdgeFade({ side, visible }: { side: 'left' | 'right'; visible: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 28,
        pointerEvents: 'none',
        background: `linear-gradient(to ${side}, transparent, var(--pulse-bg))`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    />
  );
}

/**
 * Hairline between alive and eliminated chips. Vertical rule that fades at
 * the top/bottom so it doesn't hard-crop the strip's ambient gradient —
 * reads as a quiet boundary, not a section bar. Role="separator" for AT.
 */
function CastStripDivider() {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Eliminated cast"
      style={{
        flex: '0 0 auto',
        width: 1,
        alignSelf: 'stretch',
        // xs (4px) each side keeps the rule tight to its neighbors; the
        // flex `gap: sm` between chips adds the remaining breathing room.
        // Vertical pads mirror the chip's top/bottom badge safety inside the
        // scroll container so the rule sits within the chip-body band.
        margin: '10px var(--pulse-space-xs) 8px',
        background:
          'linear-gradient(to bottom, transparent 0%, color-mix(in oklch, var(--pulse-text-3) 42%, transparent) 22%, color-mix(in oklch, var(--pulse-text-3) 42%, transparent) 78%, transparent 100%)',
        scrollSnapAlign: 'start',
      }}
    />
  );
}
