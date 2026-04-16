import { Smiley } from '../../icons';

interface ReactionTriggerProps {
  messageId: string;
  isOpen: boolean;
  onOpen: () => void;
}

export function ReactionTrigger({ messageId: _messageId, isOpen, onOpen }: ReactionTriggerProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label="React to message"
      aria-expanded={isOpen}
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isOpen ? 'var(--pulse-accent-glow)' : 'transparent',
        color: isOpen ? 'var(--pulse-accent)' : 'var(--pulse-text-3)',
        opacity: isOpen ? 1 : undefined,
        transition: 'background 150ms ease, color 150ms ease, opacity 150ms ease',
      }}
      className="pulse-reaction-trigger"
    >
      <Smiley size={16} weight="fill" />
      <style>{`
        @media (hover: hover) {
          .pulse-reaction-trigger { opacity: 0 !important; }
          *:hover > .pulse-reaction-trigger { opacity: 1 !important; }
        }
        @media (hover: none) {
          .pulse-reaction-trigger { opacity: 0.45 !important; }
        }
      `}</style>
    </button>
  );
}
