import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import {
  DayPhases, VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO,
} from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';
import { CompactProgressBar } from './dashboard/CompactProgressBar';
import { DayTimeline } from './dashboard/DayTimeline';
import {
  Scale, Gamepad, MagicStick3, AltArrowDown, CupStar,
} from '@solar-icons/react';

/* ------------------------------------------------------------------ */
/*  Mechanic Spotlight Card                                            */
/* ------------------------------------------------------------------ */

interface SpotlightCardProps {
  icon: React.ComponentType<any>;
  color: string;
  bgGradient: string;
  label: string;
  name: string;
  description: string;
  detail?: string;
  isActive?: boolean;
  isCompleted?: boolean;
}

function SpotlightCard({
  icon: Icon,
  color,
  bgGradient,
  label,
  name,
  description,
  detail,
  isActive,
  isCompleted,
}: SpotlightCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      onClick={() => detail && setExpanded(!expanded)}
      style={{
        borderRadius: 16,
        padding: '14px 16px',
        background: bgGradient,
        border: `1px solid ${color}20`,
        cursor: detail ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      whileTap={detail ? { scale: 0.98 } : undefined}
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute',
        top: -14,
        right: -14,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `${color}08`,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} weight="Bold" color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 10,
              fontWeight: 800,
              color: color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {label}
            </span>
            {isActive && (
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 8,
                fontWeight: 800,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: 4,
                background: `${color}18`,
              }}>
                NOW
              </span>
            )}
            {isCompleted && (
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 8,
                fontWeight: 800,
                color: '#6B9E6E',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(107, 158, 110, 0.12)',
              }}>
                DONE
              </span>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 16,
            fontWeight: 800,
            color: '#3D2E1F',
            letterSpacing: '0.01em',
          }}>
            {name}
          </span>
        </div>
        {detail && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ flexShrink: 0 }}
          >
            <AltArrowDown size={14} weight="Bold" color="#9B8E7E" />
          </motion.div>
        )}
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 13,
        lineHeight: 1.45,
        color: '#5A4A3A',
      }}>
        {description}
      </p>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${color}15`,
            }}>
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 9,
                fontWeight: 800,
                color: '#9B8E7E',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: 4,
              }}>
                How it works
              </span>
              <p style={{
                margin: 0,
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#7A6E60',
              }}>
                {detail}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ScheduleTab                                                        */
/* ------------------------------------------------------------------ */

export function ScheduleTab() {
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  const completedCartridges = useGameStore(s => s.completedCartridges);

  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType as VoteType | undefined;
  const gameType = currentDay?.gameType as GameType | undefined;
  const activityType = currentDay?.activityType as PromptType | undefined;

  // Check which mechanics are completed/active
  const mechanicStates = useMemo(() => {
    const completedKinds = new Set(
      completedCartridges
        .filter(c => (c.snapshot.dayIndex ?? 0) === dayIndex || (c.snapshot.dayIndex ?? 0) === 0)
        .map(c => c.kind)
    );
    return {
      votingCompleted: completedKinds.has('voting'),
      votingActive: phase === DayPhases.VOTING || phase === DayPhases.ELIMINATION,
      gameCompleted: completedKinds.has('game'),
      gameActive: phase === DayPhases.GAME,
      activityCompleted: completedKinds.has('prompt'),
      activityActive: phase === DayPhases.ACTIVITY,
    };
  }, [completedCartridges, dayIndex, phase]);

  const voteInfo = voteType ? VOTE_TYPE_INFO[voteType] : null;
  const gameInfo = gameType && gameType !== 'NONE'
    ? GAME_TYPE_INFO[gameType as Exclude<GameType, 'NONE'>] : null;
  const activityInfo = activityType && activityType !== 'NONE'
    ? ACTIVITY_TYPE_INFO[activityType as PromptType] : null;

  const hasSpotlights = !!(voteInfo || gameInfo || activityInfo);

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

        {/* Mechanic Spotlight Cards */}
        {hasSpotlights && (
          <div style={{ marginTop: 8 }}>
            {/* Section label */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
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
                Today's Lineup
              </span>
              <div style={{
                flex: 1,
                height: 1,
                background: 'rgba(155, 142, 126, 0.12)',
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Vote mechanic */}
              {voteInfo && (
                <SpotlightCard
                  icon={voteType === 'FINALS' ? CupStar : Scale}
                  color="#E89B3A"
                  bgGradient="linear-gradient(135deg, rgba(232, 155, 58, 0.04) 0%, rgba(232, 155, 58, 0.1) 100%)"
                  label="Vote"
                  name={voteInfo.name}
                  description={voteInfo.description}
                  detail={voteInfo.howItWorks}
                  isActive={mechanicStates.votingActive}
                  isCompleted={mechanicStates.votingCompleted}
                />
              )}

              {/* Game mechanic */}
              {gameInfo && (
                <SpotlightCard
                  icon={Gamepad}
                  color="#3BA99C"
                  bgGradient="linear-gradient(135deg, rgba(59, 169, 156, 0.04) 0%, rgba(59, 169, 156, 0.1) 100%)"
                  label="Mini-Game"
                  name={gameInfo.name}
                  description={gameInfo.description}
                  detail="Play the mini-game to earn silver. Silver breaks vote ties and unlocks perks."
                  isActive={mechanicStates.gameActive}
                  isCompleted={mechanicStates.gameCompleted}
                />
              )}

              {/* Activity mechanic */}
              {activityInfo && (
                <SpotlightCard
                  icon={MagicStick3}
                  color="#8B6CC1"
                  bgGradient="linear-gradient(135deg, rgba(139, 108, 193, 0.04) 0%, rgba(139, 108, 193, 0.1) 100%)"
                  label="Activity"
                  name={activityInfo.name}
                  description={activityInfo.description}
                  detail="Answer the prompt to reveal your personality and earn silver."
                  isActive={mechanicStates.activityActive}
                  isCompleted={mechanicStates.activityCompleted}
                />
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <DayTimeline />
      </div>
    </div>
  );
}
