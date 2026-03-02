'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getInspectorConnection, getAllGames } from '../../actions';

interface InspectEvent {
  type: string;
  actorId: string;
  sourceId?: string;
  eventType?: string;
  snapshot?: {
    value?: unknown;
    status?: string;
    changed?: boolean;
    contextKeys?: string[];
  };
  timestamp: number;
}

const MAX_EVENTS = 200;

export default function InspectorPage() {
  const [games, setGames] = useState<Array<{ id: string; invite_code: string; status: string }>>([]);
  const [gameId, setGameId] = useState('');
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<InspectEvent[]>([]);
  const [actorStates, setActorStates] = useState<Map<string, unknown>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const inspectorRef = useRef<any>(null);
  const eventLogRef = useRef<HTMLDivElement | null>(null);

  // Load games on mount + auto-connect to first active game
  useEffect(() => {
    getAllGames().then((result: any) => {
      if (Array.isArray(result)) {
        setGames(result);
        const active = result.find((g: any) => g.status !== 'COMPLETED');
        if (active) {
          setGameId(active.id);
          // Defer connect to next tick so gameId state is set for UI
          setTimeout(() => connectTo(active.id), 0);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll event log
  useEffect(() => {
    if (autoScroll && eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const initStately = useCallback(async () => {
    // Dynamically import to avoid SSR issues
    try {
      const { createBrowserInspector } = await import('@statelyai/inspect');
      if (iframeRef.current) {
        inspectorRef.current = createBrowserInspector({
          iframe: iframeRef.current,
          autoStart: true,
        });
      }
    } catch (err) {
      console.warn('Stately Inspector not available:', err);
    }
  }, []);

  const connectTo = useCallback(async (targetGameId?: string) => {
    const id = targetGameId || gameId;
    if (!id) return;
    setError(null);
    setEvents([]);
    setActorStates(new Map());

    try {
      const { wsUrl } = await getInspectorConnection(id);

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnected(true);
        // Initialize Stately Inspector iframe before sending subscribe
        await initStately();
        // Subscribe to inspection events (server replays current state)
        ws.send(JSON.stringify({ type: 'INSPECT.SUBSCRIBE' }));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as InspectEvent;

          // Only process INSPECT.* events
          if (!data.type?.startsWith('INSPECT.')) return;

          setEvents(prev => {
            const updated = [...prev, data];
            return updated.length > MAX_EVENTS ? updated.slice(-MAX_EVENTS) : updated;
          });

          // Track current actor states
          if (data.type === 'INSPECT.SNAPSHOT' && data.actorId && data.snapshot) {
            setActorStates(prev => {
              const next = new Map(prev);
              next.set(data.actorId, data.snapshot!.value);
              return next;
            });
          }

          if (data.type === 'INSPECT.ACTOR' && data.actorId && data.snapshot) {
            setActorStates(prev => {
              const next = new Map(prev);
              next.set(data.actorId, data.snapshot!.value);
              return next;
            });
          }

          // Proxy to Stately Inspector iframe if available
          proxyToStately(data);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        setConnected(false);
      };
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
  }, [gameId, initStately]);

  function disconnect() {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'INSPECT.UNSUBSCRIBE' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    inspectorRef.current?.stop();
    inspectorRef.current = null;
  }

  function proxyToStately(event: InspectEvent) {
    const inspector = inspectorRef.current;
    if (!inspector) return;

    try {
      if (event.type === 'INSPECT.ACTOR') {
        inspector.actor(event.actorId, event.snapshot);
      } else if (event.type === 'INSPECT.EVENT') {
        inspector.event(event.actorId, { type: event.eventType || '?' }, {
          source: event.sourceId,
        });
      } else if (event.type === 'INSPECT.SNAPSHOT') {
        inspector.snapshot(event.actorId, event.snapshot);
      }
    } catch { /* Stately API may reject some events */ }
  }

  function flattenValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) return '';
      return entries
        .map(([k, v]) => {
          const child = flattenValue(v);
          return child ? `${k}.${child}` : k;
        })
        .join(' | ');
    }
    return String(value ?? '');
  }

  const filteredEvents = filter
    ? events.filter(e =>
        e.actorId?.includes(filter) ||
        e.eventType?.includes(filter) ||
        e.type.includes(filter)
      )
    : events;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 font-mono text-sm">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 bg-gray-900 border-b border-gray-800">
        <a href="/admin" className="text-gray-500 hover:text-gray-300">&larr; Admin</a>
        <h1 className="text-lg font-bold text-white">State Inspector</h1>

        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
        >
          <option value="">Select game...</option>
          {games.map(g => (
            <option key={g.id} value={g.id}>
              {g.invite_code} ({g.status})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Or paste game ID..."
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-72"
        />

        {connected ? (
          <button
            onClick={disconnect}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-1.5 rounded text-sm font-semibold"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connectTo()}
            disabled={!gameId}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-semibold"
          >
            Connect
          </button>
        )}

        <span className={`ml-2 w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-600'}`} />

        {error && <span className="text-red-400 text-xs">{error}</span>}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Actor states + Event log */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Actor states */}
          <div className="p-4 border-b border-gray-800 bg-gray-900">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Live Actor States</h2>
            {actorStates.size === 0 ? (
              <p className="text-gray-600 text-xs">No actors tracked yet. Connect to a game to start.</p>
            ) : (
              <div className="flex gap-4 flex-wrap">
                {Array.from(actorStates.entries()).map(([actorId, value]) => (
                  <div key={actorId} className="bg-gray-800 rounded px-3 py-2 border border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">{actorId}</div>
                    <div className="text-emerald-400 text-sm font-semibold">{flattenValue(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event log controls */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase">Event Timeline</h2>
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-48"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-emerald-500"
              />
              Auto-scroll
            </label>
            <span className="text-xs text-gray-600">{filteredEvents.length} events</span>
            <button
              onClick={() => setEvents([])}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              Clear
            </button>
          </div>

          {/* Event log */}
          <div ref={eventLogRef} className="flex-1 overflow-y-auto p-2">
            {filteredEvents.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                {connected ? 'Waiting for events...' : 'Connect to a game to see events'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-gray-600 sticky top-0 bg-gray-950">
                  <tr>
                    <th className="text-left py-1 px-2 w-20">Time</th>
                    <th className="text-left py-1 px-2 w-32">Type</th>
                    <th className="text-left py-1 px-2 w-40">Actor</th>
                    <th className="text-left py-1 px-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((evt, i) => (
                    <tr key={i} className="border-t border-gray-900 hover:bg-gray-900/50">
                      <td className="py-1 px-2 text-gray-600">
                        {new Date(evt.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </td>
                      <td className="py-1 px-2">
                        <span className={
                          evt.type === 'INSPECT.EVENT' ? 'text-blue-400' :
                          evt.type === 'INSPECT.SNAPSHOT' ? 'text-emerald-400' :
                          'text-amber-400'
                        }>
                          {evt.type.replace('INSPECT.', '')}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-gray-400">{evt.actorId}</td>
                      <td className="py-1 px-2 text-gray-300">
                        {evt.type === 'INSPECT.EVENT' && (
                          <span>
                            <span className="text-blue-300">{evt.eventType}</span>
                            {evt.sourceId && <span className="text-gray-600"> from {evt.sourceId}</span>}
                          </span>
                        )}
                        {evt.type === 'INSPECT.SNAPSHOT' && evt.snapshot && (
                          <span className="text-emerald-300">{flattenValue(evt.snapshot.value)}</span>
                        )}
                        {evt.type === 'INSPECT.ACTOR' && (
                          <span className="text-amber-300">created</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right panel: Stately Inspector iframe */}
        <div className="w-[600px] border-l border-gray-800 flex flex-col">
          <div className="p-2 border-b border-gray-800 bg-gray-900">
            <h2 className="text-xs font-semibold text-gray-500 uppercase">Stately Inspector</h2>
          </div>
          <iframe
            ref={iframeRef}
            className="flex-1 bg-white"
            title="Stately Inspector"
          />
        </div>
      </div>
    </div>
  );
}
