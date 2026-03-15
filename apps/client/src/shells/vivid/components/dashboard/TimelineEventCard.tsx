import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOTE_TYPE_INFO, renderActionInfo } from '@pecking-order/shared-types';
import type { DashboardEvent } from './dashboardUtils';
import { formatEventTime } from './dashboardUtils';
import { VIVID_SPRING } from '../../springs';
import {
  ChatDots, Scale, Gamepad, PlayCircle, ClockCircle, CheckCircle, AltArrowDown,
} from '@solar-icons/react';

interface TimelineEventCardProps {
  event: DashboardEvent;
  voteType?: string;
  gameType?: string;
  promptType?: string;
  roster?: Record<string, { personaName: string }>;
  isLast?: boolean;
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

export function TimelineEventCard({ event, voteType, roster, isLast }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[event.category] || '#9B8E7E';
  const Icon = CATEGORY_ICONS[event.category] || ClockCircle;

  const explainer = getExplainer(event, voteType);
  const hasExpandable = !!explainer || (event.state === 'completed' && !!event.result);

  const isActive = event.state === 'active';
  const isCompleted = event.state === 'completed';
  const isUpcoming = event.state === 'upcoming';

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Left rail: time + dot + line */}
      <div
        style={{
          width: 56,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 14,
        }}
      >
        {/* Time label */}
        <span
          style={{
            fontFamily: 'var(--vivid-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: isActive ? color : '#9B8E7E',
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: '0.02em',
            marginBottom: 8,
            opacity: isUpcoming ? 0.65 : 1,
          }}
        >
          {formatEventTime(event.time)}
        </span>

        {/* Dot */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isActive && (
            <div style={{
              position: 'absolute',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: `${color}18`,
              animation: 'vivid-live-pulse 2s ease-in-out infinite',
            }} />
          )}
          <div
            style={{
              width: isActive ? 10 : isCompleted ? 10 : 6,
              height: isActive ? 10 : isCompleted ? 10 : 6,
              borderRadius: '50%',
              background: isUpcoming ? 'rgba(155, 142, 126, 0.2)' : color,
              transition: 'all 0.3s ease',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>

        {/* Connector line */}
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 1.5,
              background: isCompleted
                ? `linear-gradient(to bottom, ${color}40, rgba(155, 142, 126, 0.1))`
                : 'rgba(155, 142, 126, 0.1)',
              marginTop: 6,
              borderRadius: 1,
              minHeight: 12,
            }}
          />
        )}
      </div>

      {/* Card */}
      <motion.div
        onClick={hasExpandable ? () => setExpanded(!expanded) : undefined}
        style={{
          flex: 1,
          marginBottom: 8,
          padding: isActive ? '12px 14px' : hasExpandable ? '10px 14px' : '10px 14px',
          borderRadius: 14,
          cursor: hasExpandable ? 'pointer' : 'default',
          background: isActive
            ? `linear-gradient(135deg, ${color}0A 0%, ${color}14 100%)`
            : isCompleted
              ? 'rgba(139, 115, 85, 0.04)'
              : 'transparent',
          border: isActive
            ? `1.5px solid ${color}30`
            : isCompleted
              ? '1px solid rgba(139, 115, 85, 0.06)'
              : '1px solid transparent',
          opacity: isUpcoming ? 0.65 : 1,
          transition: 'background 0.3s, border 0.3s, opacity 0.3s',
        }}
        whileTap={hasExpandable ? { scale: 0.98 } : undefined}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: isUpcoming ? 'rgba(155, 142, 126, 0.06)' : `${color}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={15} weight="Bold" color={isUpcoming ? '#9B8E7E' : color} />
          </div>
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: isUpcoming ? '#9B8E7E' : '#3D2E1F',
              flex: 1,
            }}
          >
            {event.label}
          </span>

          {/* Status badges */}
          {isActive && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 9,
                fontWeight: 800,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '3px 8px',
                borderRadius: 6,
                background: `${color}18`,
              }}
            >
              LIVE
            </span>
          )}
          {isCompleted && (
            <CheckCircle size={16} weight="Bold" color={color} />
          )}
          {hasExpandable && !isCompleted && !isActive && (
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <AltArrowDown size={14} weight="Bold" color="#9B8E7E" />
            </motion.div>
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
              <div style={{
                paddingTop: 10,
                marginTop: 10,
                borderTop: '1px solid rgba(139, 115, 85, 0.06)',
              }}>
                {event.state === 'completed' && event.result ? (
                  <CompletedContent event={event} roster={roster} color={color} />
                ) : explainer ? (
                  <p
                    style={{
                      fontFamily: 'var(--vivid-font-body)',
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: '#7A6E60',
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
      </motion.div>
    </div>
  );
}

function getExplainer(event: DashboardEvent, voteType?: string): string | null {
  if (event.category === 'voting' && voteType) {
    const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
    if (info) return info.howItWorks;
  }
  const actionInfo = renderActionInfo(event.action);
  if (actionInfo.howItWorks) return actionInfo.howItWorks;
  return null;
}

function CompletedContent({ event, roster, color }: { event: DashboardEvent; roster?: Record<string, { personaName: string }>; color: string }) {
  const result = event.result;
  if (!result) return null;

  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;

  if (event.category === 'voting') {
    const tally: Record<string, number> = result.summary?.tallies ?? {};
    const eliminatedId: string | null = result.eliminatedId ?? null;
    const winnerId: string | null = result.winnerId ?? null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(tally)
          .sort(([, a], [, b]) => b - a)
          .map(([pid, votes]) => (
            <div key={pid} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 0',
            }}>
              <span style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 13,
                color: '#3D2E1F',
                fontWeight: pid === eliminatedId ? 700 : 500,
                textDecoration: pid === eliminatedId ? 'line-through' : 'none',
                flex: 1,
              }}>
                {getName(pid)}
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <div style={{
                  height: 4,
                  width: Math.max(8, votes * 20),
                  maxWidth: 60,
                  borderRadius: 2,
                  background: color,
                  opacity: 0.4,
                }} />
                <span style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: color,
                  minWidth: 18,
                  textAlign: 'right',
                }}>
                  {votes}
                </span>
              </div>
            </div>
          ))}
        {eliminatedId && (
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(232, 97, 77, 0.06)',
            border: '1px solid rgba(232, 97, 77, 0.12)',
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: '#D04A35',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {getName(eliminatedId)} eliminated
          </div>
        )}
        {winnerId && (
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(212, 150, 10, 0.06)',
            border: '1px solid rgba(212, 150, 10, 0.15)',
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: '#B8840A',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(rewards)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([pid, amount]) => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 13,
                color: '#3D2E1F',
                fontWeight: 500,
                flex: 1,
              }}>
                {getName(pid)}
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                fontWeight: 600,
                color: '#B8840A',
              }}>
                +{amount}
              </span>
            </div>
          ))}
      </div>
    );
  }

  return null;
}
