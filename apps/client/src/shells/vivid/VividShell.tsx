import React, { useState, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { useDrag } from '@use-gesture/react';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore, selectRequireDmInvite } from '../../store/useGameStore';
import { buildPlayerColorMap } from './colors';
import { GAME_MASTER_ID, Events } from '@pecking-order/shared-types';
import { BroadcastBar } from './components/BroadcastBar';
import { StageChat } from './components/StageChat';
import { WhispersTab } from './components/WhispersTab';
import { TabBar, type VividTab } from './components/TabBar';
import { CastTab } from './components/CastTab';
import { NewConversationPicker } from './components/NewConversationPicker';
import { PwaGate } from '../../components/PwaGate';
import { PlayerQuickSheet } from './components/PlayerQuickSheet';
import { PlayerDetail } from './components/PlayerDetail';
import { PhaseTransitionSplash } from './components/PhaseTransitionSplash';
import { DramaticReveal } from './components/DramaticReveal';
import { VIVID_SPRING } from './springs';

/* ------------------------------------------------------------------ */
/*  Tab ordering for swipe gestures                                    */
/* ------------------------------------------------------------------ */

const TAB_ORDER: VividTab[] = ['stage', 'whispers', 'cast'];

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
/*  VividShell                                                         */
/* ------------------------------------------------------------------ */

function VividShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<VividTab>('stage');
  const [dmTargetPlayerId, setDmTargetPlayerId] = useState<string | null>(null);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [quickSheetPlayerId, setQuickSheetPlayerId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const roster = useGameStore(s => s.roster);
  const serverState = useGameStore(s => s.serverState);
  const requireDmInvite = useGameStore(selectRequireDmInvite);

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

  /* ---- Swipe gesture for tab switching ---- */

  const mainContentRef = useRef<HTMLElement>(null);

  const bind = useDrag(
    ({ direction: [dx], velocity: [vx], cancel, event }) => {
      // Only respond to horizontal swipes with sufficient velocity
      if (vx < 0.3) return;

      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (dx < 0 && currentIndex < TAB_ORDER.length - 1) {
        // Swipe left -> next tab
        setActiveTab(TAB_ORDER[currentIndex + 1]);
        cancel();
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right -> previous tab
        setActiveTab(TAB_ORDER[currentIndex - 1]);
        cancel();
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
    }
  );

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

      {/* Main content — tab panels with swipe */}
      <main
        ref={mainContentRef}
        {...bind()}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          touchAction: 'pan-y',
        }}
      >
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
                onNew={() => setShowNewConversation(true)}
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
              <CastTab
                playerColorMap={playerColorMap}
                onSelectPlayer={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); setActiveTab('whispers'); }}
                onViewProfile={(pid) => setDetailPlayerId(pid)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab bar — bottom */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Player quick sheet (avatar tap) */}
      <PlayerQuickSheet
        targetPlayerId={quickSheetPlayerId}
        onClose={() => setQuickSheetPlayerId(null)}
        onWhisper={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); setActiveTab('whispers'); }}
        onViewProfile={(pid) => { setDetailPlayerId(pid); setQuickSheetPlayerId(null); }}
        engine={engine}
        playerColorMap={playerColorMap}
      />

      {/* Player detail (full-screen profile) */}
      <AnimatePresence>
        {detailPlayerId && (
          <PlayerDetail
            targetPlayerId={detailPlayerId}
            playerColor={playerColorMap[detailPlayerId] || '#8B8DB3'}
            engine={engine}
            onBack={() => setDetailPlayerId(null)}
            onWhisper={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); setActiveTab('whispers'); setDetailPlayerId(null); }}
          />
        )}
      </AnimatePresence>

      {/* Broadcast chrome */}
      <PhaseTransitionSplash />
      <DramaticReveal />

      {/* New conversation picker overlay */}
      <AnimatePresence>
        {showNewConversation && (
          <NewConversationPicker
            roster={roster}
            playerId={playerId}
            requireDmInvite={requireDmInvite}
            onStart={(recipientIds) => {
              setShowNewConversation(false);
              // In unified model, first message IS the invite — just navigate to DM view
              // TODO(Task 9): sendFirstMessage on first message, not on picker selection
              if (recipientIds.length === 1) {
                setDmTargetPlayerId(recipientIds[0]);
                setDmChannelId(null);
                setActiveTab('whispers');
              } else {
                engine.createGroupDm([playerId, ...recipientIds]);
              }
            }}
            onBack={() => setShowNewConversation(false)}
          />
        )}
      </AnimatePresence>

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
