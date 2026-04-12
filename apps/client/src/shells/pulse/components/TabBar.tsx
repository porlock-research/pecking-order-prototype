import { ChatCircle, Users } from '../icons';
import { motion } from 'framer-motion';
import { PULSE_TAP } from '../springs';

interface TabBarProps {
  activeTab: 'chat' | 'cast';
  onTabChange: (tab: 'chat' | 'cast') => void;
}

const tabs = [
  { id: 'chat' as const, label: 'Chat', Icon: ChatCircle },
  { id: 'cast' as const, label: 'Cast', Icon: Users },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        height: 64,
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
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--pulse-accent)' : 'var(--pulse-text-2)',
              transition: 'color 0.15s ease',
              position: 'relative',
            }}
          >
            {/* Active indicator pill under icon */}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  background: 'var(--pulse-accent-glow)',
                  zIndex: 0,
                }}
              />
            )}
            <Icon
              size={26}
              weight={isActive ? 'fill' : 'regular'}
              style={{ position: 'relative', zIndex: 1 }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'var(--po-font-body)',
                letterSpacing: 0.2,
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
