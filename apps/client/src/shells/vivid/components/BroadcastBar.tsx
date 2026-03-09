import React from 'react';
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

export function BroadcastBar() {
  const dayIndex = useGameStore(s => s.dayIndex);
  const serverState = useGameStore(s => s.serverState);
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const goldPool = useGameStore(s => s.goldPool);

  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const phaseLabel = getPhaseLabel(serverState, dayIndex);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--vivid-bg-surface)',
        borderBottom: '2px solid rgba(139, 115, 85, 0.08)',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: LIVE dot + phase label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="vivid-live-dot" />
        <span
          className="vivid-phase-shimmer"
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.04em',
            color: 'var(--vivid-phase-accent)',
            textTransform: 'uppercase',
          }}
        >
          {phaseLabel}
        </span>
      </div>

      {/* Right: currency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(212, 150, 10, 0.1)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>🪙</span>
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 600, color: '#D4960A' }}>
            {mySilver}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(139, 108, 193, 0.1)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>🏆</span>
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 600, color: '#8B6CC1' }}>
            {goldPool}
          </span>
        </div>
      </div>
    </div>
  );
}
