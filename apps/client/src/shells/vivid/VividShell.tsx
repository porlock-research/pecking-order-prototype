import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { GameHUD } from './components/GameHUD';
import { PersonaRail } from './components/PersonaRail';
import { StageChat } from './components/StageChat';
import { CartridgeOverlay } from './components/CartridgeOverlay';
import { Backstage } from './components/Backstage';
import { DMChat } from './components/DMChat';
import { Spotlight } from './components/Spotlight';
import { DramaticReveal } from './components/DramaticReveal';
import { PwaGate } from '../../components/PwaGate';
import { NewDmPicker } from '../classic/components/NewDmPicker';
import { NewGroupPicker } from '../classic/components/NewGroupPicker';
import { VIVID_SPRING } from './springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Space = 'stage' | 'backstage' | 'dm-chat' | 'spotlight' | 'new-dm' | 'new-group';

/* ------------------------------------------------------------------ */
/*  PhaseBackground                                                    */
/* ------------------------------------------------------------------ */

function PhaseBackground() {
  const serverState = useGameStore((s) => s.serverState);

  let phaseClass = 'vivid-phase-default';
  if (typeof serverState === 'string') {
    if (serverState.includes('voting') || serverState.includes('nightSummary')) {
      phaseClass = 'vivid-phase-voting';
    } else if (serverState.includes('game') || serverState.includes('Game')) {
      phaseClass = 'vivid-phase-game';
    } else if (
      serverState.includes('morning') ||
      serverState.includes('social') ||
      serverState.includes('dm') ||
      serverState.includes('chat')
    ) {
      phaseClass = 'vivid-phase-social';
    }
  }

  return (
    <div
      className={`fixed inset-0 -z-10 transition-colors duration-[2000ms] ${phaseClass}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  VividShell                                                         */
/* ------------------------------------------------------------------ */

function VividShell({ playerId, engine, token }: ShellProps) {
  const [space, setSpace] = useState<Space>('stage');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const { roster } = useGameStore();

  /* ---- Navigation handlers ---- */

  const handleSelectPlayer = useCallback((id: string) => {
    setSelectedPlayerId(id);
    setSelectedChannelId(null);
    setSpace('dm-chat');
  }, []);

  const handleSelectMainChat = useCallback(() => {
    setSpace('stage');
    setSelectedPlayerId(null);
    setSelectedChannelId(null);
  }, []);

  const handleSelectDm = useCallback((pid: string) => {
    setSelectedPlayerId(pid);
    setSelectedChannelId(null);
    setSpace('dm-chat');
  }, []);

  const handleSelectGroup = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setSelectedPlayerId(null);
    setSpace('dm-chat');
  }, []);

  const handleBackToStage = useCallback(() => {
    setSpace('stage');
    setSelectedPlayerId(null);
    setSelectedChannelId(null);
  }, []);

  const handleBackFromDm = useCallback(() => {
    setSpace('backstage');
  }, []);

  const handleOpenSpotlight = useCallback((pid: string) => {
    setSelectedPlayerId(pid);
    setSpace('spotlight');
  }, []);

  const handleBackFromSpotlight = useCallback(() => {
    if (selectedPlayerId) {
      setSpace('dm-chat');
    } else {
      setSpace('backstage');
    }
  }, [selectedPlayerId]);

  const handleMessageFromSpotlight = useCallback((pid: string) => {
    setSelectedPlayerId(pid);
    setSelectedChannelId(null);
    setSpace('dm-chat');
  }, []);

  const handleStartGroupFromSpotlight = useCallback((_playerId: string) => {
    setSpace('new-group');
  }, []);

  const handleLongPressPlayer = useCallback(
    (pid: string, _position: { x: number; y: number }) => {
      setSelectedPlayerId(pid);
      setSpace('spotlight');
    },
    [],
  );

  const handleLongPressBubble = useCallback(
    (_pid: string, _position: { x: number; y: number }) => {
      // Noop for now — Task 13 will add context menu
    },
    [],
  );

  /* ---- Render ---- */

  return (
    <div
      data-testid="game-shell"
      className="vivid-shell fixed inset-0 flex flex-col overflow-hidden"
    >
      {/* Phase-reactive background */}
      <PhaseBackground />

      {/* Game HUD — always visible */}
      <GameHUD />

      {/* Persona Rail — visible on Stage and Backstage */}
      {(space === 'stage' || space === 'backstage') && (
        <PersonaRail
          onSelectPlayer={handleSelectPlayer}
          onSelectMainChat={handleSelectMainChat}
          onLongPressPlayer={handleLongPressPlayer}
          activePlayerId={selectedPlayerId}
          showingMainChat={space === 'stage'}
        />
      )}

      {/* Space content — animated page transitions */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {space === 'stage' && (
            <motion.div
              key="stage"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIVID_SPRING.gentle}
            >
              <StageChat engine={engine} onLongPressBubble={handleLongPressBubble} />
            </motion.div>
          )}

          {space === 'backstage' && (
            <motion.div
              key="backstage"
              className="absolute inset-0 flex flex-col"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={VIVID_SPRING.page}
            >
              <Backstage
                onSelectDm={handleSelectDm}
                onSelectGroup={handleSelectGroup}
                onNewDm={() => setSpace('new-dm')}
                onNewGroup={() => setSpace('new-group')}
                onBack={handleBackToStage}
              />
            </motion.div>
          )}

          {space === 'dm-chat' && (selectedPlayerId || selectedChannelId) && (
            <motion.div
              key="dm-chat"
              className="absolute inset-0 flex flex-col"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={VIVID_SPRING.page}
            >
              <DMChat
                mode={selectedChannelId ? 'group' : '1on1'}
                targetPlayerId={selectedPlayerId || undefined}
                channelId={selectedChannelId || undefined}
                engine={engine}
                onBack={handleBackFromDm}
                onOpenSpotlight={handleOpenSpotlight}
              />
            </motion.div>
          )}

          {space === 'spotlight' && selectedPlayerId && (
            <motion.div
              key="spotlight"
              className="absolute inset-0 flex flex-col"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={VIVID_SPRING.dramatic}
            >
              <Spotlight
                targetPlayerId={selectedPlayerId}
                engine={engine}
                onBack={handleBackFromSpotlight}
                onMessage={handleMessageFromSpotlight}
                onStartGroup={handleStartGroupFromSpotlight}
              />
            </motion.div>
          )}

          {space === 'new-dm' && (
            <motion.div
              key="new-dm"
              className="absolute inset-0 flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={VIVID_SPRING.page}
            >
              <NewDmPicker
                roster={roster}
                playerId={playerId}
                onSelect={handleSelectDm}
                onBack={() => setSpace('backstage')}
              />
            </motion.div>
          )}

          {space === 'new-group' && (
            <motion.div
              key="new-group"
              className="absolute inset-0 flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={VIVID_SPRING.page}
            >
              <NewGroupPicker
                roster={roster}
                playerId={playerId}
                onBack={() => setSpace('backstage')}
                engine={engine}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cartridge overlay — only on Stage */}
      {space === 'stage' && (
        <CartridgeOverlay engine={engine} chatPeekContent={null} />
      )}

      {/* Dramatic reveal overlay */}
      <DramaticReveal />

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
