import React, { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { buildPlayerColorMap } from './colors';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { BroadcastBar } from './components/BroadcastBar';
import { StageChat } from './components/StageChat';
import { WhispersTab } from './components/WhispersTab';
import { TabBar, type VividTab } from './components/TabBar';
import { NewDmPicker } from '../classic/components/NewDmPicker';
import { NewGroupPicker } from '../classic/components/NewGroupPicker';
import { PwaGate } from '../../components/PwaGate';
import { VIVID_SPRING } from './springs';

/* ------------------------------------------------------------------ */
/*  Phase class resolver                                               */
/* ------------------------------------------------------------------ */

function getPhaseClass(serverState: unknown): string {
  if (!serverState || typeof serverState !== 'string') return 'vivid-phase-default';
  const s = serverState.toLowerCase();
  if (s.includes('pregame')) return 'vivid-phase-pregame';
  if (s.includes('voting') || s.includes('nightsummary')) return 'vivid-phase-voting';
  if (s.includes('game')) return 'vivid-phase-game';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'vivid-phase-elimination';
  return 'vivid-phase-social';
}

/* ------------------------------------------------------------------ */
/*  Placeholder tab content                                            */
/* ------------------------------------------------------------------ */

function CastPlaceholder() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vivid-text-dim)' }}>
      Cast — coming soon
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  VividShell                                                         */
/* ------------------------------------------------------------------ */

function VividShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<VividTab>('stage');
  const [dmTargetPlayerId, setDmTargetPlayerId] = useState<string | null>(null);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [quickSheetPlayerId, setQuickSheetPlayerId] = useState<string | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const roster = useGameStore(s => s.roster);
  const serverState = useGameStore(s => s.serverState);

  const phaseClass = getPhaseClass(serverState);

  const playerColorMap = useMemo(() => {
    const playerIds = Object.keys(roster).filter(id => id !== GAME_MASTER_ID);
    return buildPlayerColorMap(playerIds);
  }, [roster]);

  /* ---- Navigation handlers ---- */

  const handleOpenDm = useCallback((targetId: string) => {
    setDmTargetPlayerId(targetId);
    setDmChannelId(null);
    setActiveTab('whispers');
  }, []);

  const handleOpenGroupDm = useCallback((channelId: string) => {
    setDmChannelId(channelId);
    setDmTargetPlayerId(null);
    setActiveTab('whispers');
  }, []);

  const handleOpenPlayerDetail = useCallback((pid: string) => {
    setDetailPlayerId(pid);
  }, []);

  const handleClosePlayerDetail = useCallback(() => {
    setDetailPlayerId(null);
  }, []);

  const handleTabChange = useCallback((tab: VividTab) => {
    setActiveTab(tab);
  }, []);

  /* ---- Render ---- */

  return (
    <div
      data-testid="game-shell"
      className={`vivid-shell vivid-phase-bg ${phaseClass}`}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Broadcast bar — top */}
      <BroadcastBar />

      {/* Main content — tab panels */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'stage' && (
            <motion.div
              key="stage"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIVID_SPRING.gentle}
            >
              <StageChat
                engine={engine}
                playerColorMap={playerColorMap}
                onTapAvatar={(pid) => setQuickSheetPlayerId(pid)}
              />
            </motion.div>
          )}

          {activeTab === 'whispers' && (
            <motion.div
              key="whispers"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIVID_SPRING.gentle}
            >
              <WhispersTab
                engine={engine}
                playerColorMap={playerColorMap}
                activeDmPlayerId={dmTargetPlayerId}
                activeChannelId={dmChannelId}
                onSelectDm={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); }}
                onSelectGroup={(chId) => { setDmChannelId(chId); setDmTargetPlayerId(null); }}
                onNewDm={() => setShowNewDm(true)}
                onNewGroup={() => setShowNewGroup(true)}
                onBack={() => { setDmTargetPlayerId(null); setDmChannelId(null); }}
                onTapAvatar={(pid) => setQuickSheetPlayerId(pid)}
              />
            </motion.div>
          )}

          {activeTab === 'cast' && (
            <motion.div
              key="cast"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIVID_SPRING.gentle}
            >
              <CastPlaceholder />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab bar — bottom */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* New DM picker overlay */}
      {showNewDm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <NewDmPicker
            roster={roster}
            playerId={playerId}
            onSelect={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); setShowNewDm(false); setActiveTab('whispers'); }}
            onBack={() => setShowNewDm(false)}
          />
        </div>
      )}

      {/* New Group picker overlay */}
      {showNewGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <NewGroupPicker
            roster={roster}
            playerId={playerId}
            onBack={() => setShowNewGroup(false)}
            engine={engine}
          />
        </div>
      )}

      {/* PWA gate */}
      <PwaGate token={token} />

      {/* Toaster */}
      <Toaster
        position="top-center"
        visibleToasts={5}
        gap={6}
        closeButton
        toastOptions={{
          className: 'font-body',
          duration: Infinity,
          style: {
            background: 'var(--vivid-bg-surface)',
            color: 'var(--vivid-text)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'var(--vivid-font-body)',
          },
        }}
        richColors
      />
    </div>
  );
}

export default VividShell;
