import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { ChatRoom } from './components/ChatRoom';

export default function App() {
  // For debugging/stub purposes, we'll try to get these from URL params
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const { dayIndex, roster, serverState } = useGameStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('gameId') || 'stub-game-123';
    const pid = params.get('playerId') || 'p1';
    setGameId(gid);
    setPlayerId(pid);
    useGameStore.getState().setPlayerId(pid);
  }, []);

  if (!gameId || !playerId) return <div>Initializing...</div>;

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
    <div className="game-shell">
      {/* Header */}
      <header className="header">
        <div className="status-bar">
          <span className="day">Day {dayIndex}</span>
          <span className="state">[{serverState}]</span>
        </div>
        <div className="player-stats">
          {me && (
            <>
              <span className="balance">💰 {me.silver} Silver</span>
              <span className="persona">{me.avatarUrl} {me.personaName}</span>
            </>
          )}
        </div>
      </header>

      {/* Main Region */}
      <main className="main-region">
        {activeTab === 'chat' && <ChatRoom engine={engine} />}
        {activeTab === 'roster' && (
          <div className="roster-view">
            <h2>Roster</h2>
            <ul>
              {Object.values(roster).map(p => (
                <li key={p.id}>
                  {p.avatarUrl} {p.personaName} {p.id === playerId ? '(You)' : ''} - {p.status} - 💰{p.silver}
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeTab === 'settings' && <div>Settings coming soon...</div>}
      </main>

      {/* Footer */}
      <footer className="footer">
        <button 
          className={activeTab === 'chat' ? 'active' : ''} 
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button 
          className={activeTab === 'roster' ? 'active' : ''} 
          onClick={() => setActiveTab('roster')}
        >
          Roster
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''} 
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </footer>

      <style>{`
        .game-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 600px;
          margin: 0 auto;
          background: #1a1a1a;
          color: white;
          font-family: system-ui, sans-serif;
        }
        .header {
          padding: 1rem;
          background: #2a2a2a;
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #333;
        }
        .main-region {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }
        .footer {
          display: flex;
          background: #2a2a2a;
          border-top: 2px solid #333;
        }
        .footer button {
          flex: 1;
          padding: 1rem;
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
        }
        .footer button.active {
          color: #fff;
          background: #333;
        }
        .header .day { font-weight: bold; color: #ffd700; }
        .header .balance { color: #c0c0c0; margin-right: 1rem; }
      `}</style>
    </div>
  );
}
