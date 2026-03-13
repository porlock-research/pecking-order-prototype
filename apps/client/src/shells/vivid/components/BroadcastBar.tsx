import React, { useMemo } from 'react';
import Marquee from 'react-fast-marquee';
import { useGameStore, selectUnreadFeedCount } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';

function getPhaseLabel(serverState: unknown, dayIndex: number): string {
  if (!serverState || typeof serverState !== 'string') return 'WAITING';
  const s = serverState.toLowerCase();
  const day = `DAY ${dayIndex}`;
  if (s.includes('pregame')) return 'PRE-GAME';
  if (s.includes('morningbriefing')) return `${day} — MORNING`;
  if (s.includes('socialperiod') || s.includes('dmperiod')) return `${day} — SOCIAL HOUR`;
  if (s.includes('game')) return `${day} — GAME TIME`;
  if (s.includes('prompt') || s.includes('activity')) return `${day} — ACTIVITY`;
  if (s.includes('voting')) return `${day} — VOTING`;
  if (s.includes('nightsummary')) return `${day} — ELIMINATION`;
  if (s.includes('gamesummary') || s.includes('gameover')) return 'FINALE';
  return `${day} — LIVE`;
}

export function BroadcastBar({ onClick }: { onClick?: () => void }) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const serverState = useGameStore(s => s.serverState);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const unreadCount = useGameStore(selectUnreadFeedCount);

  const phaseLabel = getPhaseLabel(serverState, dayIndex);
  const groupCountdown = useCountdown('group');
  const dmCountdown = useCountdown('dm');

  // Build ticker items: phase label first, countdowns, then recent ticker messages
  const tickerItems = useMemo(() => {
    const items: string[] = [phaseLabel];
    if (groupCountdown) items.push(`Chat opens in ${groupCountdown}`);
    if (dmCountdown) items.push(`DMs open in ${dmCountdown}`);
    // Show the last 20 ticker messages in the scrolling ticker
    const recent = tickerMessages.slice(-20);
    for (const msg of recent) {
      items.push(msg.text);
    }
    return items;
  }, [phaseLabel, groupCountdown, dmCountdown, tickerMessages]);

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
