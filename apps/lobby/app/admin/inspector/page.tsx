'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getInspectorConnection, getAllGames } from '../../actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  useEffect(() => {
    getAllGames().then((result: any) => {
      if (Array.isArray(result)) {
        setGames(result);
        const active = result.find((g: any) => g.status !== 'COMPLETED');
        if (active) {
          setGameId(active.id);
          setTimeout(() => connectTo(active.id), 0);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoScroll && eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const initStately = useCallback(async () => {
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
      if (wsRef.current) wsRef.current.close();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnected(true);
        await initStately();
        ws.send(JSON.stringify({ type: 'INSPECT.SUBSCRIBE' }));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as InspectEvent;
          if (!data.type?.startsWith('INSPECT.')) return;

          setEvents(prev => {
            const updated = [...prev, data];
            return updated.length > MAX_EVENTS ? updated.slice(-MAX_EVENTS) : updated;
          });

          if ((data.type === 'INSPECT.SNAPSHOT' || data.type === 'INSPECT.ACTOR') && data.actorId && data.snapshot) {
            setActorStates(prev => {
              const next = new Map(prev);
              next.set(data.actorId, data.snapshot!.value);
              return next;
            });
          }

          proxyToStately(data);
        } catch { /* ignore */ }
      };

      ws.onclose = () => setConnected(false);
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
      if (event.type === 'INSPECT.ACTOR') inspector.actor(event.actorId, event.snapshot);
      else if (event.type === 'INSPECT.EVENT') inspector.event(event.actorId, { type: event.eventType || '?' }, { source: event.sourceId });
      else if (event.type === 'INSPECT.SNAPSHOT') inspector.snapshot(event.actorId, event.snapshot);
    } catch { /* ignore */ }
  }

  function flattenValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) return '';
      return entries.map(([k, v]) => {
        const child = flattenValue(v);
        return child ? `${k}.${child}` : k;
      }).join(' | ');
    }
    return String(value ?? '');
  }

  const filteredEvents = filter
    ? events.filter(e => e.actorId?.includes(filter) || e.eventType?.includes(filter) || e.type.includes(filter))
    : events;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">State Inspector</h1>
      </div>

      {/* Connection controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={gameId} onValueChange={setGameId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select game..." />
          </SelectTrigger>
          <SelectContent>
            {games.map(g => (
              <SelectItem key={g.id} value={g.id}>
                {g.invite_code} ({g.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Or paste game ID..."
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="w-72"
        />

        {connected ? (
          <Button variant="destructive" size="sm" onClick={disconnect}>Disconnect</Button>
        ) : (
          <Button size="sm" onClick={() => connectTo()} disabled={!gameId}>Connect</Button>
        )}

        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 260px)' }}>
        {/* Left panel */}
        <div className="flex-1 flex flex-col min-w-0 rounded-md border overflow-hidden">
          {/* Actor states */}
          {actorStates.size > 0 && (
            <div className="p-3 bg-muted/50 border-b">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Live Actor States</h3>
              <div className="flex gap-3 flex-wrap">
                {Array.from(actorStates.entries()).map(([actorId, value]) => (
                  <div key={actorId} className="bg-background rounded px-3 py-2 border text-sm">
                    <div className="text-xs text-muted-foreground mb-0.5">{actorId}</div>
                    <div className="font-semibold text-green-600">{flattenValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event log controls */}
          <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Event Timeline</h3>
            <Input
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-48 h-7 text-xs"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
            <Badge variant="secondary" className="text-xs">{filteredEvents.length}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setEvents([])} className="h-6 text-xs">Clear</Button>
          </div>

          {/* Event log */}
          <div ref={eventLogRef} className="flex-1 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                {connected ? 'Waiting for events...' : 'Connect to a game to see events'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left py-1.5 px-2 w-20">Time</th>
                    <th className="text-left py-1.5 px-2 w-32">Type</th>
                    <th className="text-left py-1.5 px-2 w-40">Actor</th>
                    <th className="text-left py-1.5 px-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((evt, i) => (
                    <tr key={i} className="border-t hover:bg-muted/50">
                      <td className="py-1 px-2 text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </td>
                      <td className="py-1 px-2">
                        <span className={
                          evt.type === 'INSPECT.EVENT' ? 'text-blue-600' :
                          evt.type === 'INSPECT.SNAPSHOT' ? 'text-green-600' :
                          'text-amber-600'
                        }>
                          {evt.type.replace('INSPECT.', '')}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-muted-foreground">{evt.actorId}</td>
                      <td className="py-1 px-2">
                        {evt.type === 'INSPECT.EVENT' && (
                          <span>
                            <span className="text-blue-500">{evt.eventType}</span>
                            {evt.sourceId && <span className="text-muted-foreground"> from {evt.sourceId}</span>}
                          </span>
                        )}
                        {evt.type === 'INSPECT.SNAPSHOT' && evt.snapshot && (
                          <span className="text-green-600">{flattenValue(evt.snapshot.value)}</span>
                        )}
                        {evt.type === 'INSPECT.ACTOR' && (
                          <span className="text-amber-500">created</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right panel: Stately Inspector */}
        <div className="w-[500px] flex flex-col rounded-md border overflow-hidden">
          <div className="px-3 py-2 bg-muted border-b">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Stately Inspector</h3>
          </div>
          <iframe ref={iframeRef} className="flex-1 bg-white" title="Stately Inspector" />
        </div>
      </div>
    </div>
  );
}
