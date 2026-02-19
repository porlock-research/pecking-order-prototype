import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Coins, Eye } from 'lucide-react';
import { useGameStore } from '../../../store/useGameStore';
import { SPRING, TAP } from '../springs';

interface ContextMenuProps {
  targetPlayerId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onMessage: (playerId: string) => void;
  onSendSilver: (playerId: string) => void;
  onSpyDms: (playerId: string) => void;
}

const MENU_ITEMS = [
  { key: 'message', label: 'Message', Icon: MessageCircle, action: 'onMessage' as const },
  { key: 'silver', label: 'Send Silver', Icon: Coins, action: 'onSendSilver' as const },
  { key: 'spy', label: 'Spy DMs', Icon: Eye, action: 'onSpyDms' as const },
] as const;

export function ContextMenu({ targetPlayerId, position, onClose, onMessage, onSendSilver, onSpyDms }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const roster = useGameStore(s => s.roster);
  const target = targetPlayerId ? roster[targetPlayerId] : null;

  const actions = { onMessage, onSendSilver, onSpyDms };

  useEffect(() => {
    if (!targetPlayerId) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [targetPlayerId, onClose]);

  // Position the menu within viewport bounds
  const menuStyle: React.CSSProperties = position ? {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 180),
    top: Math.min(position.y - 10, window.innerHeight - 200),
    zIndex: 60,
  } : {};

  return (
    <AnimatePresence>
      {targetPlayerId && position && (
        <motion.div
          ref={menuRef}
          style={menuStyle}
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={SPRING.snappy}
        >
          <div className="bg-skin-panel/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-card overflow-hidden min-w-[170px]">
            {target && (
              <div className="px-3 py-2.5 border-b border-white/[0.06]">
                <span className="text-sm font-bold text-skin-base">{target.personaName}</span>
              </div>
            )}
            {MENU_ITEMS.map(item => (
              <motion.button
                key={item.key}
                className="w-full flex items-center gap-3 px-3 py-3 text-base text-skin-base hover:bg-white/[0.06] transition-colors"
                onClick={() => {
                  if (targetPlayerId) {
                    actions[item.action](targetPlayerId);
                  }
                  onClose();
                }}
                whileTap={TAP.button}
                transition={SPRING.button}
              >
                <item.Icon size={18} className="text-skin-dim" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
