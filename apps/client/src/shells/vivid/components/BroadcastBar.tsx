import React from 'react';
import { Dollar, CupStar } from '@solar-icons/react';
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
        background: 'color-mix(in srgb, var(--vivid-bg-surface) 80%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: LIVE dot + phase label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="vivid-live-dot" />
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.06em',
            color: 'var(--vivid-phase-accent)',
            textTransform: 'uppercase',
          }}
        >
          {phaseLabel}
        </span>
      </div>

      {/* Right: currency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Dollar size={14} weight="BoldDuotone" color="var(--vivid-gold)" />
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--vivid-gold)' }}>
            {mySilver}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CupStar size={14} weight="BoldDuotone" color="var(--vivid-lavender)" />
          <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--vivid-lavender)' }}>
            {goldPool}
          </span>
        </div>
      </div>
    </div>
  );
}
