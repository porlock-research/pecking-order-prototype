import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import type { DashboardEvent } from './dashboardUtils';
import { formatEventTime } from './dashboardUtils';
import { VIVID_SPRING } from '../../springs';
import {
  ChatDots, Scale, Gamepad, PlayCircle, ClockCircle, CheckCircle,
} from '@solar-icons/react';

interface TimelineEventCardProps {
  event: DashboardEvent;
  voteType?: string;
  gameType?: string;
  promptType?: string;
  roster?: Record<string, { personaName: string }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  voting: '#E89B3A',
  game: '#3BA99C',
  prompt: '#8B6CC1',
  social: '#6B9E6E',
  day: '#9B8E7E',
};

const CATEGORY_ICONS: Record<string, React.FC<any>> = {
  voting: Scale,
  game: Gamepad,
  prompt: PlayCircle,
  social: ChatDots,
  day: ClockCircle,
};

export function TimelineEventCard({ event, voteType, gameType, promptType, roster }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[event.category] || '#9B8E7E';
  const Icon = CATEGORY_ICONS[event.category] || ClockCircle;

  const explainer = getExplainer(event, voteType);
  const hasExpandable = !!explainer || event.state === 'completed';

  return (
    <motion.div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        minHeight: 44,
        opacity: event.state === 'upcoming' ? 0.6 : 1,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: event.state === 'upcoming' ? 0.6 : 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Time column */}
      <div
        style={{
          width: 52,
          flexShrink: 0,
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 12,
          fontWeight: 600,
          color: event.state === 'active' ? color : 'var(--vivid-text-dim)',
          textAlign: 'right',
          paddingTop: 2,
        }}
      >
        {formatEventTime(event.time)}
      </div>

      {/* Timeline dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div
          style={{
            width: event.state === 'active' ? 12 : 8,
            height: event.state === 'active' ? 12 : 8,
            borderRadius: '50%',
            background: event.state === 'completed' ? color : event.state === 'active' ? color : 'rgba(155,142,126,0.3)',
            border: event.state === 'active' ? `2px solid ${color}` : 'none',
            boxShadow: event.state === 'active' ? `0 0 8px ${color}50` : 'none',
            transition: 'all 0.3s ease',
            marginTop: 4,
          }}
        />
        <div
          style={{
            flex: 1,
            width: 1,
            background: 'rgba(155,142,126,0.15)',
            marginTop: 4,
          }}
        />
      </div>

      {/* Card content */}
      <div
        onClick={hasExpandable ? () => setExpanded(!expanded) : undefined}
        style={{
          flex: 1,
          cursor: hasExpandable ? 'pointer' : 'default',
          background: event.state === 'active'
            ? `${color}10`
            : event.state === 'completed'
              ? 'rgba(155,142,126,0.06)'
              : 'transparent',
          borderRadius: 12,
          padding: hasExpandable ? '10px 12px' : '4px 0',
          border: event.state === 'active' ? `1px solid ${color}30` : '1px solid transparent',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} weight="Bold" color={color} />
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--vivid-text)',
              flex: 1,
            }}
          >
            {event.label}
          </span>
          {event.state === 'active' && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 10,
                fontWeight: 800,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: 9999,
                background: `${color}20`,
              }}
            >
              LIVE
            </span>
          )}
          {event.state === 'completed' && (
            <CheckCircle size={16} weight="Bold" color={color} />
          )}
        </div>

        {/* Expandable content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 8 }}>
                {event.state === 'completed' && event.result ? (
                  <CompletedContent event={event} roster={roster} />
                ) : explainer ? (
                  <p
                    style={{
                      fontFamily: 'var(--vivid-font-body)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--vivid-text-dim)',
                      margin: 0,
                    }}
                  >
                    {explainer}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Get explainer text for an event */
function getExplainer(event: DashboardEvent, voteType?: string): string | null {
  if (event.category === 'voting' && voteType) {
    const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
    if (info) return info.howItWorks;
  }
  if (event.category === 'social') {
    if (event.action === 'OPEN_DMS') return 'Send private messages to other players. Each message costs 1 silver.';
    if (event.action === 'OPEN_GROUP_CHAT') return 'The main group chat is open. Everyone can see these messages.';
  }
  return null;
}

/** Render completed results inline */
function CompletedContent({ event, roster }: { event: DashboardEvent; roster?: Record<string, { personaName: string }> }) {
  const result = event.result;
  if (!result) return null;

  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;

  if (event.category === 'voting') {
    const tally: Record<string, number> = result.summary?.tallies ?? {};
    const eliminatedId: string | null = result.eliminatedId ?? null;
    const winnerId: string | null = result.winnerId ?? null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(tally)
          .sort(([, a], [, b]) => b - a)
          .map(([pid, votes]) => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: 'var(--vivid-text)',
                fontWeight: pid === eliminatedId ? 700 : 400,
                textDecoration: pid === eliminatedId ? 'line-through' : 'none',
              }}>
                {getName(pid)}
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-mono)', fontSize: 12, color: '#E89B3A',
              }}>
                {votes} vote{votes !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        {eliminatedId && (
          <div style={{
            marginTop: 4, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(232,97,77,0.1)', border: '1px solid rgba(232,97,77,0.2)',
            fontFamily: 'var(--vivid-font-display)', fontSize: 12, fontWeight: 700,
            color: '#E8614D', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {getName(eliminatedId)} eliminated
          </div>
        )}
        {winnerId && (
          <div style={{
            marginTop: 4, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,217,61,0.1)', border: '1px solid rgba(255,217,61,0.3)',
            fontFamily: 'var(--vivid-font-display)', fontSize: 12, fontWeight: 700,
            color: '#D4960A', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {getName(winnerId)} wins!
          </div>
        )}
      </div>
    );
  }

  if (event.category === 'game') {
    const rewards: Record<string, number> = result.silverRewards ?? {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(rewards)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([pid, amount]) => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: 'var(--vivid-text)' }}>
                {getName(pid)}
              </span>
              <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 12, color: '#D4960A' }}>
                +{amount} silver
              </span>
            </div>
          ))}
      </div>
    );
  }

  return null;
}
