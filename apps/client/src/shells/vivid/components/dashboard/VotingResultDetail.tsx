import React from 'react';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import type { VoteType } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import { useGameStore } from '../../../../store/useGameStore';
import { SelfHighlight, SelfHighlightLabel } from './SelfHighlight';
import { Cup, MedalRibbonStar } from '@solar-icons/react';

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface VotingResult {
  mechanism: string;
  eliminatedId?: string | null;
  winnerId?: string | null;
  summary?: {
    tallies?: Record<string, number>;
    votes?: Record<string, string>;
  };
}

interface VotingResultDetailProps {
  result: VotingResult;
  roster?: Record<string, RosterEntry>;
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
/*  Semantic label for tally row                                        */
/* ------------------------------------------------------------------ */

function SemanticLabel({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontFamily: 'var(--vivid-font-display)',
      fontSize: 9,
      fontWeight: 800,
      color,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '2px 6px',
      borderRadius: 4,
      background: `${color}14`,
      flexShrink: 0,
    }}>
      {text}
    </span>
  );
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

const VOTING_COLOR = '#E89B3A';

export function VotingResultDetail({ result, roster }: VotingResultDetailProps) {
  const playerId = useGameStore((s) => s.playerId);
  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster?.[pid]?.avatarUrl;

  const mechanism = result.mechanism as VoteType;
  const info = VOTE_TYPE_INFO[mechanism];
  const tally: Record<string, number> = result.summary?.tallies ?? {};
  const eliminatedId: string | null = result.eliminatedId ?? null;
  const winnerId: string | null = result.winnerId ?? null;
  const maxVotes = Math.max(1, ...Object.values(tally));

  const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);

  // Determine self placement
  const selfVotes = playerId ? tally[playerId] : undefined;
  const selfRank = playerId
    ? sorted.findIndex(([pid]) => pid === playerId) + 1
    : 0;
  const selfEliminated = playerId === eliminatedId;

  // Determine which mechanism uses "safe" semantics (save-style votes)
  const isSaveMechanism = mechanism === 'BUBBLE' || mechanism === 'PODIUM_SACRIFICE' || mechanism === 'SHIELD';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Mechanic header */}
      {info && (
        <div style={{ marginBottom: 4 }}>
          <div style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: VOTING_COLOR,
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
            {info.oneLiner}
          </div>
        </div>
      )}

      {/* Tally rows */}
      {sorted.map(([pid, votes]) => {
        const isElim = pid === eliminatedId;
        const isWinner = pid === winnerId;
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
            {isElim && <SemanticLabel text="Eliminated" color="#D04A35" />}
            {isWinner && !isElim && <SemanticLabel text="Winner" color="#B8840A" />}
            {isSaveMechanism && !isElim && !isWinner && sorted.indexOf(sorted.find(([p]) => p === pid)!) === 0 && (
              <SemanticLabel text="Safe" color="#4A9B5A" />
            )}
            <VoteBar votes={votes} maxVotes={maxVotes} color={VOTING_COLOR} />
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

      {/* Self-highlight */}
      {playerId && selfVotes !== undefined && (
        <SelfHighlight>
          {selfEliminated ? (
            <>
              <SelfHighlightLabel>You were eliminated</SelfHighlightLabel> with {selfVotes} vote{selfVotes !== 1 ? 's' : ''}.
            </>
          ) : (
            <>
              You received <SelfHighlightLabel>{selfVotes} vote{selfVotes !== 1 ? 's' : ''}</SelfHighlightLabel> — {ordinal(selfRank)} place.
            </>
          )}
        </SelfHighlight>
      )}
    </div>
  );
}
