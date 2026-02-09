import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { ChatRoom } from './components/ChatRoom';
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-skin-fill text-skin-base p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-skin-surface border border-skin-base flex items-center justify-center text-3xl animate-pulse">
          🔍
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-skin-primary to-skin-secondary">
          NO SIGNAL DETECTED
        </h1>
        <p className="text-skin-muted max-w-xs mx-auto">
          Please initiate the sequence from the Lobby Console.
        </p>
        <a 
          href="http://localhost:3000" 
          className="inline-flex items-center justify-center px-6 py-3 bg-skin-primary text-skin-inverted font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          Return to Lobby
        </a>
      </div>
    );
  }

  if (!playerId) return (
    <div className="min-h-screen bg-skin-fill flex items-center justify-center text-skin-primary font-mono animate-pulse">
      ESTABLISHING_UPLINK...
    </div>
  );

  return (
    <GameShell gameId={gameId} playerId={playerId} />
  );
}

function GameShell({ gameId, playerId }: { gameId: string, playerId: string }) {
  const { dayIndex, roster, serverState } = useGameStore();
  const engine = useGameEngine(gameId, playerId);
  const [activeTab, setActiveTab] = useState<'chat' | 'roster' | 'settings'>('chat');

  const me = roster[playerId];

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-sans overflow-hidden bg-grid-pattern selection:bg-skin-primary selection:text-skin-inverted">
      
      {/* Header */}
      <header className="shrink-0 bg-skin-surface/90 backdrop-blur-md border-b border-skin-base px-4 py-3 flex items-center justify-between shadow-lg z-50">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-skin-muted uppercase tracking-widest">Day {dayIndex}</span>
            <span className={`w-2 h-2 rounded-full ${serverState === 'active' ? 'bg-skin-secondary animate-pulse' : 'bg-skin-danger'}`}></span>
          </div>
          <span className="text-sm font-bold text-skin-primary tracking-tight font-mono">
            [{formatState(serverState).toUpperCase()}]
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {me && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-skin-base">{me.personaName}</span>
                <span className="text-[10px] font-mono text-skin-muted">ID: {playerId}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-skin-surface border border-skin-primary/50 overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center text-lg bg-skin-primary/10">
                   {me.avatarUrl || '👤'}
                </div>
              </div>
              <div className="flex items-center px-2 py-1 rounded bg-skin-surface border border-skin-base">
                <span className="mr-1">💰</span>
                <span className="font-mono font-bold text-skin-primary">{me.silver}</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Region */}
      <main className="flex-1 overflow-hidden relative bg-skin-fill">
        
        {activeTab === 'chat' && <ChatRoom engine={engine} />}
        
        {activeTab === 'roster' && (
          <div className="absolute inset-0 overflow-y-auto p-4 scroll-smooth">
            <div className="space-y-4 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-black text-skin-base tracking-tighter border-b border-skin-base pb-2 mb-4">
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
                          ? 'bg-skin-primary/10 border-skin-primary' 
                          : 'bg-skin-surface border-skin-base hover:border-skin-muted'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.avatarUrl || '👤'}</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">
                            {p.personaName} 
                            {isMe && <span className="ml-2 text-[10px] bg-skin-primary text-skin-inverted px-1.5 py-0.5 rounded-full font-mono uppercase">YOU</span>}
                          </span>
                          <span className="text-[10px] font-mono text-skin-muted uppercase tracking-wider">{p.status}</span>
                        </div>
                      </div>
                      <div className="font-mono text-sm text-skin-muted">
                        💰{p.silver}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col items-center justify-center text-skin-muted space-y-4">
            <div className="text-4xl">🚧</div>
            <p className="font-mono text-sm uppercase tracking-widest">System Modules Offline</p>
          </div>
        )}

      </main>

      {/* Footer Nav */}
      <footer className="shrink-0 bg-skin-surface border-t border-skin-base pb-safe">
        <nav className="flex items-stretch h-16">
          <button 
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
              ${activeTab === 'chat' ? 'text-skin-primary' : 'text-skin-muted hover:bg-skin-surface-hover'}
            `}
            onClick={() => setActiveTab('chat')}
          >
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Comms</span>
            {activeTab === 'chat' && <span className="absolute top-0 left-0 right-0 h-0.5 bg-skin-primary shadow-[0_0_10px_rgba(250,204,21,0.5)]" />}
          </button>
          
          <button 
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
              ${activeTab === 'roster' ? 'text-skin-primary' : 'text-skin-muted hover:bg-skin-surface-hover'}
            `}
            onClick={() => setActiveTab('roster')}
          >
            <span className="text-xl">👥</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Roster</span>
            {activeTab === 'roster' && <span className="absolute top-0 left-0 right-0 h-0.5 bg-skin-primary shadow-[0_0_10px_rgba(250,204,21,0.5)]" />}
          </button>
          
          <button 
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
              ${activeTab === 'settings' ? 'text-skin-primary' : 'text-skin-muted hover:bg-skin-surface-hover'}
            `}
            onClick={() => setActiveTab('settings')}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">System</span>
            {activeTab === 'settings' && <span className="absolute top-0 left-0 right-0 h-0.5 bg-skin-primary shadow-[0_0_10px_rgba(250,204,21,0.5)]" />}
          </button>
        </nav>
      </footer>

      {/* Admin God Button (Bottom Right Floating) */}
      <div className="fixed bottom-24 right-4 z-50">
        <button 
          onClick={() => engine.socket.send(JSON.stringify({ type: "ADMIN.NEXT_STAGE" }))}
          className="h-12 w-12 rounded-full bg-skin-danger text-skin-inverted shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-2 border-white/20"
          title="Force Next Stage"
        >
          ⚡️
        </button>
      </div>

    </div>
  );
}
