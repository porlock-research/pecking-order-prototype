import React from 'react';
import { motion } from 'framer-motion';
import { ChatRoundDots, Letter, UsersGroupRounded } from '@solar-icons/react';
import { VIVID_TAP, VIVID_SPRING } from '../springs';

export type VividTab = 'stage' | 'whispers' | 'cast';

interface TabBarProps {
  activeTab: VividTab;
  onTabChange: (tab: VividTab) => void;
  unreadWhispers?: number;
}

const TABS: Array<{ id: VividTab; label: string; Icon: React.ComponentType<any> }> = [
  { id: 'stage', label: 'Stage', Icon: ChatRoundDots },
  { id: 'whispers', label: 'Whispers', Icon: Letter },
  { id: 'cast', label: 'Cast', Icon: UsersGroupRounded },
];

export function TabBar({ activeTab, onTabChange, unreadWhispers }: TabBarProps) {
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
          padding: '8px 0 env(safe-area-inset-bottom, 8px)',
          background: 'color-mix(in srgb, var(--vivid-bg-surface) 90%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
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
                gap: 2,
                padding: '6px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.snappy}
            >
              <div style={{ position: 'relative' }}>
                <Icon
                  size={22}
                  weight={isActive ? 'BoldDuotone' : 'Linear'}
                  color={isActive ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-dim)'}
                />
                {id === 'whispers' && unreadWhispers && unreadWhispers > 0 ? (
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
                    {unreadWhispers}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 10,
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
