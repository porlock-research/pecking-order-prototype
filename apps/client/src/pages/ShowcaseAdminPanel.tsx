/**
 * Showcase Admin Panel — overlay for testing features on real games.
 *
 * Uses the real GameServer admin API (INJECT_TIMELINE_EVENT, NEXT_STAGE).
 * Renders when ?showcase=true is in the URL.
 */
import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

interface ShowcaseAdminPanelProps {
  gameId: string;
}

// Admin secret from URL param ?_secret= or default local dev secret
const ADMIN_SECRET = new URLSearchParams(window.location.search).get('_secret') || 'dev-secret-change-me';

async function postAdmin(gameId: string, body: any) {
  const host = new URL(GAME_SERVER_HOST).host;
  const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
  const res = await fetch(`${protocol}://${host}/parties/game-server/${gameId}/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_SECRET}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('[Admin] POST failed:', res.status, await res.text());
}

export default function ShowcaseAdminPanel({ gameId }: ShowcaseAdminPanelProps) {
  const activeDilemma = useGameStore((s) => s.activeDilemma);
  const roster = useGameStore((s) => s.roster);
  const playerId = useGameStore((s) => s.playerId);
  const [collapsed, setCollapsed] = useState(false);

  const myPersona = playerId ? roster[playerId] : null;
  const dilemmaRunning = !!activeDilemma;
  const dilemmaPhase = activeDilemma?.phase;

  // Timeline event injection
  const inject = useCallback((action: string, payload?: any) => {
    postAdmin(gameId, { type: 'INJECT_TIMELINE_EVENT', action, payload });
  }, [gameId]);

  const nextStage = useCallback(() => {
    postAdmin(gameId, { type: 'NEXT_STAGE' });
  }, [gameId]);

  if (collapsed) {
    return (
      <div style={panelStyles.collapsedTab} onClick={() => setCollapsed(false)}>
        Admin
      </div>
    );
  }

  return (
    <div style={panelStyles.container}>
      {/* Header */}
      <div style={panelStyles.header}>
        <span style={panelStyles.headerTitle}>Showcase Admin</span>
        <button style={panelStyles.collapseBtn} onClick={() => setCollapsed(true)}>_</button>
      </div>

      {/* Player Info */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Player</div>
        {myPersona && (
          <div style={panelStyles.personaInfo}>
            {myPersona.personaName} ({playerId})
          </div>
        )}
        <div style={panelStyles.personaInfo}>Game: {gameId}</div>
      </div>

      {/* Game Flow */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Game Flow</div>
        <div style={panelStyles.buttonGroup}>
          <button style={panelStyles.actionBtn} onClick={nextStage}>
            Next Stage
          </button>
          <button style={panelStyles.actionBtn} onClick={() => inject('OPEN_GROUP_CHAT')}>
            Open Group Chat
          </button>
          <button style={panelStyles.actionBtn} onClick={() => inject('OPEN_DMS')}>
            Open DMs
          </button>
        </div>
      </div>

      {/* Dilemma Controls */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Dilemmas</div>
        <div style={panelStyles.buttonGroup}>
          <button
            style={{ ...panelStyles.actionBtn, opacity: dilemmaRunning ? 0.4 : 1 }}
            disabled={dilemmaRunning}
            onClick={() => inject('START_DILEMMA')}
          >
            Start Dilemma (from manifest)
          </button>
          <button
            style={{ ...panelStyles.actionBtn, opacity: !dilemmaRunning ? 0.4 : 1 }}
            disabled={!dilemmaRunning}
            onClick={() => inject('END_DILEMMA')}
          >
            End Dilemma
          </button>
        </div>
        {dilemmaRunning && (
          <div style={panelStyles.statusRow}>
            <span style={panelStyles.statusDot('running')} />
            <span style={panelStyles.statusText}>
              {activeDilemma?.dilemmaType} — {dilemmaPhase}
            </span>
          </div>
        )}
      </div>

      {/* Voting Controls */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Voting</div>
        <div style={panelStyles.buttonGroup}>
          <button style={panelStyles.actionBtn} onClick={() => inject('OPEN_VOTING')}>
            Open Voting
          </button>
          <button style={panelStyles.actionBtn} onClick={() => inject('CLOSE_VOTING')}>
            Close Voting
          </button>
        </div>
      </div>

      {/* Day Controls */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Day</div>
        <div style={panelStyles.buttonGroup}>
          <button style={panelStyles.dangerBtn} onClick={() => inject('END_DAY')}>
            End Day
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const panelStyles = {
  container: {
    position: 'fixed' as const,
    bottom: 16,
    right: 16,
    width: 300,
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#E8E0D4',
    borderRadius: 12,
    padding: 16,
    zIndex: 9999,
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
    fontSize: 13,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
  } as React.CSSProperties,

  collapsedTab: {
    position: 'fixed' as const,
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#D4A574',
    borderRadius: 8,
    padding: '8px 16px',
    zIndex: 9999,
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottom: '1px solid rgba(212, 165, 116, 0.3)',
    paddingBottom: 8,
  } as React.CSSProperties,

  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#D4A574',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  collapseBtn: {
    background: 'none',
    border: 'none',
    color: '#9B8E7E',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
  } as React.CSSProperties,

  section: {
    marginBottom: 14,
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#9B8E7E',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 6,
  } as React.CSSProperties,

  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  } as React.CSSProperties,

  statusDot: (state: string): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: state === 'running' ? '#4ADE80' : '#9B8E7E',
    flexShrink: 0,
  }),

  statusText: {
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  personaInfo: {
    fontSize: 12,
    color: '#9B8E7E',
    marginBottom: 2,
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  } as React.CSSProperties,

  actionBtn: {
    backgroundColor: '#D4A574',
    color: '#1A1410',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
    textAlign: 'center' as const,
  } as React.CSSProperties,

  dangerBtn: {
    backgroundColor: '#E8614D',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
    width: '100%',
  } as React.CSSProperties,
} as const;
