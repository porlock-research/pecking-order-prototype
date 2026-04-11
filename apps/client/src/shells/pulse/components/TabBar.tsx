import { MessageCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PULSE_TAP } from '../springs';

interface TabBarProps {
  activeTab: 'chat' | 'cast';
  onTabChange: (tab: 'chat' | 'cast') => void;
}

const tabs = [
  { id: 'chat' as const, label: 'Chat', Icon: MessageCircle },
  { id: 'cast' as const, label: 'Cast', Icon: Users },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        height: 56,
        borderTop: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <motion.button
            key={id}
            whileTap={PULSE_TAP.button}
            onClick={() => onTabChange(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--pulse-accent)' : 'var(--pulse-text-3)',
              transition: 'color 0.15s ease',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'var(--po-font-body)',
              }}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
