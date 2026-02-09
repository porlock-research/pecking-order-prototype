'use client';

import { useState, useEffect } from 'react';
import { getGameState, sendAdminCommand } from '../../../actions';
import { useParams } from 'next/navigation';

export default function AdminGamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  if (!state) return <div className="p-8">Loading Game State...</div>;
  if (state.error) return <div className="p-8 text-red-500">Error: {state.error}</div>;

  const currentDay = state.manifest?.days?.find((d: any) => d.dayIndex === state.day);

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
            {state.day === 0 ? "🚀 Start Day 1" : "⏭️ Force Next Phase"}
          </button>
          
          {state.day === 0 && (
            <span className="text-gray-500 text-sm animate-pulse">
              Game is in Pre-Lobby (Day 0). Click to start the first day.
            </span>
          )}
        </div>
      </section>

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
