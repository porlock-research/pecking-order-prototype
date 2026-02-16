'use client';

import { useState } from 'react';
import { resetSelectedTables } from '../actions';

const LOBBY_TABLES = ['Invites', 'GameSessions', 'Sessions', 'MagicLinks', 'Users'] as const;
const GAME_SERVER_TABLES = ['GameJournal', 'Players', 'Games', 'PushSubscriptions'] as const;

const LOBBY_LABELS: Record<string, string> = {
  Invites: 'Invites (slot assignments)',
  GameSessions: 'GameSessions (lobby games)',
  Sessions: 'Sessions (login cookies)',
  MagicLinks: 'MagicLinks (email tokens)',
  Users: 'Users (accounts)',
};

const GS_LABELS: Record<string, string> = {
  GameJournal: 'GameJournal (event log)',
  Players: 'Players (per-game snapshots)',
  Games: 'Games (lifecycle records)',
  PushSubscriptions: 'PushSubscriptions (web push)',
};

export default function AdminPage() {
  const [lobbyChecked, setLobbyChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(LOBBY_TABLES.map(t => [t, true]))
  );
  const [gsChecked, setGsChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(GAME_SERVER_TABLES.map(t => [t, true]))
  );
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedLobby = LOBBY_TABLES.filter(t => lobbyChecked[t]);
  const selectedGs = GAME_SERVER_TABLES.filter(t => gsChecked[t]);
  const totalSelected = selectedLobby.length + selectedGs.length;

  function toggleAll(db: 'lobby' | 'gs', value: boolean) {
    if (db === 'lobby') {
      setLobbyChecked(Object.fromEntries(LOBBY_TABLES.map(t => [t, value])));
    } else {
      setGsChecked(Object.fromEntries(GAME_SERVER_TABLES.map(t => [t, value])));
    }
  }

  async function handleReset() {
    if (totalSelected === 0) return;
    const names = [...selectedLobby, ...selectedGs].join(', ');
    if (!confirm(`Delete all rows from: ${names}?`)) return;

    setResetting(true);
    setResult(null);
    const res = await resetSelectedTables({
      lobbyTables: [...selectedLobby],
      gameServerTables: [...selectedGs],
    });
    if (res.success) {
      const parts: string[] = [];
      if (res.details?.lobby?.length) parts.push(`Lobby: ${res.details.lobby.join(', ')}`);
      if (res.details?.gameServer?.length) parts.push(`Game Server: ${res.details.gameServer.join(', ')}`);
      setResult({ ok: true, message: parts.join(' | ') });
    } else {
      setResult({ ok: false, message: res.error || 'Unknown error' });
    }
    setResetting(false);
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <section className="border border-red-300 rounded-lg p-4 space-y-4 bg-red-50">
        <h2 className="text-lg font-semibold text-red-800">Database Reset</h2>
        <p className="text-xs text-red-600">
          Game server tables require <code className="bg-red-100 px-1 rounded">ALLOW_DB_RESET=true</code> in its env (local dev only).
        </p>

        {/* Lobby tables */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-red-800">Lobby DB</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll('lobby', true)} className="text-red-600 underline">all</button>
              <button onClick={() => toggleAll('lobby', false)} className="text-red-600 underline">none</button>
            </div>
          </div>
          {LOBBY_TABLES.map(t => (
            <label key={t} className="flex items-center gap-2 text-sm text-red-900 cursor-pointer">
              <input
                type="checkbox"
                checked={lobbyChecked[t]}
                onChange={e => setLobbyChecked(prev => ({ ...prev, [t]: e.target.checked }))}
                className="accent-red-600"
              />
              {LOBBY_LABELS[t] || t}
            </label>
          ))}
        </div>

        {/* Game server tables */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-red-800">Game Server DB</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll('gs', true)} className="text-red-600 underline">all</button>
              <button onClick={() => toggleAll('gs', false)} className="text-red-600 underline">none</button>
            </div>
          </div>
          {GAME_SERVER_TABLES.map(t => (
            <label key={t} className="flex items-center gap-2 text-sm text-red-900 cursor-pointer">
              <input
                type="checkbox"
                checked={gsChecked[t]}
                onChange={e => setGsChecked(prev => ({ ...prev, [t]: e.target.checked }))}
                className="accent-red-600"
              />
              {GS_LABELS[t] || t}
            </label>
          ))}
        </div>

        <button
          onClick={handleReset}
          disabled={resetting || totalSelected === 0}
          className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetting ? 'Resetting...' : `Reset ${totalSelected} table${totalSelected !== 1 ? 's' : ''}`}
        </button>

        {result && (
          <p className={`text-sm font-mono ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
            {result.ok ? 'OK' : 'FAILED'}: {result.message}
          </p>
        )}
      </section>
    </div>
  );
}
