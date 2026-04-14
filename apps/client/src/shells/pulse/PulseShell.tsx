import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import './pulse-theme.css';
import type { ShellProps } from '../types';
import type { GameEngine } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { AmbientBackground } from './components/AmbientBackground';
import { PulseBar } from './components/PulseBar';
import { ChatView } from './components/chat/ChatView';
import { CastStrip } from './components/caststrip/CastStrip';
import { PulseInput } from './components/input/PulseInput';
import { SendSilverSheet } from './components/popover/SendSilverSheet';
import { NudgeConfirmation } from './components/popover/NudgeConfirmation';
import { DmSheet } from './components/dm-sheet/DmSheet';
import { SocialPanel } from './components/social-panel/SocialPanel';
import { PulseHeader } from './components/header/PulseHeader';
import { PickingBanner } from './components/caststrip/PickingBanner';
import { StartPickedCta } from './components/caststrip/StartPickedCta';
import { EliminationReveal } from './components/reveals/EliminationReveal';
import { WinnerReveal } from './components/reveals/WinnerReveal';
import { PhaseTransition } from './components/reveals/PhaseTransition';
import { AnimatePresence } from 'framer-motion';

// Context to provide engine + playerId + overlay actions to all Pulse children.
// Phase 1.5 Option A: avatar tap → openDM directly (AvatarPopover retired).
// /silver and /nudge slash commands in PulseInput still drive the Silver/Nudge sheets.
export const PulseContext = createContext<{
  engine: GameEngine;
  playerId: string;
  openSendSilver: (targetId: string) => void;
  openNudge: (targetId: string) => void;
  openDM: (targetId: string, isGroup?: boolean) => void;
  openSocialPanel: () => void;
}>(null!);

export function usePulse() {
  return useContext(PulseContext);
}

export default function PulseShell({ playerId, engine, token: _token }: ShellProps) {
  const gameId = useGameStore(s => s.gameId);
  const hydrateLastRead = useGameStore(s => s.hydrateLastRead);
  const startPicking = useGameStore(s => s.startPicking);
  const pickingActive = useGameStore(s => s.pickingMode.active);

  // Hydrate Phase 1.5 lastReadTimestamp from localStorage, namespaced per (gameId, playerId)
  useEffect(() => {
    if (gameId && playerId) hydrateLastRead(gameId, playerId);
  }, [gameId, playerId, hydrateLastRead]);

  // Overlay state
  const [silverTarget, setSilverTarget] = useState<string | null>(null);
  const [nudgeTarget, setNudgeTarget] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const [dmIsGroup, setDmIsGroup] = useState(false);
  const [socialPanelOpen, setSocialPanelOpen] = useState(false);

  const openSendSilver = useCallback((targetId: string) => setSilverTarget(targetId), []);
  const openNudge = useCallback((targetId: string) => setNudgeTarget(targetId), []);
  const openDM = useCallback((targetId: string, isGroup = false) => {
    setDmTarget(targetId);
    setDmIsGroup(isGroup);
  }, []);
  const openSocialPanel = useCallback(() => setSocialPanelOpen(true), []);

  return (
    <PulseContext.Provider value={{ engine, playerId, openSendSilver, openNudge, openDM, openSocialPanel }}>
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
        <PulseHeader onCompose={startPicking} onOpenPanel={openSocialPanel} />
        {pickingActive && <PickingBanner />}
        <CastStrip />
        <PulseBar />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          <ChatView />
        </div>
        <PulseInput />

        {/* Overlays */}
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
        <AnimatePresence>
          {dmTarget && (
            <DmSheet
              key={`${dmTarget}-${dmIsGroup}`}
              targetId={dmTarget}
              isGroup={dmIsGroup}
              onClose={() => { setDmTarget(null); setDmIsGroup(false); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {socialPanelOpen && (
            <SocialPanel onClose={() => setSocialPanelOpen(false)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pickingActive && <StartPickedCta />}
        </AnimatePresence>

        <EliminationReveal />
        <WinnerReveal />
        <PhaseTransition />
      </div>
    </PulseContext.Provider>
  );
}
