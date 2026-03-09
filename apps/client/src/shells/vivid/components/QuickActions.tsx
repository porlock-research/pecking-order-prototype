import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatCircleDots, CurrencyDollarSimple, User } from '@phosphor-icons/react';
import { VIVID_SPRING } from '../springs';

interface QuickActionsProps {
  targetPlayerId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onMessage: (playerId: string) => void;
  onSendSilver: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
}

const MENU_WIDTH = 200;
const MENU_HEIGHT = 160;

const ACTIONS = [
  {
    key: 'message',
    label: 'Message',
    Icon: ChatCircleDots,
    color: 'var(--vivid-teal)',
    handler: 'onMessage' as const,
  },
  {
    key: 'silver',
    label: 'Send Silver',
    Icon: CurrencyDollarSimple,
    color: 'var(--vivid-gold)',
    handler: 'onSendSilver' as const,
  },
  {
    key: 'profile',
    label: 'View Profile',
    Icon: User,
    color: 'var(--vivid-lavender)',
    handler: 'onViewProfile' as const,
  },
] as const;

export function QuickActions({
  targetPlayerId,
  position,
  onClose,
  onMessage,
  onSendSilver,
  onViewProfile,
}: QuickActionsProps) {
  const isOpen = targetPlayerId !== null && position !== null;

  const handlers = { onMessage, onSendSilver, onViewProfile };

  // Compute clamped position so the menu stays within viewport bounds
  const menuStyle: React.CSSProperties | undefined = position
    ? {
        position: 'fixed',
        left: Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)),
        top: Math.max(8, Math.min(position.y - 10, window.innerHeight - MENU_HEIGHT - 8)),
        zIndex: 51,
      }
    : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — catches taps outside to dismiss */}
          <motion.div
            key="quick-actions-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={onClose}
          />

          {/* Popover */}
          <motion.div
            key="quick-actions-popover"
            style={menuStyle}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={VIVID_SPRING.snappy}
          >
            <div
              style={{
                background: 'var(--vivid-bg-elevated)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
                minWidth: MENU_WIDTH,
              }}
            >
              {ACTIONS.map((action, i) => (
                <motion.button
                  key={action.key}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, ...VIVID_SPRING.snappy }}
                  onClick={() => {
                    if (targetPlayerId) {
                      handlers[action.handler](targetPlayerId);
                    }
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      i < ACTIONS.length - 1
                        ? '1px solid rgba(255, 255, 255, 0.06)'
                        : 'none',
                    color: 'var(--vivid-text)',
                    fontSize: 15,
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onPointerEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255, 255, 255, 0.06)';
                  }}
                  onPointerLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <action.Icon size={22} weight="duotone" color={action.color} />
                  <span>{action.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
