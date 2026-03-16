import React, { useMemo } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import {
  VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO,
} from '@pecking-order/shared-types';
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
  const gameType = currentDay?.gameType as string | undefined;
  const promptType = currentDay?.activityType as string | undefined;

  // Enrich event labels with specific mechanic names
  const events = useMemo(() => {
    const base = buildDashboardEvents({ timeline, completedCartridges, serverState, dayIndex });
    return base.map(event => {
      if (event.category === 'voting' && voteType) {
        const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
        if (info) return { ...event, label: info.name };
      }
      if (event.category === 'game' && gameType && gameType !== 'NONE') {
        const info = (GAME_TYPE_INFO as Record<string, { name: string }>)[gameType];
        if (info) return { ...event, label: info.name };
      }
      if (event.category === 'prompt' && promptType && promptType !== 'NONE') {
        const info = (ACTIVITY_TYPE_INFO as Record<string, { name: string }>)[promptType];
        if (info) return { ...event, label: info.name };
      }
      return event;
    });
  }, [timeline, completedCartridges, serverState, dayIndex, voteType, gameType, promptType]);

  if (events.length === 0) {
    return (
      <div style={{
        padding: '24px 0',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          color: '#9B8E7E',
          margin: 0,
        }}>
          No events scheduled yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 14 }}>
      {/* Section label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 11,
          fontWeight: 800,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Schedule
        </span>
        <div style={{
          flex: 1,
          height: 1,
          background: 'rgba(155, 142, 126, 0.12)',
        }} />
      </div>

      {/* Event cards */}
      {events.map((event, i) => (
        <TimelineEventCard
          key={`${event.action}-${event.time}-${i}`}
          event={event}
          voteType={voteType}
          gameType={gameType}
          promptType={promptType}
          roster={roster}
          isLast={i === events.length - 1}
        />
      ))}
    </div>
  );
}
