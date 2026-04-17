import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_Z } from '../../zIndex';
import { ComposeButton } from './ComposeButton';
import { PanelButton } from './PanelButton';
import { SilverPip } from '../common/SilverPip';

interface Props { onCompose: () => void; onOpenPanel: () => void; }

export function PulseHeader({ onCompose, onOpenPanel }: Props) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--pulse-space-sm) var(--pulse-space-md)',
      background: 'var(--pulse-surface)', borderBottom: '1px solid var(--pulse-border)',
      position: 'relative', zIndex: PULSE_Z.flow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-md)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
          Day {dayIndex || 1}
          <span style={{
            fontSize: 11, color: 'var(--pulse-text-3)', marginLeft: 'var(--pulse-space-sm)',
            textTransform: 'lowercase', fontWeight: 500,
          }}>· {String(phase || 'morning').toLowerCase()}</span>
        </div>
        <SilverPip variant="global" />
      </div>
      <div style={{ display: 'flex', gap: 'var(--pulse-space-sm)' }}>
        <ComposeButton onClick={onCompose} />
        <PanelButton onClick={onOpenPanel} />
      </div>
    </header>
  );
}
