import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore, selectRequireDmInvite } from '../../store/useGameStore';
import { buildPlayerColorMap } from './colors';
import { GAME_MASTER_ID, DayPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';
import { BroadcastBar } from './components/BroadcastBar';
import { StageChat } from './components/StageChat';
import { PeopleTab } from './components/PeopleTab';
import { ScheduleTab } from './components/ScheduleTab';
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

const TAB_ORDER: VividTab[] = ['chat', 'schedule', 'people'];

/* ------------------------------------------------------------------ */
/*  Phase class resolver                                               */
/* ------------------------------------------------------------------ */

const PHASE_CLASSES: Record<string, string> = {
  [DayPhases.PREGAME]: 'vivid-phase-pregame',
  [DayPhases.VOTING]: 'vivid-phase-voting',
  [DayPhases.ELIMINATION]: 'vivid-phase-voting',
  [DayPhases.GAME]: 'vivid-phase-game',
  [DayPhases.FINALE]: 'vivid-phase-elimination',
  [DayPhases.GAME_OVER]: 'vivid-phase-elimination',
};

function getPhaseClass(phase: DayPhase): string {
  return PHASE_CLASSES[phase] ?? 'vivid-phase-social';
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
  const phase = useGameStore(s => s.phase);
  const requireDmInvite = useGameStore(selectRequireDmInvite);
  const toggleDashboard = useGameStore(s => s.toggleDashboard);
  const dashboardOpen = useGameStore(s => s.dashboardOpen);
  const openDashboard = useGameStore(s => s.openDashboard);
  const requestedTab = useGameStore(s => s.requestedTab);
  const clearNavigation = useGameStore(s => s.clearNavigation);

  const phaseClass = getPhaseClass(phase);

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
  const tabVariants = useMemo(() => ({
    enter: (dir: number) => ({ opacity: 0, x: `${-dir * 8}%` }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: `${dir * 8}%` }),
  }), []);

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

  // Handle cross-component navigation requests (e.g. from DashboardOverlay)
  useEffect(() => {
    if (requestedTab && TAB_ORDER.includes(requestedTab as VividTab)) {
      handleTabChange(requestedTab as VividTab);
      clearNavigation();
    }
  }, [requestedTab, handleTabChange, clearNavigation]);

  /* ---- Swipe gesture for tab switching ---- */

  const mainContentRef = useRef<HTMLElement>(null);

  const bind = useDrag(
    ({ direction: [dx], velocity: [vx], distance: [distX], cancel, event }) => {
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

  /* ---- Swipe-down gesture for notifications panel ---- */

  const bindDashboardPull = useDrag(
    ({ direction: [, dy], velocity: [, vy], cancel }) => {
      if (vy < 0.4 || dashboardOpen) return;
      if (dy > 0) {
        openDashboard();
        cancel();
      }
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } }
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
      {/* Broadcast bar — top (swipe down to open notifications) */}
      <div {...bindDashboardPull()} style={{ touchAction: 'pan-x' }}>
        <BroadcastBar onClick={toggleDashboard} />
      </div>

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
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <StageChat
                engine={engine}
                playerColorMap={playerColorMap}
                onTapAvatar={(pid) => setDetailPlayerId(pid)}
              />
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              custom={tabDirection.current}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <ScheduleTab />
            </motion.div>
          )}

          {activeTab === 'people' && (
            <motion.div
              key="people"
              custom={tabDirection.current}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
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

      {/* Silver HUD popups (sent + received) */}
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

    </div>
  );
}

export default VividShell;
