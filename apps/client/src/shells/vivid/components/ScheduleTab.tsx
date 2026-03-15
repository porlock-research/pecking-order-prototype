import React from 'react';
import { CompactProgressBar } from './dashboard/CompactProgressBar';
import { DayTimeline } from './dashboard/DayTimeline';

export function ScheduleTab() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        className="vivid-hide-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 16px 24px',
        }}
      >
        <CompactProgressBar variant="full" />
        <DayTimeline />
      </div>
    </div>
  );
}
