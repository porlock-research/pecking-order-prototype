import { useCallback, useMemo } from 'react';
import { useGameStore, selectCastStripEntries, type CastStripEntry } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_Z } from '../../zIndex';
import { CastChip } from './CastChip';
import { GroupChip } from './GroupChip';

export function CastStrip() {
  const entries = useGameStore(selectCastStripEntries);
  const pickingMode = useGameStore(s => s.pickingMode);
  const togglePicked = useGameStore(s => s.togglePicked);
  const channels = useGameStore(s => s.channels);
  const { openDM, openSocialPanel } = usePulse();

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
    if (entry.kind === 'self') {
      openSocialPanel();
      return;
    }
    openDM(entry.id, entry.kind === 'group');
  }, [pickingMode, lockedIds, togglePicked, openSocialPanel, openDM]);

  if (entries.length === 0) return null;

  return (
    <div style={{
      // Vertical padding moved INTO the scroll container below — `overflow-x:
      // auto` forces `overflow-y: auto` per CSS spec, clipping badges that
      // project above/below the chip (e.g. the YOU badge at top: -8). The
      // scroller needs breathing room inside its clip rect to show them.
      padding: '2px 0 6px',
      background: `
        radial-gradient(ellipse at top, rgba(255,59,111,0.07), transparent 60%),
        linear-gradient(to bottom, var(--pulse-surface), var(--pulse-bg))
      `,
      borderBottom: '1px solid var(--pulse-border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      position: 'relative', zIndex: PULSE_Z.flow,
    }}>
      <div style={{
        display: 'flex', gap: 'var(--pulse-space-sm)',
        // Top 12 fits the "You" badge (top: -8) + 4px safety. Bottom 10 fits
        // the typing badge (bottom: -3) + 7px safety so the chip's gap-to-
        // chat below still reads clean. Horizontal padding is the edge gutter.
        padding: 'var(--pulse-space-md) var(--pulse-space-md) 10px',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {entries.map(entry => {
          if (entry.kind === 'group') {
            if (pickingMode) return null;
            return <GroupChip key={entry.id} entry={entry} onTap={handleTap} />;
          }
          const locked = lockedIds.has(entry.id);
          const pickable = !!pickingMode && entry.kind === 'player' && !locked;
          const picked = pickingMode?.selected.includes(entry.id) ?? false;
          return (
            <CastChip
              key={entry.id}
              entry={entry}
              onTap={handleTap}
              pickingMode={!!pickingMode}
              picked={picked}
              pickable={pickable}
              locked={locked}
            />
          );
        })}
      </div>
    </div>
  );
}
