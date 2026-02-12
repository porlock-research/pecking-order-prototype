import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { ChatRoom } from './components/ChatRoom';
import { DirectMessages } from './components/DirectMessages';
import { NewsTicker } from './components/NewsTicker';
import VotingPanel from './cartridges/Voting';
import GamePanel from './cartridges/GamePanel';
import PromptPanel from './cartridges/PromptPanel';
import PerkPanel from './components/PerkPanel';
import { formatState, formatPhase } from './utils/formatState';
import { Coins, MessageCircle, Mail, Users } from 'lucide-react';

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { dayIndex, roster, serverState } = useGameStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('gameId');
    const pid = params.get('playerId') || 'p1';

    setGameId(gid);
    setPlayerId(pid);

    if (pid) {
      useGameStore.getState().setPlayerId(pid);
    }
  }, []);

  if (!gameId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-velvet text-skin-base p-8 text-center space-y-8 overflow-hidden">
        {/* Title */}
        <div className="space-y-4">
          <h1
            className="text-6xl sm:text-8xl font-black uppercase tracking-tighter font-display leading-none"
            style={{
              color: 'var(--po-gold)',
              textShadow: '0 0 30px rgba(251, 191, 36, 0.4), 0 0 60px rgba(251, 191, 36, 0.15)',
              animation: 'title-glow 4s ease-in-out infinite',
            }}
          >
            Pecking<br />Order
          </h1>
          <p className="text-lg sm:text-xl text-skin-dim/80 italic font-body tracking-wide">
            keep your friends close...
          </p>
        </div>

        {/* Decorative pulse ring */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border border-skin-gold/20 glow-breathe" />
          <div className="absolute inset-3 rounded-full border border-skin-gold/10" style={{ animation: 'pulse-live 3s ease-in-out infinite 0.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-3xl text-skin-gold/60">//</span>
          </div>
        </div>

        <p className="text-sm font-mono text-skin-dim/50 uppercase tracking-widest">
          awaiting signal
        </p>
      </div>
    );
  }

  if (!playerId) return (
    <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-3">
      <span className="w-6 h-6 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
      <span className="text-skin-gold font-mono animate-shimmer uppercase tracking-widest text-sm">
        ESTABLISHING_UPLINK...
      </span>
    </div>
  );

  return (
    <GameShell gameId={gameId} playerId={playerId} />
  );
}

function RosterRow({ player, playerId }: { player: any; playerId: string }) {
  const isMe = player.id === playerId;
  return (
    <li
      className={`flex items-center justify-between p-3 rounded-xl border transition-all
        ${isMe
          ? 'bg-skin-gold/10 border-skin-gold/30'
          : 'bg-glass border-white/[0.06] hover:border-white/20'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-gold avatar-ring">
          {player.personaName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm">
            {player.personaName}
            {isMe && <span className="ml-2 badge-skew text-[9px]">YOU</span>}
          </span>
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">{player.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 font-mono text-sm text-skin-gold font-bold">
        <Coins size={12} className="text-gray-300" />
        {player.silver}
      </div>
    </li>
  );
}

function GameShell({ gameId, playerId }: { gameId: string, playerId: string }) {
  const { dayIndex, roster, serverState } = useGameStore();
  const engine = useGameEngine(gameId, playerId);
  const [activeTab, setActiveTab] = useState<'chat' | 'dms' | 'roster'>('chat');
  const hasDms = useGameStore(s => s.chatLog.some(m => m.channel === 'DM'));

  const me = roster[playerId];
  const aliveCount = Object.values(roster).filter((p: any) => p.status === 'ALIVE').length;

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern selection:bg-skin-gold selection:text-skin-inverted">

      {/* Header */}
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between shadow-card z-50">
        {/* Left: Title + Phase */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black font-display tracking-tighter text-skin-gold italic text-glow leading-none">
            PECKING ORDER
          </h1>
          <span className="badge-skew text-[9px] py-0.5 px-2">
            {formatPhase(serverState)}
          </span>
        </div>

        {/* Right: Online pill + Silver */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-pill bg-skin-green/10 border border-skin-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-skin-green animate-pulse-live" />
            <span className="text-[9px] font-mono text-skin-green uppercase tracking-widest font-bold">Online</span>
          </div>
          {me && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-gold/10 border border-skin-gold/20">
              <Coins size={12} className="text-gray-300" />
              <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Region */}
      <main className="flex-1 overflow-hidden relative bg-skin-fill flex flex-col">

        {/* Two-panel desktop layout */}
        <div className="flex-1 overflow-hidden flex">

          {/* Desktop Sidebar: THE CAST */}
          <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-white/[0.06] bg-skin-panel/20">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-xs font-black text-skin-base uppercase tracking-widest font-display">The Cast</h2>
              <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2 py-0.5 text-skin-gold">
                {aliveCount}
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto p-3 space-y-2">
              {Object.values(roster).map((p: any) => (
                <RosterRow key={p.id} player={p} playerId={playerId} />
              ))}
            </ul>
          </aside>

          {/* Main content column */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* Desktop content switcher (replaces footer nav on lg+) */}
            <div className="hidden lg:flex border-b border-white/[0.06] bg-skin-panel/30">
              {([
                { key: 'chat' as const, label: 'Green Room' },
                { key: 'dms' as const, label: 'DMs' },
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

            {/* Voting, Game, Activity & Perk panels (inline with content) */}
            <VotingPanel engine={engine} />
            <GamePanel engine={engine} />
            <PromptPanel engine={engine} />
            <PerkPanel engine={engine} />

            {/* Content area */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'chat' && <ChatRoom engine={engine} />}
              {activeTab === 'dms' && <DirectMessages engine={engine} />}
              {activeTab === 'roster' && (
                <div className="absolute inset-0 overflow-y-auto p-4 scroll-smooth lg:hidden">
                  <div className="space-y-4 max-w-md mx-auto animate-fade-in">
                    <h2 className="text-xl font-black text-skin-base tracking-tighter border-b border-white/10 pb-2 mb-4 font-display">
                      THE CAST
                    </h2>
                    <ul className="space-y-2">
                      {Object.values(roster).map((p: any) => (
                        <RosterRow key={p.id} player={p} playerId={playerId} />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Footer Nav (mobile only) */}
      <footer className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-t border-white/[0.06] pb-safe lg:hidden">
        <nav className="flex items-stretch h-14">
          {([
            { key: 'chat' as const, label: 'Comms', Icon: MessageCircle, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
            { key: 'dms' as const, label: 'DMs', Icon: Mail, accent: 'text-skin-pink', bar: 'bg-skin-pink' },
            { key: 'roster' as const, label: 'Roster', Icon: Users, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
          ]).map(tab => {
            const isActive = activeTab === tab.key;
            const hasBadge = tab.key === 'dms' && !isActive && hasDms;
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

      {/* News Ticker */}
      <NewsTicker />

      {/* Admin God Button (Bottom Right Floating) */}
      <div className="fixed bottom-24 right-4 z-50">
        <button
          onClick={() => engine.socket.send(JSON.stringify({ type: "ADMIN.NEXT_STAGE" }))}
          className="h-12 w-12 rounded-full bg-skin-danger text-skin-inverted shadow-glow glow-breathe flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-2 border-white/20 font-mono font-bold text-lg"
          title="Force Next Stage"
        >
          {'>'}
        </button>
      </div>

    </div>
  );
}
