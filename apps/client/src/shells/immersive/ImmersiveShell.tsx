import React, { useState, useCallback } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Toaster } from 'sonner';
import { useGameStore } from '../../store/useGameStore';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SwipeableTabs } from './components/SwipeableTabs';
import { Timeline } from './components/Timeline';
import { PeopleList } from './components/PeopleList';
import { PlayerDrawer } from './components/PlayerDrawer';
import { ContextMenu } from './components/ContextMenu';

import { DramaticReveal } from './components/DramaticReveal';
import type { ShellProps } from '../types';

// Re-use classic pickers for now (opt-in reuse — exactly as the plan describes)
import { NewDmPicker } from '../classic/components/NewDmPicker';
import { NewGroupPicker } from '../classic/components/NewGroupPicker';
import { GroupDrawer } from './components/GroupDrawer';

type TabKey = 'comms' | 'people';

function ImmersiveShell({ playerId, engine, token }: ShellProps) {
  const { roster } = useGameStore();
  const [activeTab, setActiveTab] = useState<TabKey>('comms');
  const [drawerPlayerId, setDrawerPlayerId] = useState<string | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Context menu state
  const [contextTarget, setContextTarget] = useState<string | null>(null);
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(null);

  // Toasts are reserved for targeted events only (DM rejections, perk results).
  // Broadcast events (silver transfers, phase changes, game rewards) are already
  // visible in the timeline as system events — no duplicate toasts needed.

  const handleSelectPlayer = useCallback((id: string) => {
    // Blur the triggering button so Radix Dialog can safely aria-hidden the main content
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDrawerPlayerId(id);
    setShowNewDm(false);
    setShowNewGroup(false);
  }, []);

  const handleSelectGroup = useCallback((channelId: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedGroupId(channelId);
    setShowNewDm(false);
    setShowNewGroup(false);
  }, []);

  const handleLongPressBubble = useCallback((targetId: string, position: { x: number; y: number }) => {
    setContextTarget(targetId);
    setContextPosition(position);
  }, []);

  const handleCloseContext = useCallback(() => {
    setContextTarget(null);
    setContextPosition(null);
  }, []);

  // People tab content
  const renderPeopleContent = () => {
    if (showNewDm) {
      return (
        <NewDmPicker
          roster={roster}
          playerId={playerId}
          onSelect={handleSelectPlayer}
          onBack={() => setShowNewDm(false)}
        />
      );
    }
    if (showNewGroup) {
      return (
        <NewGroupPicker
          roster={roster}
          playerId={playerId}
          onBack={() => setShowNewGroup(false)}
          engine={engine}
        />
      );
    }
    return (
      <PeopleList
        onSelectPlayer={handleSelectPlayer}
        onSelectGroup={handleSelectGroup}
        onNewDm={() => setShowNewDm(true)}
        onNewGroup={() => setShowNewGroup(true)}
      />
    );
  };

  return (
    <LayoutGroup>
      <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-radial-vignette selection:bg-skin-gold selection:text-skin-inverted">

        <Header token={token} />

        <main className="flex-1 overflow-hidden relative flex flex-col">
          <SwipeableTabs activeTab={activeTab} onTabChange={setActiveTab}>
            {{
              comms: <Timeline engine={engine} onLongPressBubble={handleLongPressBubble} />,
              people: renderPeopleContent(),
            }}
          </SwipeableTabs>
        </main>

        <Footer activeTab={activeTab} onTabChange={setActiveTab} playerId={playerId} />

        {/* Player detail drawer */}
        <PlayerDrawer
          targetPlayerId={drawerPlayerId}
          onClose={() => setDrawerPlayerId(null)}
          engine={engine}
        />

        {/* Group DM drawer */}
        <GroupDrawer
          channelId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          engine={engine}
        />

        {/* Long-press context menu */}
        <ContextMenu
          targetPlayerId={contextTarget}
          position={contextPosition}
          onClose={handleCloseContext}
          onMessage={(id) => { (document.activeElement as HTMLElement)?.blur(); setDrawerPlayerId(id); }}
          onSendSilver={(id) => { (document.activeElement as HTMLElement)?.blur(); setDrawerPlayerId(id); }}
        />

        {/* Dramatic reveal overlays */}
        <DramaticReveal />

        {/* Sonner toast container */}
        <Toaster
          position="top-center"
          visibleToasts={5}
          gap={6}
          closeButton
          toastOptions={{
            className: 'font-body',
            duration: Infinity,
            style: {
              background: 'var(--po-bg-panel)',
              color: 'var(--po-text)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'var(--po-font-body)',
            },
          }}
          richColors
        />

      </div>
    </LayoutGroup>
  );
}

export default ImmersiveShell;
