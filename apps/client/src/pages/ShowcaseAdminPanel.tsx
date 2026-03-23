import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { DilemmaEvents } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

async function postAdmin(action: any) {
  const host = new URL(GAME_SERVER_HOST).host;
  const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
  await fetch(`${protocol}://${host}/parties/showcase-server/SHOWCASE/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
}

interface ShowcaseAdminPanelProps {
  playerId: string;
}

const DILEMMA_LABELS: Record<string, string> = {
  SILVER_GAMBIT: 'Silver Gambit',
  SPOTLIGHT: 'Spotlight',
  GIFT_OR_GRIEF: 'Gift or Grief',
};

export default function ShowcaseAdminPanel({ playerId }: ShowcaseAdminPanelProps) {
  const showcaseData = useGameStore((s) => s.showcaseData);
  const roster = useGameStore((s) => s.roster);
  const activeDilemma = useGameStore((s) => s.activeDilemma);
  const [collapsed, setCollapsed] = useState(false);
  const [simulateTargets, setSimulateTargets] = useState<Record<string, string>>({});

  const config = showcaseData?.config;
  const showcaseState = showcaseData?.state ?? 'idle';
  const hasFeatureDilemma = config?.features?.includes('dilemma');
  const dilemmaTypes: DilemmaType[] = config?.dilemma?.types ?? [];

  const myPersona = roster[playerId];
  const otherPlayers = Object.entries(roster).filter(([id]) => id !== playerId);

  const handleStartDilemma = useCallback(async (dilemmaType: DilemmaType) => {
    await postAdmin({ type: 'ADMIN.START_DILEMMA', dilemmaType });
  }, []);

  const handleForceEnd = useCallback(async () => {
    await postAdmin({ type: 'ADMIN.FORCE_END' });
  }, []);

  const handleReset = useCallback(async () => {
    await postAdmin({ type: 'ADMIN.RESET' });
  }, []);

  const handleSimulate = useCallback(async (simPlayerId: string, dilemmaType: DilemmaType, choice: string) => {
    const eventType = DilemmaEvents[dilemmaType]?.SUBMIT;
    if (!eventType) return;

    const payload: any = { type: eventType };

    if (dilemmaType === 'SILVER_GAMBIT') {
      payload.action = choice;  // Machine expects { action: 'DONATE' | 'KEEP' }
    } else {
      // SPOTLIGHT and GIFT_OR_GRIEF require a targetId
      payload.targetId = choice;
    }

    await postAdmin({
      type: 'ADMIN.SIMULATE',
      playerId: simPlayerId,
      event: payload,
    });
  }, []);

  // Determine which dilemma type is currently running
  const runningDilemmaType = activeDilemma?.dilemmaType as DilemmaType | undefined;

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
        <button style={panelStyles.collapseBtn} onClick={() => setCollapsed(true)}>
          _
        </button>
      </div>

      {/* Status */}
      <div style={panelStyles.section}>
        <div style={panelStyles.sectionLabel}>Status</div>
        <div style={panelStyles.statusRow}>
          <span style={panelStyles.statusDot(showcaseState)} />
          <span style={panelStyles.statusText}>{showcaseState.toUpperCase()}</span>
        </div>
        {myPersona && (
          <div style={panelStyles.personaInfo}>
            You are <strong>{myPersona.personaName}</strong> ({playerId})
          </div>
        )}
      </div>

      {/* Dilemma Controls */}
      {hasFeatureDilemma && (
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionLabel}>Dilemma Controls</div>

          {/* Start buttons */}
          <div style={panelStyles.buttonGroup}>
            {dilemmaTypes.map((dt) => (
              <button
                key={dt}
                style={{
                  ...panelStyles.actionBtn,
                  opacity: showcaseState !== 'idle' && showcaseState !== 'results' ? 0.4 : 1,
                  cursor: showcaseState !== 'idle' && showcaseState !== 'results' ? 'not-allowed' : 'pointer',
                }}
                disabled={showcaseState !== 'idle' && showcaseState !== 'results'}
                onClick={() => handleStartDilemma(dt)}
              >
                Start: {DILEMMA_LABELS[dt] || dt}
              </button>
            ))}
          </div>

          {/* Simulate section (when running) */}
          {showcaseState === 'running' && runningDilemmaType && (
            <div style={panelStyles.simulateSection}>
              <div style={panelStyles.sectionLabel}>Simulate Submissions</div>
              {otherPlayers.map(([pid, player]) => (
                <div key={pid} style={panelStyles.simulateRow}>
                  <span style={panelStyles.playerName}>{player.personaName} ({pid})</span>
                  {renderSimulateControls(
                    pid,
                    runningDilemmaType,
                    otherPlayers,
                    playerId,
                    roster,
                    simulateTargets,
                    setSimulateTargets,
                    handleSimulate,
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Force End (when running) */}
          {showcaseState === 'running' && (
            <button style={panelStyles.dangerBtn} onClick={handleForceEnd}>
              Force End
            </button>
          )}

          {/* Reset (when results) */}
          {showcaseState === 'results' && (
            <button style={panelStyles.actionBtn} onClick={handleReset}>
              Reset
            </button>
          )}
        </div>
      )}

      {/* Last Results */}
      {showcaseData?.lastResults && (
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionLabel}>Last Results</div>
          <pre style={panelStyles.resultsPre}>
            {JSON.stringify(showcaseData.lastResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function renderSimulateControls(
  pid: string,
  dilemmaType: DilemmaType,
  otherPlayers: [string, any][],
  selfPlayerId: string,
  roster: Record<string, any>,
  simulateTargets: Record<string, string>,
  setSimulateTargets: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  handleSimulate: (playerId: string, dilemmaType: DilemmaType, choice: string) => void,
) {
  if (dilemmaType === 'SILVER_GAMBIT') {
    return (
      <div style={panelStyles.controlRow}>
        <button
          style={panelStyles.smallBtn}
          onClick={() => handleSimulate(pid, dilemmaType, 'DONATE')}
        >
          DONATE
        </button>
        <button
          style={panelStyles.smallBtn}
          onClick={() => handleSimulate(pid, dilemmaType, 'KEEP')}
        >
          KEEP
        </button>
      </div>
    );
  }

  // SPOTLIGHT and GIFT_OR_GRIEF: target picker
  const allPlayers = Object.entries(roster);
  const targets = allPlayers.filter(([id]) => id !== pid);
  const targetKey = `${pid}-${dilemmaType}`;
  const selectedTarget = simulateTargets[targetKey] || targets[0]?.[0] || '';

  return (
    <div style={panelStyles.controlRow}>
      <select
        style={panelStyles.select}
        value={selectedTarget}
        onChange={(e) =>
          setSimulateTargets((prev) => ({ ...prev, [targetKey]: e.target.value }))
        }
      >
        {targets.map(([id, p]) => (
          <option key={id} value={id}>
            {p.personaName}
          </option>
        ))}
      </select>
      <button
        style={panelStyles.smallBtn}
        onClick={() => handleSimulate(pid, dilemmaType, selectedTarget)}
      >
        Submit
      </button>
    </div>
  );
}

// --- Styles ---

const panelStyles = {
  container: {
    position: 'fixed' as const,
    bottom: 16,
    right: 16,
    width: 320,
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
  } as React.CSSProperties,

  statusDot: (state: string): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor:
      state === 'running' ? '#4ADE80' :
      state === 'results' ? '#60A5FA' :
      '#9B8E7E',
    flexShrink: 0,
  }),

  statusText: {
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,

  personaInfo: {
    marginTop: 4,
    fontSize: 12,
    color: '#9B8E7E',
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
    transition: 'opacity 0.15s',
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
    marginTop: 8,
  } as React.CSSProperties,

  simulateSection: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  } as React.CSSProperties,

  simulateRow: {
    marginBottom: 8,
  } as React.CSSProperties,

  playerName: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#D4A574',
    marginBottom: 4,
  } as React.CSSProperties,

  controlRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  } as React.CSSProperties,

  smallBtn: {
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
    color: '#E8E0D4',
    border: '1px solid rgba(212, 165, 116, 0.4)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
  } as React.CSSProperties,

  select: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#E8E0D4',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 11,
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  resultsPre: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 8,
    fontSize: 10,
    color: '#9B8E7E',
    overflowX: 'auto' as const,
    maxHeight: 120,
    overflowY: 'auto' as const,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  } as React.CSSProperties,
} as const;
