import { useGameStore, selectDmSlots } from '../../../../store/useGameStore';
import { PencilSimple } from '../../icons';

interface Props { onClick: () => void; }

/**
 * Compose button — starts a new DM picking flow.
 *
 * The slot budget is a game-state resource, not a notification. It renders
 * as a capacity meter (used / total), not a numeric badge. Color ramp:
 *
 *   neutral  — plenty remaining (≥2 left)
 *   gold     — 1 slot left (scarcity warning)
 *   depleted — 0 left: icon dims, button disables, meter all pink
 *
 * Pink enters only when the budget is actually scarce — keeps the 10%
 * accent headroom Pulse's design principles demand.
 */
export function ComposeButton({ onClick }: Props) {
  const used = useGameStore(s => selectDmSlots(s).used);
  const total = useGameStore(s => selectDmSlots(s).total);
  const remaining = Math.max(total - used, 0);
  const depleted = remaining <= 0;
  const scarce = remaining === 1;

  const ariaLabel = depleted
    ? 'No DMs left today'
    : `Compose — ${remaining} DM${remaining === 1 ? '' : 's'} remaining today`;

  return (
    <button
      onClick={depleted ? undefined : onClick}
      aria-label={ariaLabel}
      disabled={depleted}
      style={{
        position: 'relative', width: 44, height: 44,
        borderRadius: 10, border: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        color: depleted ? 'var(--pulse-text-3)' : 'var(--pulse-text-1)',
        cursor: depleted ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
        opacity: depleted ? 0.55 : 1,
      }}
    >
      <PencilSimple size={16} weight="fill" />

      <SlotMeter total={total} used={used} depleted={depleted} scarce={scarce} />
    </button>
  );
}

function SlotMeter({
  total,
  used,
  depleted,
  scarce,
}: {
  total: number;
  used: number;
  depleted: boolean;
  scarce: boolean;
}) {
  // Filled = used, hollow = remaining. Visible capacity at a glance.
  // Dot size stays 4px; spacing 3px. Fits up to ~6 slots comfortably in
  // the button's 44px width; more than that compresses gracefully.
  const dotSize = total > 6 ? 3 : 4;
  const gap = total > 6 ? 2 : 3;
  const filledColor = depleted
    ? 'var(--pulse-accent)'
    : scarce
      ? 'var(--pulse-gold)'
      : 'var(--pulse-text-2)';
  const hollowColor = scarce ? 'var(--pulse-gold)' : 'var(--pulse-text-4)';

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < used;
        return (
          <span
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: filled ? filledColor : 'transparent',
              boxShadow: filled ? 'none' : `inset 0 0 0 1px ${hollowColor}`,
            }}
          />
        );
      })}
    </span>
  );
}
