'use client';

import { useState } from 'react';
import { resetAllDatabases } from '../actions';

export default function AdminPage() {
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleReset() {
    if (!confirm('This will DELETE all lobby data (users, sessions, games) and all game server data (journal, games, players, push subscriptions). Continue?')) {
      return;
    }
    setResetting(true);
    setResult(null);
    const res = await resetAllDatabases();
    if (res.success) {
      const lobby = res.details?.lobby?.join(', ') || 'none';
      const gs = res.details?.gameServer?.join(', ') || 'none';
      setResult({ ok: true, message: `Lobby: ${lobby} | Game Server: ${gs}` });
    } else {
      setResult({ ok: false, message: res.error || 'Unknown error' });
    }
    setResetting(false);
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <section className="border border-red-300 rounded-lg p-4 space-y-3 bg-red-50">
        <h2 className="text-lg font-semibold text-red-800">Reset Everything</h2>
        <p className="text-sm text-red-700">
          Wipes <strong>all</strong> data from both databases: lobby (Users, Sessions, MagicLinks, GameSessions, Invites)
          and game server (GameJournal, Games, Players, PushSubscriptions). PersonaPool seed data is preserved.
        </p>
        <p className="text-xs text-red-600">
          Game server reset requires <code className="bg-red-100 px-1 rounded">ALLOW_DB_RESET=true</code> in its env (local dev only).
        </p>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetting ? 'Resetting...' : 'Reset All Databases'}
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
