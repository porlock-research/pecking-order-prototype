'use client';

import { useState, useEffect } from 'react';
import { getGameState, sendAdminCommand, flushScheduledTasks } from '../../../actions';
import { useParams } from 'next/navigation';

export default function AdminGamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gmMessage, setGmMessage] = useState('');
  const [gmTarget, setGmTarget] = useState('');
  const [gmSending, setGmSending] = useState(false);

  async function refresh() {
    setLoading(true);
    const data = await getGameState(gameId);
    setState(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [gameId]);

  async function handleCommand(cmd: any) {
    await sendAdminCommand(gameId, cmd);
    setTimeout(refresh, 500); // Wait for state transition
  }

  async function handleSendGmMessage(targetId?: string) {
    if (!gmMessage.trim()) return;
    setGmSending(true);
    await sendAdminCommand(gameId, {
      type: 'SEND_GAME_MASTER_MSG',
      content: gmMessage.trim(),
      ...(targetId ? { targetId } : {}),
    });
    setGmMessage('');
    setGmSending(false);
  }

  if (!state) return <div className="p-8">Loading Game State...</div>;
  if (state.error) return <div className="p-8 text-red-500">Error: {state.error}</div>;

  const currentDay = state.manifest?.days?.find((d: any) => d.dayIndex === state.day);
  const roster: Record<string, { personaName: string; status: string }> = state.roster || {};
  const rosterEntries = Object.entries(roster);

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen text-gray-900">
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded shadow">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Game Admin: {gameId}</h1>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Day {state.day}</span>
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">{typeof state.state === 'string' ? state.state : JSON.stringify(state.state)}</span>
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{state.manifest?.gameMode}</span>
          </div>
        </div>
        <button onClick={refresh} className="text-blue-600 hover:underline">Refresh</button>
      </header>

      {/* GLOBAL CONTROLS */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Global Controls</h2>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => handleCommand({ type: "NEXT_STAGE" })}
            className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 shadow-lg font-bold transition-transform transform active:scale-95"
          >
            {state.day === 0 ? "Start Day 1" : "Force Next Phase"}
          </button>

          <button
            onClick={async () => {
              if (confirm('Flush all scheduled alarms for this game?')) {
                await flushScheduledTasks(gameId);
                refresh();
              }
            }}
            className="bg-gray-600 text-white px-4 py-3 rounded hover:bg-gray-700 shadow font-semibold transition-transform transform active:scale-95"
          >
            Flush Alarms
          </button>

          {state.day === 0 && (
            <span className="text-gray-500 text-sm animate-pulse">
              Game is in Pre-Lobby (Day 0). Click to start the first day.
            </span>
          )}
        </div>
      </section>

      {/* GAME MASTER CHAT */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Game Master Chat</h2>
        <div className="bg-white rounded shadow p-4 space-y-4">
          <div>
            <textarea
              value={gmMessage}
              onChange={(e) => setGmMessage(e.target.value)}
              placeholder="Type a game master message..."
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 items-end">
            <button
              onClick={() => handleSendGmMessage()}
              disabled={!gmMessage.trim() || gmSending}
              className="bg-amber-500 text-white px-4 py-2 text-sm rounded hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
            >
              Send to Group
            </button>

            {rosterEntries.length > 0 && (
              <>
                <select
                  value={gmTarget}
                  onChange={(e) => setGmTarget(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select player...</option>
                  {rosterEntries.map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.personaName} ({id}) {p.status === 'ELIMINATED' ? '[X]' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => { if (gmTarget) handleSendGmMessage(gmTarget); }}
                  disabled={!gmMessage.trim() || !gmTarget || gmSending}
                  className="bg-purple-600 text-white px-4 py-2 text-sm rounded hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  Send DM
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ROSTER */}
      {rosterEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Roster</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm">
                  <th className="p-3">ID</th>
                  <th className="p-3">Persona</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rosterEntries.map(([id, p]) => (
                  <tr key={id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm text-gray-500">{id}</td>
                    <td className="p-3 font-medium">{p.personaName}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === 'ALIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TIMELINE INJECTOR */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">
          Timeline Injection
        </h2>

        {currentDay ? (
          <div className="bg-white rounded shadow overflow-hidden">
            <div className="p-3 bg-blue-50 border-b border-blue-100 text-blue-800 text-sm font-semibold">
              Active Day {currentDay.dayIndex}: {currentDay.theme}
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm">
                  <th className="p-3">Planned Time</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Payload</th>
                  <th className="p-3">Control</th>
                </tr>
              </thead>
              <tbody>
                {currentDay.timeline.map((event: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-500 font-mono text-sm">{event.time.split('T')[1]?.split('.')[0] || event.time}</td>
                    <td className="p-3 font-medium text-blue-700">{event.action}</td>
                    <td className="p-3 text-xs font-mono text-gray-500 truncate max-w-xs" title={JSON.stringify(event.payload)}>
                      {JSON.stringify(event.payload)}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleCommand({
                          type: "INJECT_TIMELINE_EVENT",
                          action: event.action,
                          payload: event.payload
                        })}
                        className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 transition-colors shadow-sm"
                      >
                        Fire Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 bg-gray-100 rounded-lg text-center border-2 border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">No timeline available for current state.</p>
            {state.day === 0 && <p className="text-gray-400 text-sm mt-1">Start Day 1 to load the manifest.</p>}
          </div>
        )}
      </section>

      {/* RAW STATE */}
      <section>
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Raw State</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
          {JSON.stringify(state, null, 2)}
        </pre>
      </section>
    </div>
  );
}
