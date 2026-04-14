import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectCastStripEntries, type CastStripEntry } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { CastChip } from './CastChip';
import { GroupChip } from './GroupChip';

export function CastStrip() {
  const entries = useGameStore(useShallow(selectCastStripEntries));
  const pickingMode = useGameStore(s => s.pickingMode);
  const togglePicked = useGameStore(s => s.togglePicked);
  const { openDM, openSocialPanel } = usePulse();

  const handleTap = (entry: CastStripEntry) => {
    if (pickingMode) {
      if (entry.kind === 'self' || entry.kind === 'group') return;
      togglePicked(entry.id);
      return;
    }
    if (entry.kind === 'self') {
      openSocialPanel();
      return;
    }
    openDM(entry.id, entry.kind === 'group');
  };

  if (entries.length === 0) return null;

  return (
    <div style={{
      padding: '14px 0 16px',
      background: `
        radial-gradient(ellipse at top, rgba(255,59,111,0.07), transparent 60%),
        linear-gradient(to bottom, var(--pulse-surface), var(--pulse-bg))
      `,
      borderBottom: '1px solid var(--pulse-border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      position: 'relative', zIndex: 2,
    }}>
      <div style={{
        display: 'flex', gap: 10, padding: '0 14px',
        overflowX: 'auto', overflowY: 'visible',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {entries.map(entry => {
          if (entry.kind === 'group') {
            if (pickingMode) return null;
            return <GroupChip key={entry.id} entry={entry} onTap={handleTap} />;
          }
          const pickable = !!pickingMode && entry.kind === 'player';
          const picked = pickingMode?.selected.includes(entry.id) ?? false;
          return (
            <CastChip
              key={entry.id}
              entry={entry}
              onTap={handleTap}
              pickingMode={!!pickingMode}
              picked={picked}
              pickable={pickable}
            />
          );
        })}
      </div>
    </div>
  );
}
