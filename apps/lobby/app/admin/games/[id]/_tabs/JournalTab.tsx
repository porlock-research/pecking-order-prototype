'use client';

import { useState, useEffect, useCallback } from 'react';
import { queryJournal } from '../../../../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// All event types that can appear in the journal
const EVENT_TYPES = [
  'SILVER_TRANSFER',
  'VOTE_CAST',
  'ELIMINATION',
  'DM_SENT',
  'PERK_USED',
  'GAME_RESULT',
  'PLAYER_GAME_RESULT',
  'PROMPT_RESULT',
  'WINNER_DECLARED',
  'CHAT_MSG',
] as const;

// Silver-affecting event types for the ledger view
const SILVER_EVENT_TYPES = [
  'SILVER_TRANSFER',
  'GAME_RESULT',
  'PLAYER_GAME_RESULT',
  'PROMPT_RESULT',
  'DM_SENT',
  'PERK_USED',
] as const;

const PERK_COSTS: Record<string, number> = {
  SPY_DMS: 5,
  EXTRA_DM_PARTNER: 3,
  EXTRA_DM_CHARS: 2,
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  ELIMINATION: 'bg-red-100 text-red-800 border-red-200',
  VOTE_CAST: 'bg-purple-100 text-purple-800 border-purple-200',
  SILVER_TRANSFER: 'bg-amber-100 text-amber-800 border-amber-200',
  DM_SENT: 'bg-blue-100 text-blue-800 border-blue-200',
  GAME_RESULT: 'bg-green-100 text-green-800 border-green-200',
  PLAYER_GAME_RESULT: 'bg-green-100 text-green-800 border-green-200',
  WINNER_DECLARED: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  PERK_USED: 'bg-orange-100 text-orange-800 border-orange-200',
  PROMPT_RESULT: 'bg-pink-100 text-pink-800 border-pink-200',
  CHAT_MSG: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface JournalEntry {
  id: string;
  game_id: string;
  day_index: number;
  timestamp: number;
  event_type: string;
  actor_id: string;
  target_id: string | null;
  payload: string;
}

interface JournalTabProps {
  gameId: string;
  state: any;
}

export function JournalTab({ gameId, state }: JournalTabProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [playerFilter, setPlayerFilter] = useState('');
  const [view, setView] = useState<'timeline' | 'ledger'>('timeline');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 50;
  const totalDays = state.day || 0;

  const fetchJournal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        gameId,
        limit: 500,
        offset: 0,
      };
      if (dayFilter !== 'all') params.day = parseInt(dayFilter);
      if (typeFilter !== 'all') params.type = typeFilter;
      if (playerFilter) params.player = playerFilter;
      if (view === 'ledger') params.view = 'ledger';

      const result = await queryJournal(params);
      setEntries(result.entries || []);
      setPage(0);
    } catch (err: any) {
      setError(err.message || 'Failed to query journal');
    } finally {
      setLoading(false);
    }
  }, [gameId, dayFilter, typeFilter, playerFilter, view]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  const roster: Record<string, any> = state.roster || {};
  const playerName = (id: string | null | undefined) => {
    if (!id) return '-';
    const name = roster[id]?.personaName;
    return name ? `${name} (${id})` : id;
  };

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function parsePayload(raw: string): any {
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function payloadSummary(entry: JournalEntry): string {
    const p = parsePayload(entry.payload);
    switch (entry.event_type) {
      case 'SILVER_TRANSFER': return `${p.amount} silver`;
      case 'DM_SENT': return `${(p.content || '').slice(0, 40)}...`;
      case 'PERK_USED': return p.perkType || '';
      case 'GAME_RESULT': return p.gameType || '';
      case 'PLAYER_GAME_RESULT': return `+${p.silverReward} silver`;
      case 'PROMPT_RESULT': return `${Object.keys(p.silverRewards || {}).length} players rewarded`;
      case 'ELIMINATION': return p.mechanism || '';
      case 'VOTE_CAST': return `${p.mechanism || ''} → ${entry.target_id || ''}`;
      case 'WINNER_DECLARED': return `gold: ${p.goldPool || 0}`;
      case 'CHAT_MSG': return `${(p.content || '').slice(0, 40)}...`;
      default: return '';
    }
  }

  // Compute silver delta for ledger view
  function silverDelta(entry: JournalEntry, playerId: string): number | null {
    const p = parsePayload(entry.payload);
    switch (entry.event_type) {
      case 'SILVER_TRANSFER':
        if (entry.actor_id === playerId) return -(p.amount || 0);
        if (entry.target_id === playerId) return (p.amount || 0);
        return null;
      case 'DM_SENT':
        if (entry.actor_id === playerId) return -1;
        return null;
      case 'PERK_USED':
        if (entry.actor_id === playerId) return -(PERK_COSTS[p.perkType] || 0);
        return null;
      case 'GAME_RESULT': {
        const players = p.players || {};
        const playerData = players[playerId];
        if (playerData) return playerData.silverReward || 0;
        return null;
      }
      case 'PLAYER_GAME_RESULT':
        if (entry.actor_id === playerId) return p.silverReward || 0;
        return null;
      case 'PROMPT_RESULT': {
        const rewards = p.silverRewards || {};
        if (playerId in rewards) return rewards[playerId];
        return null;
      }
      default:
        return null;
    }
  }

  // Build ledger for a specific player
  function buildLedger(playerId: string) {
    const relevant = entries.filter(e => {
      return SILVER_EVENT_TYPES.includes(e.event_type as any) &&
        (e.actor_id === playerId || e.target_id === playerId ||
         (e.event_type === 'GAME_RESULT' && parsePayload(e.payload).players?.[playerId]) ||
         (e.event_type === 'PROMPT_RESULT' && parsePayload(e.payload).silverRewards?.[playerId]));
    });

    let balance = 0;
    return relevant.map(entry => {
      const delta = silverDelta(entry, playerId);
      if (delta !== null) balance += delta;
      return { entry, delta, balance };
    });
  }

  const paginatedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Day</label>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {Array.from({ length: totalDays + 1 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>Day {i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Player (actor/target)</label>
              <Input
                placeholder="e.g. p0, p1..."
                value={playerFilter}
                onChange={(e) => setPlayerFilter(e.target.value)}
                className="w-[150px]"
              />
            </div>

            <Button variant="outline" size="sm" onClick={fetchJournal} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>

            <Badge variant="secondary">{entries.length} entries</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {/* View toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'timeline' | 'ledger')}>
        <TabsList>
          <TabsTrigger value="timeline">Event Timeline</TabsTrigger>
          <TabsTrigger value="ledger">Silver Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Timestamp</TableHead>
                  <TableHead className="w-[60px]">Day</TableHead>
                  <TableHead className="w-[160px]">Event Type</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map(entry => (
                  <>
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() => toggleRow(entry.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{entry.day_index}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={EVENT_TYPE_COLORS[entry.event_type] || ''}>
                          {entry.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{playerName(entry.actor_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.target_id ? playerName(entry.target_id) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {payloadSummary(entry)}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(entry.id) && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <pre className="text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto p-2">
                            {JSON.stringify(parsePayload(entry.payload), null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {entries.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No journal entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <LedgerView
            entries={entries}
            roster={roster}
            playerFilter={playerFilter}
            buildLedger={buildLedger}
            playerName={playerName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LedgerView({
  entries,
  roster,
  playerFilter,
  buildLedger,
  playerName,
}: {
  entries: JournalEntry[];
  roster: Record<string, any>;
  playerFilter: string;
  buildLedger: (playerId: string) => Array<{ entry: JournalEntry; delta: number | null; balance: number }>;
  playerName: (id: string) => string;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>(playerFilter || '');

  const playerIds = Object.keys(roster);
  const targetPlayer = selectedPlayer || playerIds[0] || '';

  if (!targetPlayer) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players in roster. Select a player to view their silver ledger.
      </div>
    );
  }

  const ledger = buildLedger(targetPlayer);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={targetPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select player..." />
          </SelectTrigger>
          <SelectContent>
            {playerIds.map(id => (
              <SelectItem key={id} value={id}>
                {playerName(id)} ({id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">
          Balance: {ledger.length > 0 ? ledger[ledger.length - 1].balance : 0} silver
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Timestamp</TableHead>
              <TableHead className="w-[60px]">Day</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right w-[80px]">Delta</TableHead>
              <TableHead className="text-right w-[80px]">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map(({ entry, delta, balance }) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{entry.day_index}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={EVENT_TYPE_COLORS[entry.event_type] || ''}>
                    {entry.event_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.event_type === 'SILVER_TRANSFER' && entry.actor_id === targetPlayer
                    ? `→ ${playerName(entry.target_id || '')}`
                    : entry.event_type === 'SILVER_TRANSFER'
                    ? `← ${playerName(entry.actor_id)}`
                    : entry.event_type === 'DM_SENT'
                    ? `DM to ${playerName(entry.target_id || '')}`
                    : entry.event_type === 'PERK_USED'
                    ? parsePayload(entry.payload).perkType
                    : entry.event_type === 'GAME_RESULT'
                    ? parsePayload(entry.payload).gameType
                    : entry.event_type === 'PROMPT_RESULT'
                    ? 'Activity reward'
                    : ''}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {delta !== null && (
                    <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : ''}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">{balance}</TableCell>
              </TableRow>
            ))}
            {ledger.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No silver transactions found for {playerName(targetPlayer)}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function parsePayload(raw: string): any {
  try { return JSON.parse(raw); } catch { return {}; }
}
