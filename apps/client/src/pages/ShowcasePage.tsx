import React, { useEffect, useState } from 'react';
import { ShellLoader } from '../shells/ShellLoader';
import { useGameStore } from '../store/useGameStore';
import ShowcaseAdminPanel from './ShowcaseAdminPanel';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

/**
 * Showcase page — connects to the persistent ShowcaseServer.
 * No auth. Player auto-assigned by server via round-robin.
 */
export default function ShowcasePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function connect() {
      try {
        const host = new URL(GAME_SERVER_HOST).host;
        const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
        const res = await fetch(`${protocol}://${host}/parties/showcase-server/SHOWCASE/config`);
        if (!res.ok) {
          setError('Showcase not configured. Run /create-demo to set it up.');
          return;
        }
        setReady(true);
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

  if (!ready) {
    return (
      <div style={styles.container}>
        <span style={styles.loadingText}>Loading showcase...</span>
      </div>
    );
  }

  useGameStore.getState().setPlayerId('p0');
  return (
    <>
      <ShellLoader gameId="SHOWCASE" playerId="p0" token={null} party="showcase-server" />
      <ShowcaseAdminPanel playerId="p0" />
    </>
  );
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
