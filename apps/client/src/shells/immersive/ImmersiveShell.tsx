import React, { useState, useCallback } from 'react';
import { LayoutGroup } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SwipeableTabs } from './components/SwipeableTabs';
import { Timeline } from './components/Timeline';
import { PeopleList } from './components/PeopleList';
import { PlayerDrawer } from './components/PlayerDrawer';
import { ContextMenu } from './components/ContextMenu';
import { PerkFAB } from './components/PerkFAB';
import type { ShellProps } from '../types';

// Re-use classic pickers for now (opt-in reuse — exactly as the plan describes)
import { NewDmPicker } from '../classic/components/NewDmPicker';
import { NewGroupPicker } from '../classic/components/NewGroupPicker';
import { GroupThreadView } from '../classic/components/GroupThreadView';

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

  const handleSelectPlayer = useCallback((id: string) => {
    setDrawerPlayerId(id);
    setShowNewDm(false);
    setShowNewGroup(false);
  }, []);

  const handleSelectGroup = useCallback((channelId: string) => {
    setSelectedGroupId(channelId);
    setShowNewDm(false);
    setShowNewGroup(false);
    setActiveTab('people');
  }, []);

  const handleBackToList = useCallback(() => {
    setShowNewDm(false);
    setShowNewGroup(false);
    setSelectedGroupId(null);
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
    if (selectedGroupId) {
      return (
        <GroupThreadView
          channelId={selectedGroupId}
          onBack={handleBackToList}
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
      <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern selection:bg-skin-gold selection:text-skin-inverted">

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

        {/* Long-press context menu */}
        <ContextMenu
          targetPlayerId={contextTarget}
          position={contextPosition}
          onClose={handleCloseContext}
          onMessage={(id) => setDrawerPlayerId(id)}
          onSendSilver={(id) => setDrawerPlayerId(id)}
          onSpyDms={(id) => engine.sendPerk('SPY_DMS', id)}
        />

        {/* Perk FAB */}
        <PerkFAB engine={engine} />

      </div>
    </LayoutGroup>
  );
}

export default ImmersiveShell;
