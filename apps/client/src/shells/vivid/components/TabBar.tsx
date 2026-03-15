import React from 'react';
import { motion } from 'framer-motion';
import { ChatRoundDots, CalendarMinimalistic, UsersGroupRounded } from '@solar-icons/react';
import { VIVID_TAP, VIVID_SPRING } from '../springs';

export type VividTab = 'chat' | 'schedule' | 'people';

interface TabBarProps {
  activeTab: VividTab;
  onTabChange: (tab: VividTab) => void;
  unreadPeople?: number;
}

const TABS: Array<{ id: VividTab; label: string; Icon: React.ComponentType<any> }> = [
  { id: 'chat', label: 'Chat', Icon: ChatRoundDots },
  { id: 'schedule', label: 'Schedule', Icon: CalendarMinimalistic },
  { id: 'people', label: 'People', Icon: UsersGroupRounded },
];

export function TabBar({ activeTab, onTabChange, unreadPeople }: TabBarProps) {
  return (
    <div style={{ flexShrink: 0 }}>
      {/* Phase gradient line */}
      <div className="vivid-phase-line" />

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '6px 32px env(safe-area-inset-bottom, 8px)',
          background: 'var(--vivid-bg-surface)',
          borderTop: '1px solid rgba(139, 115, 85, 0.06)',
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '6px 32px',
                background: isActive ? 'rgba(139, 115, 85, 0.06)' : 'none',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.2s ease',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.snappy}
            >
              <div style={{ position: 'relative' }}>
                <Icon
                  size={24}
                  weight={isActive ? 'BoldDuotone' : 'Linear'}
                  color={isActive ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-dim)'}
                />
                {id === 'people' && unreadPeople && unreadPeople > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      background: 'var(--vivid-coral)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--vivid-font-mono)',
                      color: '#fff',
                      padding: '0 4px',
                    }}
                  >
                    {unreadPeople}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'var(--vivid-font-display)',
                  color: isActive ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-dim)',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
