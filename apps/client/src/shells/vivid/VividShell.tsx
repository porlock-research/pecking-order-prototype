import React, { useState, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { useDrag } from '@use-gesture/react';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore, selectRequireDmInvite } from '../../store/useGameStore';
import { buildPlayerColorMap } from './colors';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { BroadcastBar } from './components/BroadcastBar';
import { StageChat } from './components/StageChat';
import { PeopleTab } from './components/PeopleTab';
import { DMChat } from './components/DMChat';
import { TabBar, type VividTab } from './components/TabBar';
import { NewConversationPicker } from './components/NewConversationPicker';
import { PwaGate } from '../../components/PwaGate';
import { PlayerDetail } from './components/PlayerDetail';
import { PhaseTransitionSplash } from './components/PhaseTransitionSplash';
import { DramaticReveal } from './components/DramaticReveal';
import { DashboardOverlay } from './components/dashboard/DashboardOverlay';
import { SilverHUD } from './components/SilverHUD';
import { VIVID_SPRING } from './springs';

/* ------------------------------------------------------------------ */
/*  Tab ordering for swipe gestures                                    */
/* ------------------------------------------------------------------ */

const TAB_ORDER: VividTab[] = ['chat', 'people'];

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
  const [activeTab, setActiveTab] = useState<VividTab>('chat');
  const [dmTargetPlayerId, setDmTargetPlayerId] = useState<string | null>(null);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const roster = useGameStore(s => s.roster);
  const serverState = useGameStore(s => s.serverState);
  const requireDmInvite = useGameStore(selectRequireDmInvite);
  const toggleDashboard = useGameStore(s => s.toggleDashboard);

  const phaseClass = getPhaseClass(serverState);

  const playerColorMap = useMemo(() => {
    const playerIds = Object.keys(roster).filter(id => id !== GAME_MASTER_ID);
    return buildPlayerColorMap(playerIds);
  }, [roster]);

  /* ---- Navigation handlers ---- */

  const handleOpenDm = useCallback((targetId: string, channelId?: string) => {
    setDmTargetPlayerId(targetId);
    setDmChannelId(channelId ?? null);
    setActiveTab('people');
  }, []);

  const handleOpenGroupDm = useCallback((channelId: string) => {
    setDmChannelId(channelId);
    setDmTargetPlayerId(null);
    setActiveTab('people');
  }, []);

  const handleOpenPlayerDetail = useCallback((pid: string) => {
    setDetailPlayerId(pid);
  }, []);

  const handleClosePlayerDetail = useCallback(() => {
    setDetailPlayerId(null);
  }, []);

  // Track slide direction for tab transitions
  const tabDirection = useRef<1 | -1>(1);

  const handleTabChange = useCallback((tab: VividTab) => {
    const oldIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(tab);
    tabDirection.current = newIdx >= oldIdx ? 1 : -1;
    setActiveTab(tab);
    // Clear DM selection when switching away from People
    if (tab !== 'people') {
      setDmTargetPlayerId(null);
      setDmChannelId(null);
    }
  }, [activeTab]);

  /* ---- Swipe gesture for tab switching ---- */

  const mainContentRef = useRef<HTMLElement>(null);

  const bind = useDrag(
    ({ direction: [dx], velocity: [vx], cancel, event }) => {
      // Only respond to horizontal swipes with sufficient velocity
      if (vx < 0.3) return;

      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (dx < 0 && currentIndex < TAB_ORDER.length - 1) {
        // Swipe left -> next tab
        handleTabChange(TAB_ORDER[currentIndex + 1]);
        cancel();
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right -> previous tab
        handleTabChange(TAB_ORDER[currentIndex - 1]);
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
      <BroadcastBar onClick={toggleDashboard} />

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
          zIndex: 1,
        }}
      >
        <AnimatePresence mode="wait" custom={tabDirection.current}>
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              custom={tabDirection.current}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              initial={(dir: number) => ({ opacity: 0, x: `${-dir * 20}%` })}
              animate={{ opacity: 1, x: 0 }}
              exit={(dir: number) => ({ opacity: 0, x: `${dir * 20}%` })}
              transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
            >
              <StageChat
                engine={engine}
                playerColorMap={playerColorMap}
                onTapAvatar={(pid) => setDetailPlayerId(pid)}
              />
            </motion.div>
          )}

          {activeTab === 'people' && (
            <motion.div
              key="people"
              custom={tabDirection.current}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              initial={(dir: number) => ({ opacity: 0, x: `${-dir * 20}%` })}
              animate={{ opacity: 1, x: 0 }}
              exit={(dir: number) => ({ opacity: 0, x: `${dir * 20}%` })}
              transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
            >
              <PeopleTab
                engine={engine}
                playerColorMap={playerColorMap}
                activeDmPlayerId={dmTargetPlayerId}
                activeChannelId={dmChannelId}
                onSelectPlayer={(pid, chId) => { setDmTargetPlayerId(pid); setDmChannelId(chId ?? null); }}
                onSelectGroup={(chId) => { setDmChannelId(chId); setDmTargetPlayerId(null); }}
                onBack={() => { setDmTargetPlayerId(null); setDmChannelId(null); }}
                onTapAvatar={(pid) => setDetailPlayerId(pid)}
                onViewProfile={(pid) => setDetailPlayerId(pid)}
                onNewGroup={() => setShowNewConversation(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab bar — bottom */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Dashboard overlay */}
      <DashboardOverlay />

      {/* Silver received HUD popups */}
      <SilverHUD />

      {/* Player profile (full-screen modal — avatar tap anywhere) */}
      <AnimatePresence>
        {detailPlayerId && (
          <PlayerDetail
            targetPlayerId={detailPlayerId}
            playerColor={playerColorMap[detailPlayerId] || '#8B8DB3'}
            engine={engine}
            onBack={() => setDetailPlayerId(null)}
            onWhisper={(pid) => { setDmTargetPlayerId(pid); setDmChannelId(null); setActiveTab('people'); setDetailPlayerId(null); }}
          />
        )}
      </AnimatePresence>

      {/* DM chat — full-screen overlay like PlayerDetail */}
      <AnimatePresence>
        {(dmTargetPlayerId || dmChannelId) && (
          <DMChat
            key={dmTargetPlayerId || dmChannelId || 'dm'}
            mode={dmTargetPlayerId ? '1on1' : 'group'}
            targetPlayerId={dmTargetPlayerId ?? undefined}
            channelId={dmChannelId ?? undefined}
            engine={engine}
            onBack={() => { setDmTargetPlayerId(null); setDmChannelId(null); }}
            onOpenSpotlight={(pid) => setDetailPlayerId(pid)}
            playerColorMap={playerColorMap}
            onTapAvatar={(pid) => setDetailPlayerId(pid)}
          />
        )}
      </AnimatePresence>

      {/* Broadcast chrome */}
      <PhaseTransitionSplash />
      <DramaticReveal />

      {/* New conversation picker overlay (group DMs) */}
      <AnimatePresence>
        {showNewConversation && (
          <NewConversationPicker
            roster={roster}
            playerId={playerId}
            requireDmInvite={requireDmInvite}
            onStart={(recipientIds) => {
              setShowNewConversation(false);
              if (recipientIds.length === 1) {
                setDmTargetPlayerId(recipientIds[0]);
                setDmChannelId(null);
                setActiveTab('people');
              } else {
                engine.createGroupDm(recipientIds);
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
