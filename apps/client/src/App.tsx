import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { ChatRoom } from './components/ChatRoom';
import { DirectMessages } from './components/DirectMessages';
import VotingPanel from './cartridges/Voting';
import GamePanel from './cartridges/GamePanel';
import { formatState } from './utils/formatState';

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

function GameShell({ gameId, playerId }: { gameId: string, playerId: string }) {
  const { dayIndex, roster, serverState } = useGameStore();
  const engine = useGameEngine(gameId, playerId);
  const [activeTab, setActiveTab] = useState<'chat' | 'dms' | 'roster' | 'settings'>('chat');
  const hasDms = useGameStore(s => s.chatLog.some(m => m.channel === 'DM'));

  const me = roster[playerId];

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern selection:bg-skin-gold selection:text-skin-inverted">

      {/* Header */}
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center justify-between shadow-card z-50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-3 py-0.5 text-skin-gold uppercase tracking-widest">
              Day {dayIndex}
            </span>
            <span className={`w-2 h-2 rounded-full ${serverState === 'active' ? 'bg-skin-green pulse-live' : 'bg-skin-danger'}`} />
          </div>
          <span className="text-sm font-bold text-skin-gold tracking-tight font-mono text-glow">
            [{formatState(serverState).toUpperCase()}]
          </span>
        </div>

        <div className="flex items-center gap-3">
          {me && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-skin-base">{me.personaName}</span>
                <span className="text-[10px] font-mono text-skin-dim">ID: {playerId}</span>
              </div>
              <div className={`h-8 w-8 rounded-full bg-skin-panel border-2 border-skin-gold/40 overflow-hidden relative avatar-ring ${serverState === 'active' ? 'pulse-live' : ''}`}>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-skin-gold bg-skin-gold/10">
                   {me.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
              <div className="flex items-center px-2.5 py-1 rounded-pill bg-skin-gold/10 border border-skin-gold/20">
                <span className="text-[10px] font-mono text-skin-dim mr-1.5 uppercase">Ag</span>
                <span className="font-mono font-bold text-skin-gold">{me.silver}</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Region */}
      <main className="flex-1 overflow-hidden relative bg-skin-fill flex flex-col">

        <div className="shrink-0">
          <VotingPanel engine={engine} />
          <GamePanel engine={engine} />
        </div>

        <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && <ChatRoom engine={engine} />}

        {activeTab === 'dms' && <DirectMessages engine={engine} />}

        {activeTab === 'roster' && (
          <div className="absolute inset-0 overflow-y-auto p-4 scroll-smooth">
            <div className="space-y-4 max-w-md mx-auto animate-fade-in">
              <h2 className="text-xl font-black text-skin-base tracking-tighter border-b border-white/10 pb-2 mb-4 font-display">
                ACTIVE_PLAYERS
              </h2>
              <ul className="space-y-2">
                {Object.values(roster).map(p => {
                  const isMe = p.id === playerId;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all
                        ${isMe
                          ? 'bg-skin-gold/10 border-skin-gold/30'
                          : 'bg-glass border-white/[0.06] hover:border-white/20'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-gold avatar-ring">
                          {p.personaName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">
                            {p.personaName}
                            {isMe && <span className="ml-2 badge-skew text-[9px]">YOU</span>}
                          </span>
                          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">{p.status}</span>
                        </div>
                      </div>
                      <div className="font-mono text-sm text-skin-gold font-bold">
                        {p.silver} <span className="text-[10px] text-skin-dim font-normal">Ag</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col items-center justify-center text-skin-dim space-y-4">
            <span className="font-mono text-3xl text-skin-dim opacity-40">[--]</span>
            <p className="font-mono text-sm uppercase tracking-widest">System Modules Offline</p>
          </div>
        )}
        </div>

      </main>

      {/* Footer Nav */}
      <footer className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-t border-white/[0.06] pb-safe">
        <nav className="flex items-stretch h-16">
          {([
            { key: 'chat' as const, label: 'Comms', icon: '#', accent: 'text-skin-gold', bar: 'bg-skin-gold' },
            { key: 'dms' as const, label: 'DMs', icon: '@', accent: 'text-skin-pink', bar: 'bg-skin-pink' },
            { key: 'roster' as const, label: 'Roster', icon: '::', accent: 'text-skin-gold', bar: 'bg-skin-gold' },
            { key: 'settings' as const, label: 'System', icon: '*', accent: 'text-skin-gold', bar: 'bg-skin-gold' },
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
                  <span className={`font-mono ${isActive ? 'text-xl font-bold' : 'text-lg'}`}>{tab.icon}</span>
                  {hasBadge && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-skin-pink" />}
                </span>
                <span className={`text-[10px] uppercase tracking-widest ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
                {isActive && <span className={`absolute top-0 left-0 right-0 h-0.5 ${tab.bar} shadow-glow animate-fade-in`} />}
              </button>
            );
          })}
        </nav>
      </footer>

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
