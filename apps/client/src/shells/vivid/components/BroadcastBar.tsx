import React, { useMemo } from 'react';
import Marquee from 'react-fast-marquee';
import { useGameStore, selectUnreadFeedCount } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { DayPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';

const PHASE_LABELS: Record<string, string> = {
  [DayPhases.PREGAME]: 'PRE-GAME',
  [DayPhases.MORNING]: 'MORNING',
  [DayPhases.SOCIAL]: 'SOCIAL HOUR',
  [DayPhases.GAME]: 'GAME TIME',
  [DayPhases.ACTIVITY]: 'ACTIVITY',
  [DayPhases.VOTING]: 'VOTING',
  [DayPhases.ELIMINATION]: 'ELIMINATION',
  [DayPhases.FINALE]: 'FINALE',
  [DayPhases.GAME_OVER]: 'FINALE',
};

function getPhaseLabel(phase: DayPhase, dayIndex: number): string {
  const label = PHASE_LABELS[phase];
  if (!label) return 'WAITING';
  if (phase === DayPhases.PREGAME || phase === DayPhases.FINALE || phase === DayPhases.GAME_OVER) return label;
  return `DAY ${dayIndex} — ${label}`;
}

function usePregameCountdown(): string | null {
  const manifest = useGameStore(s => s.manifest);
  const phase = useGameStore(s => s.phase);
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (phase !== DayPhases.PREGAME || !manifest?.startTime) {
      setLabel(null);
      return;
    }
    const update = () => {
      const diff = new Date(manifest.startTime).getTime() - Date.now();
      if (diff <= 0) { setLabel('Starting now...'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`Game starts in ${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [phase, manifest?.startTime]);

  return label;
}

export function BroadcastBar({ onClick }: { onClick?: () => void }) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const unreadCount = useGameStore(selectUnreadFeedCount);

  const phaseLabel = getPhaseLabel(phase, dayIndex);
  const groupCountdown = useCountdown('group');
  const dmCountdown = useCountdown('dm');
  const pregameCountdown = usePregameCountdown();

  // Build ticker items: phase label first, countdowns, then recent ticker messages
  const tickerItems = useMemo(() => {
    const items: string[] = [];
    if (pregameCountdown) {
      items.push(pregameCountdown);
    } else {
      items.push(phaseLabel);
    }
    if (groupCountdown) items.push(`Chat opens in ${groupCountdown}`);
    if (dmCountdown) items.push(`DMs open in ${dmCountdown}`);
    // Show the last 20 ticker messages in the scrolling ticker
    const recent = tickerMessages.slice(-20);
    for (const msg of recent) {
      items.push(msg.text);
    }
    return items;
  }, [phaseLabel, groupCountdown, dmCountdown, pregameCountdown, tickerMessages]);

  // Dynamic speed: longer content scrolls faster
  const marqueeSpeed = useMemo(() => {
    return Math.max(30, Math.min(60, tickerItems.length * 8));
  }, [tickerItems]);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 0',
        paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
        paddingLeft: 16,
        background: 'var(--vivid-bg-surface)',
        borderBottom: '2px solid rgba(139, 115, 85, 0.08)',
        flexShrink: 0,
        zIndex: 20,
        overflow: 'hidden',
        gap: 10,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {/* Left: LIVE dot */}
      <div className="vivid-live-dot" style={{ flexShrink: 0 }} />

      {/* Scrolling ticker — seamless loop via react-fast-marquee */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Marquee speed={marqueeSpeed} gradient gradientColor="var(--vivid-bg-surface)" gradientWidth={40}>
          {tickerItems.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.04em',
                color: 'var(--vivid-phase-accent)',
                textTransform: 'uppercase',
                paddingRight: 12,
              }}
            >
              {item}
              <span style={{ padding: '0 12px', opacity: 0.4 }}>&bull;</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* Right: unread badge + chevron hint */}
      <div
        style={{
          flexShrink: 0,
          paddingRight: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {unreadCount > 0 && (
          <div style={{
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: 'var(--vivid-coral)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
          }}>
            <span style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
        <div style={{ opacity: 0.4 }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M1 1L7 7L1 13" stroke="var(--vivid-phase-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
