import { useGameStore } from '../../../../store/useGameStore';
import { ComposeButton } from './ComposeButton';
import { PanelButton } from './PanelButton';

interface Props { onCompose: () => void; onOpenPanel: () => void; }

export function PulseHeader({ onCompose, onOpenPanel }: Props) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px',
      background: 'var(--pulse-surface)', borderBottom: '1px solid var(--pulse-border)',
      position: 'relative', zIndex: 3,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
        Day {dayIndex || 1}
        <span style={{
          fontSize: 11, color: 'var(--pulse-text-3)', marginLeft: 8,
          textTransform: 'lowercase', fontWeight: 500,
        }}>· {String(phase || 'morning').toLowerCase()}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <ComposeButton onClick={onCompose} />
        <PanelButton onClick={onOpenPanel} />
      </div>
    </div>
  );
}
