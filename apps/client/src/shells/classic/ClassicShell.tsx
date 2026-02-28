import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Timeline } from './components/Timeline';
import { PeopleList } from './components/PeopleList';
import { PlayerDetailView } from './components/PlayerDetailView';
import { GroupThreadView } from './components/GroupThreadView';
import { RosterRow } from './components/RosterRow';
import { NewDmPicker } from './components/NewDmPicker';
import { NewGroupPicker } from './components/NewGroupPicker';

import { PwaGate } from '../../components/PwaGate';
import { Coins, Trophy, MessageCircle, Users } from 'lucide-react';
import { PlayerStatuses, ChannelTypes } from '@pecking-order/shared-types';
import type { ShellProps } from '../types';

function ClassicShell({ playerId, engine, token }: ShellProps) {
  const { roster, goldPool } = useGameStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'people'>('chat');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const hasDms = useGameStore(s => {
    const channels = s.channels;
    return Object.values(channels).some(ch =>
      (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) &&
      ch.memberIds.includes(playerId) &&
      s.chatLog.some(m => m.channelId === ch.id)
    );
  });

  const me = roster[playerId];
  const aliveCount = Object.values(roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
  const onlineCount = useGameStore((s) => s.onlinePlayers.length);

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayerId(id);
    setSelectedGroupId(null);
    setShowNewDm(false);
    setShowNewGroup(false);
    setActiveTab('people');
  };

  const handleSelectGroup = (channelId: string) => {
    setSelectedGroupId(channelId);
    setSelectedPlayerId(null);
    setShowNewDm(false);
    setShowNewGroup(false);
    setActiveTab('people');
  };

  const handleBackToList = () => {
    setSelectedPlayerId(null);
    setSelectedGroupId(null);
    setShowNewDm(false);
    setShowNewGroup(false);
  };

  // Render People tab content based on navigation state
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
    if (selectedPlayerId) {
      return (
        <PlayerDetailView
          targetPlayerId={selectedPlayerId}
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
        engine={engine}
      />
    );
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern selection:bg-skin-gold selection:text-skin-inverted">

      {/* Header */}
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between shadow-card z-50">
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black font-display tracking-tighter text-skin-gold italic text-glow leading-none">
            PECKING ORDER
          </h1>
        </div>

        {/* Right: Push + Online pill + Silver */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-pill bg-skin-green/10 border border-skin-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-skin-green animate-pulse-live" />
            <span className="text-[9px] font-mono text-skin-green uppercase tracking-widest font-bold">{onlineCount} Online</span>
          </div>
          {me && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-gold/10 border border-skin-gold/20">
              <Coins size={12} className="text-skin-dim" />
              <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-amber-500/10 border border-amber-500/20">
            <Trophy size={12} className="text-amber-400" />
            <span className="font-mono font-bold text-amber-400 text-sm">{goldPool}</span>
          </div>
        </div>
      </header>

      {/* Main Region */}
      <main className="flex-1 overflow-hidden relative bg-skin-fill flex flex-col">

        {/* Two-panel desktop layout */}
        <div className="flex-1 overflow-hidden flex">

          {/* Desktop Sidebar: THE CAST (clickable) */}
          <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-white/[0.06] bg-skin-panel/20">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-xs font-black text-skin-base uppercase tracking-widest font-display">The Cast</h2>
              <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2 py-0.5 text-skin-gold">
                {aliveCount}
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto p-3 space-y-2">
              {Object.values(roster).map((p: any) => (
                <RosterRow key={p.id} player={p} playerId={playerId} onClick={() => handleSelectPlayer(p.id)} />
              ))}
            </ul>
          </aside>

          {/* Main content column */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* Desktop content switcher (replaces footer nav on lg+) */}
            <div className="hidden lg:flex border-b border-white/[0.06] bg-skin-panel/30">
              {([
                { key: 'chat' as const, label: 'Comms' },
                { key: 'people' as const, label: 'People' },
              ]).map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors relative
                      ${isActive
                        ? 'text-skin-gold'
                        : 'text-skin-dim opacity-50 hover:opacity-70'
                      }`}
                  >
                    {tab.label}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-skin-gold shadow-glow" />}
                  </button>
                );
              })}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {activeTab === 'chat' && <Timeline engine={engine} />}
              {activeTab === 'people' && renderPeopleContent()}
            </div>
          </div>
        </div>

      </main>

      {/* Footer Nav (mobile only) — 2 tabs */}
      <footer className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-t border-white/[0.06] pb-safe lg:hidden">
        <nav className="flex items-stretch h-14">
          {([
            { key: 'chat' as const, label: 'Comms', Icon: MessageCircle, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
            { key: 'people' as const, label: 'People', Icon: Users, accent: 'text-skin-pink', bar: 'bg-skin-pink' },
          ]).map(tab => {
            const isActive = activeTab === tab.key;
            const hasBadge = tab.key === 'people' && !isActive && hasDms;
            return (
              <button
                key={tab.key}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
                  ${isActive ? tab.accent : 'text-skin-dim opacity-50 hover:opacity-70'}
                `}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="relative">
                  <tab.Icon size={isActive ? 20 : 18} />
                  {hasBadge && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-skin-pink" />}
                </span>
                <span className={`text-[10px] uppercase tracking-widest ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
                {isActive && <span className={`absolute top-0 left-0 right-0 h-0.5 ${tab.bar} shadow-glow animate-fade-in`} />}
              </button>
            );
          })}
        </nav>
      </footer>

      {/* PWA install + push subscribe gate */}
      <PwaGate token={token} />
    </div>
  );
}

export default ClassicShell;
