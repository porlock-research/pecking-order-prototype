'use client';

import { useState, useEffect } from 'react';
import { getAllGames, cleanupGame } from '../../actions';

export default function GameManagerPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const results = await getAllGames();
    setGames(results);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCleanup(gameId: string) {
    if (!confirm(`Clean up game ${gameId}? This will delete D1 rows and DO storage.`)) return;
    setCleaningUp(gameId);
    await cleanupGame(gameId);
    // Update local state to show ARCHIVED
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: 'ARCHIVED' } : g));
    setCleaningUp(null);
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Game Manager</h1>
        <div className="flex gap-3">
          <a href="/admin" className="text-blue-600 hover:underline text-sm">Back to Admin</a>
          <button onClick={refresh} className="text-blue-600 hover:underline text-sm">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm">
              <th className="p-3">Invite Code</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Status</th>
              <th className="p-3">Players</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map(game => (
              <tr key={game.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-sm">
                  <a href={`/admin/game/${game.id}`} className="text-blue-600 hover:underline">
                    {game.invite_code}
                  </a>
                </td>
                <td className="p-3 text-sm">{game.mode}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    game.status === 'STARTED' ? 'bg-green-100 text-green-700' :
                    game.status === 'RECRUITING' ? 'bg-blue-100 text-blue-700' :
                    game.status === 'READY' ? 'bg-yellow-100 text-yellow-700' :
                    game.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-500' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {game.status}
                  </span>
                </td>
                <td className="p-3 text-sm">{game.player_count}</td>
                <td className="p-3 text-sm text-gray-500">
                  {new Date(game.created_at).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {game.status !== 'ARCHIVED' ? (
                    <button
                      onClick={() => handleCleanup(game.id)}
                      disabled={cleaningUp === game.id}
                      className="bg-red-600 text-white px-3 py-1 text-xs rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {cleaningUp === game.id ? 'Cleaning...' : 'Cleanup'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Archived</span>
                  )}
                </td>
              </tr>
            ))}
            {games.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">No games found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
