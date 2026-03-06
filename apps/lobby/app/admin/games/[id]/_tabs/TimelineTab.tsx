'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TimelineTabProps {
  state: any;
  scheduledTasks: { count: number; tasks: Array<{ id: string; time: number }> } | null;
  tasksLoading: boolean;
  onRefreshTasks: () => void;
  onFlushTasks: () => void;
  onCommand: (cmd: any) => Promise<void>;
}

export function TimelineTab({ state, scheduledTasks, tasksLoading, onRefreshTasks, onFlushTasks, onCommand }: TimelineTabProps) {
  const currentDay = state.manifest?.days?.find((d: any) => d.dayIndex === state.day);

  return (
    <div className="space-y-6">
      {/* Scheduled Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Scheduled Tasks</CardTitle>
          <div className="flex items-center gap-2">
            {scheduledTasks && (
              <Badge variant="secondary">{scheduledTasks.count} task{scheduledTasks.count !== 1 ? 's' : ''}</Badge>
            )}
            <Button variant="outline" size="sm" onClick={onRefreshTasks} disabled={tasksLoading}>
              {tasksLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => {
              if (confirm('Flush all scheduled tasks?')) onFlushTasks();
            }}>
              Flush All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scheduledTasks && scheduledTasks.tasks.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledTasks.tasks.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {typeof t.time === 'number'
                          ? new Date(t.time * 1000).toLocaleString()
                          : t.time}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scheduled tasks.</p>
          )}
        </CardContent>
      </Card>

      {/* Timeline Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline Injection</CardTitle>
        </CardHeader>
        <CardContent>
          {currentDay ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge>Day {currentDay.dayIndex}</Badge>
                <span className="text-sm text-muted-foreground">{currentDay.theme}</span>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Payload</TableHead>
                      <TableHead className="text-right">Control</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentDay.timeline.map((event: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.time.split('T')[1]?.split('.')[0] || event.time}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-xs" title={JSON.stringify(event.payload)}>
                          {JSON.stringify(event.payload)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCommand({
                              type: 'INJECT_TIMELINE_EVENT',
                              action: event.action,
                              payload: event.payload,
                            })}
                          >
                            Fire Now
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center border-2 border-dashed rounded-md">
              <p className="text-muted-foreground">No timeline available for current state.</p>
              {state.day === 0 && <p className="text-sm text-muted-foreground mt-1">Start Day 1 to load the manifest.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
