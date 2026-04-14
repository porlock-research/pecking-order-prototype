import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import './pulse-theme.css';
import type { ShellProps } from '../types';
import type { GameEngine } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { AmbientBackground } from './components/AmbientBackground';
import { Ticker } from './components/Ticker';
import { PulseBar } from './components/PulseBar';
import { TabBar } from './components/TabBar';
import { ChatView } from './components/chat/ChatView';
import { CastGrid } from './components/cast/CastGrid';
import { CastStrip } from './components/caststrip/CastStrip';
import { PulseInput } from './components/input/PulseInput';
import { AvatarPopover } from './components/popover/AvatarPopover';
import { SendSilverSheet } from './components/popover/SendSilverSheet';
import { NudgeConfirmation } from './components/popover/NudgeConfirmation';
import { DMView } from './components/dm/DMView';
import { EliminationReveal } from './components/reveals/EliminationReveal';
import { WinnerReveal } from './components/reveals/WinnerReveal';
import { PhaseTransition } from './components/reveals/PhaseTransition';
import { AnimatePresence } from 'framer-motion';

// Context to provide engine + playerId + overlay actions to all Pulse children
export const PulseContext = createContext<{
  engine: GameEngine;
  playerId: string;
  openAvatarPopover: (targetId: string, anchorRect: DOMRect) => void;
  openSendSilver: (targetId: string) => void;
  openNudge: (targetId: string) => void;
  openDM: (targetId: string, isGroup?: boolean) => void;
  openSocialPanel: () => void;
}>(null!);

export function usePulse() {
  return useContext(PulseContext);
}

export default function PulseShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'cast'>('chat');
  const phase = useGameStore(s => s.phase);
  const channels = useGameStore(s => s.channels);
  const gameId = useGameStore(s => s.gameId);
  const hydrateLastRead = useGameStore(s => s.hydrateLastRead);

  // Hydrate Phase 1.5 lastReadTimestamp from localStorage, namespaced per (gameId, playerId)
  useEffect(() => {
    if (gameId && playerId) hydrateLastRead(gameId, playerId);
  }, [gameId, playerId, hydrateLastRead]);

  // Overlay state
  const [popover, setPopover] = useState<{ targetId: string; anchorRect: DOMRect } | null>(null);
  const [silverTarget, setSilverTarget] = useState<string | null>(null);
  const [nudgeTarget, setNudgeTarget] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const [dmIsGroup, setDmIsGroup] = useState(false);
  const [socialPanelOpen, setSocialPanelOpen] = useState(false);

  const openAvatarPopover = useCallback((targetId: string, anchorRect: DOMRect) => {
    setPopover({ targetId, anchorRect });
  }, []);
  const openSendSilver = useCallback((targetId: string) => setSilverTarget(targetId), []);
  const openNudge = useCallback((targetId: string) => setNudgeTarget(targetId), []);
  const openDM = useCallback((targetId: string, isGroup = false) => {
    setDmTarget(targetId);
    setDmIsGroup(isGroup);
  }, []);
  const openSocialPanel = useCallback(() => setSocialPanelOpen(true), []);

  // Resolve DM channel for the current dmTarget (may not exist yet — first DM creates it)
  const dmChannel = dmTarget
    ? Object.values(channels).find(ch =>
        ch.type === 'DM' &&
        ch.memberIds.includes(playerId) &&
        ch.memberIds.includes(dmTarget)
      )
    : null;

  return (
    <PulseContext.Provider value={{ engine, playerId, openAvatarPopover, openSendSilver, openNudge, openDM, openSocialPanel }}>
      <div
        className="pulse-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AmbientBackground />
        <Ticker />
        <CastStrip />
        <PulseBar />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          {activeTab === 'chat' ? <ChatView /> : <CastGrid />}
        </div>
        <PulseInput />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Overlays */}
        <AnimatePresence>
          {popover && (
            <AvatarPopover
              targetId={popover.targetId}
              anchorRect={popover.anchorRect}
              onClose={() => setPopover(null)}
              onSilver={id => { setPopover(null); openSendSilver(id); }}
              onDM={id => { setPopover(null); openDM(id); }}
              onNudge={id => { setPopover(null); openNudge(id); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {silverTarget && (
            <SendSilverSheet targetId={silverTarget} onClose={() => setSilverTarget(null)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {nudgeTarget && (
            <NudgeConfirmation
              targetId={nudgeTarget}
              onClose={() => setNudgeTarget(null)}
              onDM={id => { setNudgeTarget(null); openDM(id); }}
            />
          )}
        </AnimatePresence>
        {dmTarget && (
          <DMView
            channelId={dmChannel?.id ?? null}
            targetId={dmTarget}
            onBack={() => setDmTarget(null)}
          />
        )}

        <EliminationReveal />
        <WinnerReveal />
        <PhaseTransition />
      </div>
    </PulseContext.Provider>
  );
}
