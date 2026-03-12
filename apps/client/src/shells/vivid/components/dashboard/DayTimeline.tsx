import React, { useMemo } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { buildDashboardEvents } from './dashboardUtils';
import { TimelineEventCard } from './TimelineEventCard';

export function DayTimeline() {
  const completedCartridges = useGameStore(s => s.completedCartridges);
  const serverState = useGameStore(s => s.serverState);
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);
  const roster = useGameStore(s => s.roster);

  const currentDay = manifest?.days?.[dayIndex - 1];
  const timeline = currentDay?.timeline ?? [];
  const voteType = currentDay?.voteType;
  const gameType = currentDay?.gameType;
  const promptType = currentDay?.activityType;

  const events = useMemo(
    () => buildDashboardEvents({ timeline, completedCartridges, serverState, dayIndex }),
    [timeline, completedCartridges, serverState, dayIndex],
  );

  if (events.length === 0) {
    return (
      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 14,
          color: 'var(--vivid-text-dim)',
          margin: 0,
        }}>
          No events scheduled yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {events.map((event, i) => (
        <TimelineEventCard
          key={`${event.action}-${event.time}-${i}`}
          event={event}
          voteType={voteType}
          gameType={gameType}
          promptType={promptType}
          roster={roster}
        />
      ))}
    </div>
  );
}
