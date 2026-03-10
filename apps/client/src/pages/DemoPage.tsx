import React, { useEffect, useState } from 'react';
import { ShellLoader } from '../shells/ShellLoader';
import { useGameStore } from '../store/useGameStore';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

/**
 * Demo page — auto-connects to a persistent demo game.
 * No auth, no persona picker. Assigns a persona via ?slot=p0 (default p0).
 */
export default function DemoPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pick slot from URL or default to p0
  const playerId = new URLSearchParams(window.location.search).get('slot') || 'p0';

  useEffect(() => {
    async function connect() {
      try {
        const demoGameId = new URLSearchParams(window.location.search).get('game') || 'DEMO';
        const host = new URL(GAME_SERVER_HOST).host;
        const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
        const res = await fetch(`${protocol}://${host}/parties/demo-server/${demoGameId}/join-demo`);

        if (!res.ok) {
          setError('Demo game not available.');
          return;
        }

        const data = await res.json();
        setGameId(data.gameId || demoGameId);
      } catch {
        setError('Could not reach the game server.');
      }
    }

    connect();
  }, []);

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error}</p>
      </div>
    );
  }

  if (!gameId) {
    return (
      <div style={styles.container}>
        <span style={styles.loadingText}>Loading demo...</span>
      </div>
    );
  }

  useGameStore.getState().setPlayerId(playerId);
  return <ShellLoader gameId={gameId} playerId={playerId} token={null} party="demo-server" />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#FDF8F0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
  },
  loadingText: {
    fontSize: 14,
    color: '#9B8E7E',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  error: {
    fontSize: 15,
    color: '#E8614D',
  },
};
