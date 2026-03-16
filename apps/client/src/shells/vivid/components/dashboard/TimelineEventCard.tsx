import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOTE_TYPE_INFO, renderActionInfo } from '@pecking-order/shared-types';
import type { DashboardEvent } from './dashboardUtils';
import { formatEventTime } from './dashboardUtils';
import { VIVID_SPRING } from '../../springs';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import {
  ChatDots, Scale, Gamepad, PlayCircle, ClockCircle, CheckCircle, AltArrowDown,
  Cup, MedalRibbonStar,
} from '@solar-icons/react';

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

/* ------------------------------------------------------------------ */
/*  Rank badge — gold/silver/bronze for top 3                          */
/* ------------------------------------------------------------------ */

const RANK_COLORS: Record<number, string> = {
  1: '#D4960A',
  2: '#9B8E7E',
  3: '#C4713B',
};

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank];
  if (!color) {
    return (
      <span style={{
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 10,
        fontWeight: 700,
        color: '#9B8E7E',
        width: 20,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        #{rank}
      </span>
    );
  }
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: 6,
      background: `${color}18`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {rank === 1 ? (
        <Cup size={12} weight="Bold" color={color} />
      ) : (
        <MedalRibbonStar size={12} weight="Bold" color={color} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vote bar — proportional width relative to max votes                */
/* ------------------------------------------------------------------ */

function VoteBar({ votes, maxVotes, color }: { votes: number; maxVotes: number; color: string }) {
  const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{
        height: 6,
        width: Math.max(12, pct * 0.8),
        maxWidth: 80,
        borderRadius: 3,
        background: `linear-gradient(90deg, ${color}60, ${color})`,
        transition: 'width 0.4s ease',
      }} />
      <span style={{
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 11,
        fontWeight: 700,
        color: color,
        minWidth: 14,
        textAlign: 'right',
      }}>
        {votes}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CompletedContent — rich result rendering per cartridge type         */
/* ------------------------------------------------------------------ */

function CompletedContent({ event, roster, color }: { event: DashboardEvent; roster?: Record<string, RosterEntry>; color: string }) {
  const result = event.result;
  if (!result) return null;

  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster?.[pid]?.avatarUrl;

  /* ---- VOTING ---- */
  if (event.category === 'voting') {
    const tally: Record<string, number> = result.summary?.tallies ?? {};
    const eliminatedId: string | null = result.eliminatedId ?? null;
    const winnerId: string | null = result.winnerId ?? null;
    const maxVotes = Math.max(1, ...Object.values(tally));

    const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(([pid, votes]) => {
          const isElim = pid === eliminatedId;
          return (
            <div key={pid} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              opacity: isElim ? 0.7 : 1,
            }}>
              <PersonaAvatar
                avatarUrl={getAvatar(pid)}
                personaName={getName(pid)}
                size={24}
                eliminated={isElim}
              />
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 13,
                color: isElim ? '#D04A35' : '#3D2E1F',
                fontWeight: 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: isElim ? 'line-through' : 'none',
              }}>
                {getName(pid)}
              </span>
              <VoteBar votes={votes} maxVotes={maxVotes} color={color} />
            </div>
          );
        })}

        {/* Outcome callout */}
        {eliminatedId && (
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(232, 97, 77, 0.06)',
            border: '1px solid rgba(232, 97, 77, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <PersonaAvatar
              avatarUrl={getAvatar(eliminatedId)}
              personaName={getName(eliminatedId)}
              size={20}
              eliminated
            />
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 11,
              fontWeight: 800,
              color: '#D04A35',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {getName(eliminatedId)} eliminated
            </span>
          </div>
        )}
        {winnerId && (
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(212, 150, 10, 0.06)',
            border: '1px solid rgba(212, 150, 10, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Cup size={14} weight="Bold" color="#B8840A" />
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 11,
              fontWeight: 800,
              color: '#B8840A',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {getName(winnerId)} wins!
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ---- GAME ---- */
  if (event.category === 'game') {
    const rewards: Record<string, number> = result.silverRewards ?? {};
    const sorted = Object.entries(rewards).sort(([, a], [, b]) => b - a);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Section label */}
        <div style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 9,
          fontWeight: 800,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 2,
        }}>
          Leaderboard
        </div>

        {sorted.map(([pid, amount], i) => {
          const rank = i + 1;
          return (
            <div key={pid} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
            }}>
              <RankBadge rank={rank} />
              <PersonaAvatar
                avatarUrl={getAvatar(pid)}
                personaName={getName(pid)}
                size={24}
              />
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 13,
                fontWeight: rank <= 3 ? 700 : 500,
                color: '#3D2E1F',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {getName(pid)}
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: '#B8840A',
                flexShrink: 0,
              }}>
                +{amount}
              </span>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <span style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 12,
            color: '#9B8E7E',
            fontStyle: 'italic',
          }}>
            No results yet
          </span>
        )}
      </div>
    );
  }

  /* ---- PROMPT / ACTIVITY ---- */
  if (event.category === 'prompt') {
    const rewards: Record<string, number> = result.silverRewards ?? {};
    const promptText: string | undefined = result.promptText;
    const participantCount: number = result.participantCount ?? 0;
    const sorted = Object.entries(rewards).sort(([, a], [, b]) => b - a);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Prompt text */}
        {promptText && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: `${color}08`,
            border: `1px solid ${color}15`,
          }}>
            <p style={{
              margin: 0,
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#3D2E1F',
              fontStyle: 'italic',
            }}>
              "{promptText}"
            </p>
          </div>
        )}

        {/* Participant count */}
        <div style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 10,
          fontWeight: 700,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>

        {/* Reward list */}
        {sorted.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sorted.map(([pid, amount]) => (
              <div key={pid} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 0',
              }}>
                <PersonaAvatar
                  avatarUrl={getAvatar(pid)}
                  personaName={getName(pid)}
                  size={22}
                />
                <span style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#3D2E1F',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {getName(pid)}
                </span>
                <span style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#B8840A',
                  flexShrink: 0,
                }}>
                  +{amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
