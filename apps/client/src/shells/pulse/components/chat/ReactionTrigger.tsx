import { Smile } from 'lucide-react';

interface ReactionTriggerProps {
  messageId: string;
  isOpen: boolean;
  onOpen: () => void;
}

export function ReactionTrigger({ messageId, isOpen, onOpen }: ReactionTriggerProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isOpen ? 'var(--pulse-accent-glow)' : 'transparent',
        color: isOpen ? 'var(--pulse-accent)' : 'var(--pulse-text-3)',
        opacity: isOpen ? 1 : undefined,
        transition: 'all 0.15s ease',
      }}
      className="pulse-reaction-trigger"
    >
      <Smile size={16} />
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
