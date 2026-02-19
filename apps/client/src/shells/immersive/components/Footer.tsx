import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Users } from 'lucide-react';
import { useGameStore } from '../../../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import { SPRING, TAP } from '../springs';

type TabKey = 'comms' | 'people';

interface FooterProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  playerId: string;
}

const TABS: Array<{ key: TabKey; label: string; Icon: typeof MessageCircle; accent: string; bar: string }> = [
  { key: 'comms', label: 'Comms', Icon: MessageCircle, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
  { key: 'people', label: 'People', Icon: Users, accent: 'text-skin-pink', bar: 'bg-skin-pink' },
];

export function Footer({ activeTab, onTabChange, playerId }: FooterProps) {
  const hasDms = useGameStore(s => {
    const channels = s.channels;
    return Object.values(channels).some(ch =>
      (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) &&
      ch.memberIds.includes(playerId) &&
      s.chatLog.some(m => m.channelId === ch.id)
    );
  });

  return (
    <footer className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-t border-white/[0.06] pb-safe">
      <nav className="flex items-stretch h-[72px] relative">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const hasBadge = tab.key === 'people' && !isActive && hasDms;
          return (
            <motion.button
              key={tab.key}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-colors relative
                ${isActive ? tab.accent : 'text-skin-dim opacity-50'}
              `}
              onClick={() => onTabChange(tab.key)}
              whileTap={TAP.button}
              transition={SPRING.button}
            >
              <span className="relative">
                <tab.Icon size={24} />
                {hasBadge && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-skin-pink animate-pulse-live" />}
              </span>
              <span className={`text-xs uppercase tracking-widest ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
              {isActive && (
                <motion.span
                  layoutId="footer-indicator"
                  className={`absolute top-0 left-2 right-2 h-0.5 ${tab.bar} rounded-full shadow-glow`}
                  transition={SPRING.snappy}
                />
              )}
            </motion.button>
          );
        })}
      </nav>
    </footer>
  );
}
