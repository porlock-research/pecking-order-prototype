import React, { useMemo } from 'react';
import Marquee from 'react-fast-marquee';
import { useGameStore } from '../../../store/useGameStore';

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
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const goldPool = useGameStore(s => s.goldPool);
  const tickerMessages = useGameStore(s => s.tickerMessages);

  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const phaseLabel = getPhaseLabel(serverState, dayIndex);

  // Build ticker items: phase label first, then recent ticker messages
  const tickerItems = useMemo(() => {
    const items: string[] = [phaseLabel];
    // Show the last 20 ticker messages in the scrolling ticker
    const recent = tickerMessages.slice(-20);
    for (const msg of recent) {
      items.push(msg.text);
    }
    return items;
  }, [phaseLabel, tickerMessages]);

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
        <Marquee speed={marqueeSpeed} gradient gradientColor="var(--vivid-bg-surface)" gradientWidth={24}>
          {tickerItems.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 13,
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

      {/* Right: currency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingRight: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(212, 150, 10, 0.1)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#D4960A',
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 600, color: '#D4960A' }}>
            {mySilver}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(139, 108, 193, 0.1)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#8B6CC1',
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 600, color: '#8B6CC1' }}>
            {goldPool}
          </span>
        </div>
      </div>
    </div>
  );
}
