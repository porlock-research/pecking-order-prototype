import React, { useEffect, useState } from 'react';
import { ShellLoader } from '../shells/ShellLoader';
import { useGameStore } from '../store/useGameStore';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

interface DemoPersona {
  id: string;
  personaName: string;
  avatarUrl: string;
  silver: number;
}

/**
 * Demo page — unauthed persona picker → connects to a demo game.
 * Bypasses the full auth flow. Players pick a persona and join directly.
 */
export default function DemoPage() {
  const [personas, setPersonas] = useState<DemoPersona[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check URL for pre-selected persona (e.g., /demo?slot=p0)
  const urlSlot = new URLSearchParams(window.location.search).get('slot');

  useEffect(() => {
    async function fetchPersonas() {
      try {
        // Extract demo game ID from URL or use default
        const demoGameId = new URLSearchParams(window.location.search).get('game') || 'DEMO';
        const host = new URL(GAME_SERVER_HOST).host;
        const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
        const res = await fetch(`${protocol}://${host}/parties/demo-server/${demoGameId}/join-demo`);

        if (!res.ok) {
          setError('Demo game not found. Has it been initialized?');
          setLoading(false);
          return;
        }

        const data = await res.json();
        setPersonas(data.personas || []);
        setGameId(data.gameId || demoGameId);

        // Auto-select if slot specified in URL
        if (urlSlot && data.personas?.some((p: DemoPersona) => p.id === urlSlot)) {
          setSelectedPlayerId(urlSlot);
        }
      } catch (err) {
        setError('Could not reach the game server.');
      } finally {
        setLoading(false);
      }
    }

    fetchPersonas();
  }, [urlSlot]);

  // Once a persona is selected, set store playerId and render the game shell
  if (selectedPlayerId && gameId) {
    useGameStore.getState().setPlayerId(selectedPlayerId);
    return <ShellLoader gameId={gameId} playerId={selectedPlayerId} token={null} party="demo-server" />;
  }

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner} />
        <span style={styles.loadingText}>Loading demo...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Demo</h1>
        <p style={styles.error}>{error}</p>
        <p style={styles.hint}>
          Initialize with: <code style={styles.code}>
            POST /parties/game-server/DEMO/init-demo
          </code>
        </p>
      </div>
    );
  }

  // Persona picker
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Pick Your Persona</h1>
      <p style={styles.subtitle}>Choose a character to join the demo</p>

      <div style={styles.grid}>
        {personas.map(persona => (
          <button
            key={persona.id}
            onClick={() => setSelectedPlayerId(persona.id)}
            style={styles.card}
          >
            <img
              src={persona.avatarUrl}
              alt={persona.personaName}
              style={styles.avatar}
            />
            <span style={styles.name}>{persona.personaName}</span>
          </button>
        ))}
      </div>
    </div>
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
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#3D2E1F',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  subtitle: {
    fontSize: 15,
    color: '#9B8E7E',
    marginBottom: 32,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
    maxWidth: 500,
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 20,
    background: '#FFFFFF',
    border: '2px solid rgba(139, 115, 85, 0.1)',
    boxShadow: '0 2px 8px rgba(139, 115, 85, 0.08)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#FAF3E8',
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    color: '#3D2E1F',
    textAlign: 'center' as const,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid #D4960A',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 12,
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
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: '#9B8E7E',
  },
  code: {
    background: '#F5EDE0',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
};
