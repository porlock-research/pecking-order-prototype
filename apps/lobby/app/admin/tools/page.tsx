'use client';

import { useState } from 'react';
import { resetSelectedTables, broadcastPushUpdate } from '../../actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">Push notifications and database management</p>
      </div>

      <PushBroadcastSection />
      <DatabaseResetSection />
    </div>
  );
}

function PushBroadcastSection() {
  const [message, setMessage] = useState('A new update is available! Tap to refresh.');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleBroadcast() {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    const res = await broadcastPushUpdate(message.trim());
    if (res.ok && 'sent' in res) {
      setResult({ ok: true, message: `Sent: ${res.sent} | Expired: ${res.expired} | Errors: ${res.errors} | Total: ${res.total}` });
    } else {
      setResult({ ok: false, message: ('error' in res ? res.error : 'Unknown error') || 'Unknown error' });
    }
    setSending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Broadcast</CardTitle>
        <CardDescription>
          Send a push notification to all subscribed players. Useful after deploys to prompt PWA refresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Notification message..."
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleBroadcast} disabled={sending || !message.trim()}>
            {sending ? 'Sending...' : 'Broadcast to All'}
          </Button>
          {result && (
            <Badge variant={result.ok ? 'outline' : 'destructive'} className={result.ok ? 'bg-green-50 text-green-700' : ''}>
              {result.message}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DatabaseResetSection() {
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
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Database Reset</CardTitle>
        <CardDescription>
          Game server tables require <code className="bg-muted px-1 rounded text-xs">ALLOW_DB_RESET=true</code> in its env (local dev only).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lobby tables */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lobby DB</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll('lobby', true)} className="text-destructive hover:underline">all</button>
              <button onClick={() => toggleAll('lobby', false)} className="text-destructive hover:underline">none</button>
            </div>
          </div>
          {LOBBY_TABLES.map(t => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
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

        <Separator />

        {/* Game server tables */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Game Server DB</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll('gs', true)} className="text-destructive hover:underline">all</button>
              <button onClick={() => toggleAll('gs', false)} className="text-destructive hover:underline">none</button>
            </div>
          </div>
          {GAME_SERVER_TABLES.map(t => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
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

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={resetting || totalSelected === 0}
          >
            {resetting ? 'Resetting...' : `Reset ${totalSelected} table${totalSelected !== 1 ? 's' : ''}`}
          </Button>
          {result && (
            <span className={`text-sm font-mono ${result.ok ? 'text-green-700' : 'text-destructive'}`}>
              {result.ok ? 'OK' : 'FAILED'}: {result.message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
