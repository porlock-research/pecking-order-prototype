import React from 'react';
import { GAME_TYPE_INFO } from '@pecking-order/shared-types';
import type { GameType } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import { useGameStore } from '../../../../store/useGameStore';
import { SelfHighlight, SelfHighlightLabel } from './SelfHighlight';
import { Cup, MedalRibbonStar } from '@solar-icons/react';

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface GameResult {
  gameType: string;
  silverRewards?: Record<string, number>;
  summary?: {
    players?: Record<string, any>;
    scores?: Record<string, number>;
  };
}

interface GameResultDetailProps {
  result: GameResult;
  roster?: Record<string, RosterEntry>;
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
/*  Score extraction helper                                             */
/* ------------------------------------------------------------------ */

function extractScore(pid: string, result: GameResult): string | null {
  const playerData = result.summary?.players?.[pid];

  if (playerData) {
    // Check result.distance (e.g., GAP_RUN)
    if (playerData.result?.distance != null) {
      return `${playerData.result.distance}m`;
    }
    // Check result.correctAnswers (e.g., TRIVIA)
    if (playerData.result?.correctAnswers != null) {
      return `${playerData.result.correctAnswers} correct`;
    }
    // Check correctCount (e.g., alternative trivia shape)
    if (playerData.correctCount != null) {
      return `${playerData.correctCount} correct`;
    }
    // Check result.score (generic)
    if (playerData.result?.score != null) {
      return `${playerData.result.score} pts`;
    }
    // Check playerData.score (top-level score)
    if (playerData.score != null) {
      return `${playerData.score} pts`;
    }
  }

  // For REALTIME_TRIVIA: check summary.scores directly
  const scoreFromSummary = result.summary?.scores?.[pid];
  if (scoreFromSummary != null) {
    return `${scoreFromSummary} pts`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Ordinal helper                                                      */
/* ------------------------------------------------------------------ */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const GAME_COLOR = '#3BA99C';

export function GameResultDetail({ result, roster }: GameResultDetailProps) {
  const playerId = useGameStore((s) => s.playerId);
  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster?.[pid]?.avatarUrl;

  const gameType = result.gameType as Exclude<GameType, 'NONE'>;
  const info = GAME_TYPE_INFO[gameType];
  const rewards: Record<string, number> = result.silverRewards ?? {};
  const sorted = Object.entries(rewards).sort(([, a], [, b]) => b - a);

  // Self placement
  const selfReward = playerId ? rewards[playerId] : undefined;
  const selfRank = playerId
    ? sorted.findIndex(([pid]) => pid === playerId) + 1
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Game header */}
      {info && (
        <div style={{ marginBottom: 4 }}>
          <div style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: GAME_COLOR,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {info.name}
          </div>
          <div style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 11,
            color: '#9B8E7E',
            marginTop: 2,
            lineHeight: 1.4,
          }}>
            {info.description}
          </div>
        </div>
      )}

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

      {/* Leaderboard rows */}
      {sorted.map(([pid, amount], i) => {
        const rank = i + 1;
        const score = extractScore(pid, result);
        const isDnf = amount === 0 && !score;
        return (
          <div key={pid} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 0',
            opacity: isDnf ? 0.45 : 1,
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
              color: isDnf ? '#9B8E7E' : '#3D2E1F',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {getName(pid)}
            </span>
            {isDnf ? (
              <span style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: '#9B8E7E',
                fontStyle: 'italic',
                flexShrink: 0,
              }}>
                DNF
              </span>
            ) : (
              <>
                {score && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#7A6E60',
                    flexShrink: 0,
                  }}>
                    {score}
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#B8840A',
                  flexShrink: 0,
                }}>
                  +{amount}
                </span>
              </>
            )}
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

      {/* Self-highlight */}
      {playerId && selfRank > 0 && selfReward !== undefined && (
        <SelfHighlight>
          You placed <SelfHighlightLabel>{ordinal(selfRank)}</SelfHighlightLabel> — earned <SelfHighlightLabel>{selfReward} silver</SelfHighlightLabel>.
        </SelfHighlight>
      )}
    </div>
  );
}
