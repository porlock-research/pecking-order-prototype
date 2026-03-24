import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOTE_TYPE_INFO, renderActionInfo } from '@pecking-order/shared-types';
import type { DashboardEvent } from './dashboardUtils';
import { formatEventTime } from './dashboardUtils';
import { VIVID_SPRING } from '../../springs';
import {
  ChatDots, Scale, Gamepad, PlayCircle, ClockCircle, CheckCircle, AltArrowDown,
} from '@solar-icons/react';
import { VotingResultDetail } from './VotingResultDetail';
import { GameResultDetail } from './GameResultDetail';
import { PromptResultDetail } from './PromptResultDetail';

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface TimelineEventCardProps {
  event: DashboardEvent;
  voteType?: string;
  gameType?: string;
  promptType?: string;
  roster?: Record<string, RosterEntry>;
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
  const hasResult = event.state === 'completed' && !!event.result;
  const [expanded, setExpanded] = useState(hasResult);
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
              width: isCompleted ? 2 : 1.5,
              background: isCompleted
                ? color
                : isActive
                  ? `linear-gradient(to bottom, ${color}, rgba(155, 142, 126, 0.1))`
                  : 'rgba(155, 142, 126, 0.1)',
              marginTop: 6,
              borderRadius: 1,
              minHeight: 12,
              opacity: isCompleted ? 0.4 : 1,
              transition: 'all 0.3s ease',
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

/* ------------------------------------------------------------------ */
/*  CompletedContent — rich result rendering per cartridge type         */
/* ------------------------------------------------------------------ */

function CompletedContent({ event, roster }: { event: DashboardEvent; roster?: Record<string, RosterEntry>; color: string }) {
  const result = event.result;
  if (!result) return null;

  /* ---- VOTING ---- */
  if (event.category === 'voting') {
    return <VotingResultDetail result={result} roster={roster} />;
  }

  /* ---- GAME ---- */
  if (event.category === 'game') {
    return <GameResultDetail result={result} roster={roster} />;
  }

  /* ---- PROMPT / ACTIVITY ---- */
  if (event.category === 'prompt') {
    return <PromptResultDetail result={result} roster={roster} />;
  }

  return null;
}
