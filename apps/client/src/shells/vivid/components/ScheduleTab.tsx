import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type CompletedCartridge } from '../../../store/useGameStore';
import {
  DayPhases, VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, DILEMMA_TYPE_INFO,
} from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType, DilemmaType } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';
import { CompactProgressBar } from './dashboard/CompactProgressBar';
import { DayTimeline } from './dashboard/DayTimeline';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import {
  Scale, Gamepad, MagicStick3, AltArrowDown, CupStar, HandMoney,
} from '@solar-icons/react';

/* ------------------------------------------------------------------ */
/*  Result Section Components                                          */
/* ------------------------------------------------------------------ */

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--vivid-font-display)',
  fontSize: 9,
  fontWeight: 800,
  color: '#9B8E7E',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: 6,
};

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
};

const resultNameStyle: React.CSSProperties = {
  fontFamily: 'var(--vivid-font-display)',
  fontSize: 13,
  fontWeight: 700,
  color: '#3D2E1F',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const silverBadgeStyle: React.CSSProperties = {
  fontFamily: 'var(--vivid-font-display)',
  fontSize: 11,
  fontWeight: 800,
  color: '#B8860B',
  flexShrink: 0,
};

function VotingResult({ snapshot, roster }: { snapshot: any; roster: Record<string, any> }) {
  const eliminatedId = snapshot.eliminatedId;
  const tallies = snapshot.summary?.tallies ?? {};
  const eliminated = eliminatedId ? roster[eliminatedId] : null;

  const sortedTallies = Object.entries(tallies)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(232, 155, 58, 0.12)' }}>
      <span style={sectionLabelStyle}>Results</span>
      {eliminated && (
        <div style={{ ...resultRowStyle, marginBottom: 6 }}>
          <PersonaAvatar url={eliminated.avatarUrl} size={32} />
          <span style={resultNameStyle}>{eliminated.personaName}</span>
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 10,
            fontWeight: 800,
            color: '#C94444',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(201, 68, 68, 0.1)',
          }}>
            Eliminated
          </span>
        </div>
      )}
      {sortedTallies.length > 0 && (
        <>
          <span style={{ ...sectionLabelStyle, marginTop: 8 }}>Vote Tallies</span>
          {sortedTallies.map(([playerId, count]) => {
            const player = roster[playerId];
            if (!player) return null;
            return (
              <div key={playerId} style={resultRowStyle}>
                <PersonaAvatar url={player.avatarUrl} size={24} />
                <span style={{ ...resultNameStyle, fontSize: 12 }}>{player.personaName}</span>
                <span style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#5A4A3A',
                  flexShrink: 0,
                }}>
                  {count as number} {(count as number) === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function GameResult({ snapshot, roster }: { snapshot: any; roster: Record<string, any> }) {
  const silverRewards = snapshot.silverRewards ?? {};
  const sorted = Object.entries(silverRewards)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  if (sorted.length === 0) return null;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(59, 169, 156, 0.12)' }}>
      <span style={sectionLabelStyle}>Leaderboard</span>
      {sorted.map(([playerId, silver], i) => {
        const player = roster[playerId];
        if (!player) return null;
        const isTop3 = i < 3;
        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        return (
          <div key={playerId} style={{
            ...resultRowStyle,
            background: isTop3 ? 'rgba(59, 169, 156, 0.04)' : undefined,
            borderRadius: isTop3 ? 8 : undefined,
            padding: isTop3 ? '6px 8px' : '4px 0',
          }}>
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 12,
              fontWeight: 800,
              color: '#9B8E7E',
              width: 20,
              textAlign: 'center',
              flexShrink: 0,
            }}>
              {isTop3 ? medals[i] : `${i + 1}.`}
            </span>
            <PersonaAvatar url={player.avatarUrl} size={24} />
            <span style={{ ...resultNameStyle, fontSize: 12, fontWeight: isTop3 ? 800 : 700 }}>
              {player.personaName}
            </span>
            <span style={silverBadgeStyle}>
              +{silver as number}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PromptResult({ snapshot }: { snapshot: any }) {
  const participantCount = snapshot.participantCount ?? 0;
  const silverRewards = snapshot.silverRewards ?? {};
  const totalSilver = Object.values(silverRewards).reduce((sum: number, v) => sum + (v as number), 0);

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(139, 108, 193, 0.12)' }}>
      <span style={sectionLabelStyle}>Results</span>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 20,
            fontWeight: 800,
            color: '#8B6CC1',
          }}>
            {participantCount}
          </span>
          <span style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 11,
            color: '#7A6E60',
            marginLeft: 4,
          }}>
            participants
          </span>
        </div>
        {totalSilver > 0 && (
          <div>
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 20,
              fontWeight: 800,
              color: '#B8860B',
            }}>
              {totalSilver}
            </span>
            <span style={{
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 11,
              color: '#7A6E60',
              marginLeft: 4,
            }}>
              silver distributed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DilemmaResult({ snapshot, roster }: { snapshot: any; roster: Record<string, any> }) {
  const dilemmaType = snapshot.dilemmaType;
  const summary = snapshot.summary ?? {};
  const getName = (id: string) => roster[id]?.personaName ?? id;

  let summaryText = '';

  if (summary.timedOut) {
    summaryText = `Time's up — only ${summary.submitted ?? 0} of ${summary.eligible ?? '?'} participated. No rewards.`;
  } else if (dilemmaType === 'SILVER_GAMBIT') {
    if (summary.allDonated) {
      summaryText = `Everyone donated! ${getName(summary.winnerId)} won +${summary.jackpot} silver`;
    } else {
      summaryText = `Someone kept their silver. No jackpot.`;
    }
  } else if (dilemmaType === 'SPOTLIGHT') {
    if (summary.unanimous) {
      summaryText = `Unanimous! ${getName(summary.targetId)} gets +20 silver`;
    } else {
      summaryText = 'No consensus — picks were split.';
    }
  } else if (dilemmaType === 'GIFT_OR_GRIEF') {
    const gifted = (summary.giftedIds ?? []).map(getName).join(', ');
    const grieved = (summary.grievedIds ?? []).map(getName).join(', ');
    const parts: string[] = [];
    if (gifted) parts.push(`${gifted} gifted +10`);
    if (grieved) parts.push(`${grieved} grieved -10`);
    summaryText = parts.length > 0 ? parts.join(' \u00b7 ') : 'No nominations';
  }

  const silverRewards = snapshot.silverRewards ?? {};
  const totalSilver = Object.values(silverRewards).reduce((sum: number, v) => sum + (v as number), 0);

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(207, 134, 75, 0.12)' }}>
      <span style={sectionLabelStyle}>Outcome</span>
      <p style={{
        margin: 0,
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 13,
        lineHeight: 1.45,
        color: '#3D2E1F',
        fontWeight: 600,
      }}>
        {summaryText}
      </p>
      {totalSilver > 0 && (
        <span style={{
          ...silverBadgeStyle,
          display: 'inline-block',
          marginTop: 4,
          fontSize: 12,
        }}>
          {totalSilver} silver distributed
        </span>
      )}
    </div>
  );
}

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
  resultSection?: React.ReactNode;
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
  resultSection,
}: SpotlightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandable = !!(detail || resultSection);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      onClick={() => hasExpandable && setExpanded(!expanded)}
      style={{
        borderRadius: 16,
        padding: '14px 16px',
        background: bgGradient,
        border: `1px solid ${color}20`,
        cursor: hasExpandable ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      whileTap={hasExpandable ? { scale: 0.98 } : undefined}
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
        {hasExpandable && (
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

      {/* Expandable detail + result */}
      <AnimatePresence>
        {expanded && hasExpandable && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {detail && (
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
            )}
            {resultSection}
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
  const roster = useGameStore(s => s.roster);

  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType as VoteType | undefined;
  const gameType = currentDay?.gameType as GameType | undefined;
  const activityType = currentDay?.activityType as PromptType | undefined;
  const dilemmaType = currentDay?.dilemmaType as DilemmaType | undefined;

  // Get completed cartridges for the current day, indexed by kind
  const dayCartridges = useMemo(() => {
    const byKind: Partial<Record<CompletedCartridge['kind'], CompletedCartridge>> = {};
    for (const c of completedCartridges) {
      if ((c.snapshot.dayIndex ?? 0) === dayIndex || (c.snapshot.dayIndex ?? 0) === 0) {
        byKind[c.kind] = c;
      }
    }
    return byKind;
  }, [completedCartridges, dayIndex]);

  // Check which mechanics are completed/active
  const mechanicStates = useMemo(() => {
    return {
      votingCompleted: !!dayCartridges.voting,
      votingActive: phase === DayPhases.VOTING || phase === DayPhases.ELIMINATION,
      gameCompleted: !!dayCartridges.game,
      gameActive: phase === DayPhases.GAME,
      activityCompleted: !!dayCartridges.prompt,
      activityActive: phase === DayPhases.ACTIVITY,
      dilemmaCompleted: !!dayCartridges.dilemma,
      dilemmaActive: phase === ('dilemma' as string),
    };
  }, [dayCartridges, phase]);

  const voteInfo = voteType ? VOTE_TYPE_INFO[voteType] : null;
  const gameInfo = gameType && gameType !== 'NONE'
    ? GAME_TYPE_INFO[gameType as Exclude<GameType, 'NONE'>] : null;
  const activityInfo = activityType && activityType !== 'NONE'
    ? ACTIVITY_TYPE_INFO[activityType as PromptType] : null;
  const dilemmaInfo = dilemmaType && dilemmaType !== 'NONE'
    ? DILEMMA_TYPE_INFO[dilemmaType as DilemmaType] : null;

  const hasSpotlights = !!(voteInfo || gameInfo || activityInfo || dilemmaInfo);

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
                  resultSection={mechanicStates.votingCompleted && dayCartridges.voting
                    ? <VotingResult snapshot={dayCartridges.voting.snapshot} roster={roster} />
                    : undefined
                  }
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
                  resultSection={mechanicStates.gameCompleted && dayCartridges.game
                    ? <GameResult snapshot={dayCartridges.game.snapshot} roster={roster} />
                    : undefined
                  }
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
                  resultSection={mechanicStates.activityCompleted && dayCartridges.prompt
                    ? <PromptResult snapshot={dayCartridges.prompt.snapshot} />
                    : undefined
                  }
                />
              )}

              {/* Dilemma mechanic */}
              {dilemmaInfo && (
                <SpotlightCard
                  icon={HandMoney}
                  color="#CF864B"
                  bgGradient="linear-gradient(135deg, rgba(207, 134, 75, 0.04) 0%, rgba(207, 134, 75, 0.1) 100%)"
                  label="Daily Dilemma"
                  name={dilemmaInfo.name}
                  description={dilemmaInfo.description}
                  detail={dilemmaInfo.howItWorks}
                  isActive={mechanicStates.dilemmaActive}
                  isCompleted={mechanicStates.dilemmaCompleted}
                  resultSection={mechanicStates.dilemmaCompleted && dayCartridges.dilemma
                    ? <DilemmaResult snapshot={dayCartridges.dilemma.snapshot} roster={roster} />
                    : undefined
                  }
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
