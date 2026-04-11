import { usePillStates } from '../hooks/usePillStates';
import { Pill } from './Pill';

export function PulseBar() {
  const pills = usePillStates();

  if (pills.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        height: 48,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map(pill => (
        <Pill key={pill.id} pill={pill} />
      ))}
    </div>
  );
}
