'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useState } from 'react';
import { adminInitGame } from '../../../../actions';

interface OverviewTabProps {
  state: any;
  gameId: string;
  inviteCode: string | null;
  clientHost: string | null;
  onCommand: (cmd: any) => Promise<void>;
  onFlushAlarms: () => Promise<void>;
}

export function OverviewTab({ state, gameId, inviteCode, clientHost, onCommand, onFlushAlarms }: OverviewTabProps) {
  const [playerFilter, setPlayerFilter] = useState('');
  const [silverPlayerId, setSilverPlayerId] = useState<string | null>(null);
  const [silverAmount, setSilverAmount] = useState(10);
  const roster: Record<string, any> = state.roster || {};
  const rosterEntries = Object.entries(roster).filter(([id, p]) => {
    if (!playerFilter) return true;
    const s = playerFilter.toLowerCase();
    return id.toLowerCase().includes(s) || p.personaName?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 items-center">
          <Button
            variant="destructive"
            onClick={async () => {
              // If the DO is uninitialized, NEXT_STAGE silently no-ops.
              // Offer to manually POST /init with the DYNAMIC/ADMIN default
              // payload (same shape createGame uses for no-config CC games)
              // so the operator isn't stranded in a wedged state.
              if (state.state === 'uninitialized') {
                if (!confirm('Game DO is uninitialized — POST /init with the default DYNAMIC/ADMIN manifest first?')) {
                  return;
                }
                const result = await adminInitGame(gameId);
                if (!result.success) {
                  alert(`Init failed: ${result.error}`);
                  return;
                }
              }
              onCommand({ type: 'NEXT_STAGE' });
            }}
          >
            {state.day === 0 ? 'Start Day 1' : 'Force Next Phase'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('Flush all scheduled alarms for this game?')) onFlushAlarms();
            }}
          >
            Flush Alarms
          </Button>
          <Button
            variant="outline"
            onClick={() => onCommand({
              type: 'INJECT_TIMELINE_EVENT',
              action: 'START_CONFESSION_CHAT',
              payload: {},
            })}
            title="Triggers START_CONFESSION_CHAT. L2 gates on ruleset.confessions.enabled — no-ops if confessions are disabled for this game."
          >
            Start Confession
          </Button>
          {inviteCode && clientHost && (
            <a
              href={`${clientHost}/game/${inviteCode}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">Open Game</Button>
            </a>
          )}
          {state.day === 0 && (
            <span className="text-sm text-muted-foreground animate-pulse">
              Game is in Pre-Lobby (Day 0)
            </span>
          )}
        </CardContent>
      </Card>

      {/* Roster */}
      {Object.keys(roster).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Roster ({Object.keys(roster).length} players)</CardTitle>
            <Input
              placeholder="Filter players..."
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="max-w-[200px]"
            />
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Silver</TableHead>
                    <TableHead className="text-right">Gold</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterEntries.map(([id, p]) => (
                    <TableRow key={id}>
                      <TableCell className="font-mono text-xs">{id}</TableCell>
                      <TableCell className="font-medium">{p.personaName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={p.status === 'ALIVE'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.silver ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.gold ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          {p.status === 'ALIVE' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                if (confirm(`Eliminate ${p.personaName}?`)) {
                                  onCommand({ type: 'ELIMINATE_PLAYER', playerId: id });
                                }
                              }}
                            >
                              Eliminate
                            </Button>
                          )}
                          {silverPlayerId === id ? (
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                value={silverAmount}
                                onChange={(e) => setSilverAmount(Number(e.target.value))}
                                className="w-16 h-7 text-xs"
                                min={1}
                              />
                              <Button
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => {
                                  onCommand({ type: 'CREDIT_SILVER', rewards: { [id]: silverAmount } });
                                  setSilverPlayerId(null);
                                }}
                              >
                                Send
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setSilverPlayerId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => setSilverPlayerId(id)}
                            >
                              + Silver
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
