'use client';

import { useState, useEffect } from 'react';
import { getAllGames, cleanupGame } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  STARTED: 'default',
  RECRUITING: 'secondary',
  READY: 'outline',
  ARCHIVED: 'secondary',
  COMPLETED: 'secondary',
};

const STATUS_CLASSES: Record<string, string> = {
  STARTED: 'bg-green-100 text-green-800 border-green-200',
  RECRUITING: 'bg-blue-100 text-blue-800 border-blue-200',
  READY: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
  COMPLETED: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function AdminPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [search, setSearch] = useState('');

  async function refresh() {
    setLoading(true);
    const results = await getAllGames();
    setGames(results);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleCleanup(gameId: string) {
    if (!confirm(`Clean up game ${gameId}? This will delete D1 rows and DO storage.`)) return;
    setCleaningUp(gameId);
    await cleanupGame(gameId);
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: 'ARCHIVED' } : g));
    setCleaningUp(null);
  }

  const filtered = games.filter(g => {
    if (statusFilter === 'active') return g.status !== 'ARCHIVED';
    if (statusFilter !== 'all') return g.status === statusFilter;
    return true;
  }).filter(g => {
    if (!search) return true;
    const s = search.toLowerCase();
    return g.invite_code?.toLowerCase().includes(s)
      || g.id?.toLowerCase().includes(s)
      || g.mode?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Games</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} game{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by invite code, ID, or mode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="STARTED">Started</SelectItem>
            <SelectItem value="RECRUITING">Recruiting</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invite Code</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Players</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(game => (
              <TableRow key={game.id}>
                <TableCell className="font-mono text-sm">
                  <a href={`/admin/games/${game.id}`} className="text-primary hover:underline font-medium">
                    {game.invite_code}
                  </a>
                </TableCell>
                <TableCell className="text-sm">{game.mode}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_CLASSES[game.status] || ''}>
                    {game.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-sm">{game.player_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(game.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {game.status !== 'ARCHIVED' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCleanup(game.id)}
                      disabled={cleaningUp === game.id}
                    >
                      {cleaningUp === game.id ? 'Cleaning...' : 'Cleanup'}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No games found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
