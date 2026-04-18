import { Trophy } from '../../icons';

interface Props { onClick: () => void; }

/**
 * Opens the Social Panel. The panel's hero content is Standings — pending
 * invites / conversations / silver / cartridge unread are all already
 * surfaced more specifically on the cast strip and pill bar, so this
 * button does NOT carry an aggregate unread badge. It's a pure "see the
 * pecking order" affordance.
 */
export function PanelButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Open standings"
      style={{
        position: 'relative', width: 44, height: 44,
        borderRadius: 10, border: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)', color: 'var(--pulse-text-1)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Trophy size={18} weight="fill" />
    </button>
  );
}
