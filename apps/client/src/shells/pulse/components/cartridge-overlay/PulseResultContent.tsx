import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CartridgeKind } from '@pecking-order/shared-types';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { Crown, Skull, Lightning, Eye, Fire, Coins, Heart } from '../../icons';

/**
 * Rich per-kind result content for the Pulse cartridge overlay.
 *
 * Rendered inside CartridgeResultCard after the kind-themed title block.
 * Reuses Vivid CompletedSummary's data-extraction logic (voting mechanism
 * tally shapes, prompt response mapping, dilemma per-type summaries) but
 * styled Pulse-native: Outfit font, Phosphor Fill icons, --pulse-* tokens,
 * persona photos over gradients.
 */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface Props {
  kind: CartridgeKind;
  snapshot: any;
}

export function PulseResultContent({ kind, snapshot }: Props) {
  const roster = useGameStore(s => s.roster) as Record<string, RosterEntry>;
  const playerId = useGameStore(s => s.playerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {kind === 'voting' && <VotingResult snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'game' && <GameResult snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'prompt' && <PromptResult snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'dilemma' && <DilemmaResult snapshot={snapshot} roster={roster} playerId={playerId} />}
    </div>
  );
}

// ─── shared atoms ─────────────────────────────────────────────────────────

function Avatar({ pid, roster, size = 28, eliminated = false, colorIndex }: {
  pid: string; roster: Record<string, RosterEntry>; size?: number; eliminated?: boolean; colorIndex?: number;
}) {
  const player = roster[pid];
  const name = player?.personaName ?? pid;
  const rosterKeys = Object.keys(roster);
  const idx = colorIndex ?? rosterKeys.indexOf(pid);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, position: 'relative',
        filter: eliminated ? 'grayscale(1)' : undefined,
        opacity: eliminated ? 0.55 : 1,
      }}
    >
      <PersonaImage
        avatarUrl={player?.avatarUrl}
        cacheKey={pid}
        preferredVariant="headshot"
        initials={initialsOf(name)}
        playerColor={getPlayerColor(Math.max(0, idx))}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        alt={name}
      />
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
        padding: '2px 7px', borderRadius: 999,
        background: `${color}20`, color, border: `1px solid ${color}40`,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function SelfCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 14px', borderRadius: 12,
        background: 'var(--pulse-accent-glow)',
        border: '1px solid var(--pulse-accent)',
        fontSize: 13, color: 'var(--pulse-text-1)',
        fontFamily: 'var(--po-font-body)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

function SelfLabel({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 800, color: 'var(--pulse-accent)' }}>{children}</strong>;
}

function VoteBar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(6, (count / max) * 100) : 6;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div
        style={{
          width: Math.min(80, Math.max(12, pct * 0.8)),
          height: 6, borderRadius: 3,
          background: `linear-gradient(90deg, ${color}60, ${color})`,
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 14, textAlign: 'right' }}>
        {count}
      </span>
    </div>
  );
}

// ─── voting ───────────────────────────────────────────────────────────────

function VotingResult({ snapshot, roster, playerId }: {
  snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null;
}) {
  const mechanism: string | undefined = snapshot.mechanism || snapshot.voteType;
  const eliminatedId: string | null = snapshot.eliminatedId ?? snapshot.results?.eliminatedId ?? null;
  const winnerId: string | null = snapshot.winnerId ?? snapshot.results?.winnerId ?? null;
  const immunePlayerIds: string[] = snapshot.summary?.immunePlayerIds ?? [];
  const votes: Record<string, string> | undefined = snapshot.summary?.votes ?? snapshot.votes;

  const isSecondToLast = mechanism === 'SECOND_TO_LAST';
  const isShield = mechanism === 'SHIELD';
  const isExecutioner = mechanism === 'EXECUTIONER';
  const rawTallies: Record<string, number> =
    snapshot.summary?.tallies ??
    snapshot.summary?.voteCounts ??
    snapshot.summary?.saveCounts ??
    snapshot.summary?.electionTallies ??
    snapshot.tallies ?? {};

  const silverRanking: Array<{ id: string; silver: number }> = isSecondToLast
    ? (snapshot.summary?.silverRanking ?? [])
    : [];
  const executionerId: string | null = isExecutioner ? (snapshot.summary?.executionerId ?? null) : null;

  // Build full tally with 0-count alive players (skip for SECOND_TO_LAST)
  const tallies = { ...rawTallies };
  if (!isSecondToLast) {
    for (const pid of Object.keys(roster)) {
      if (!(pid in tallies) && roster[pid]?.status !== 'ELIMINATED') {
        tallies[pid] = 0;
      }
    }
  }
  const maxVotes = Math.max(1, ...Object.values(tallies));

  const sorted: Array<[string, number]> = isSecondToLast
    ? silverRanking.map(r => [r.id, r.silver] as [string, number])
    : Object.entries(tallies).sort(([, a], [, b]) => b - a);

  // Voter attribution reverse map + abstainer detection, both computed in
  // a single pass so the memo deps can reference stable inputs instead of
  // a per-render Set.
  const { votersFor, abstainers } = useMemo(() => {
    const votersForMap: Record<string, string[]> = {};
    const voterSet = new Set<string>();
    if (votes) {
      for (const [voterId, targetId] of Object.entries(votes)) {
        if (!votersForMap[targetId]) votersForMap[targetId] = [];
        votersForMap[targetId].push(voterId);
        voterSet.add(voterId);
      }
    }
    const abs: string[] = [];
    if (votes && !isSecondToLast) {
      for (const pid of Object.keys(roster)) {
        const wasEliminatedBefore = roster[pid]?.status === 'ELIMINATED' && pid !== eliminatedId;
        if (!wasEliminatedBefore && !voterSet.has(pid)) abs.push(pid);
      }
    }
    return { votersFor: votersForMap, abstainers: abs };
  }, [votes, isSecondToLast, roster, eliminatedId]);

  const mechanicOneLiner = mechanism
    ? (VOTE_TYPE_INFO as Record<string, { oneLiner?: string }>)[mechanism]?.oneLiner
    : null;

  const selfVotes = playerId ? tallies[playerId] : undefined;
  const selfRank = playerId ? sorted.findIndex(([pid]) => pid === playerId) + 1 : 0;
  const tallyLabel = isShield ? 'shield' : 'vote';

  return (
    <>
      {mechanicOneLiner && (
        <p
          style={{
            margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--pulse-text-2)',
            fontFamily: 'var(--po-font-body)', textAlign: 'center',
          }}
        >
          {mechanicOneLiner}
        </p>
      )}

      {winnerId && roster[winnerId] && (
        <OutcomeRow
          pid={winnerId} roster={roster} label="Winner"
          color="var(--pulse-gold)" icon={<Crown size={18} weight="fill" />}
        />
      )}
      {eliminatedId && roster[eliminatedId] && (
        <OutcomeRow
          pid={eliminatedId} roster={roster} label="Eliminated"
          color="var(--pulse-accent)" icon={<Skull size={18} weight="fill" />}
          eliminated
        />
      )}
      {executionerId && roster[executionerId] && (
        <OutcomeRow
          pid={executionerId} roster={roster} label="Executioner"
          color="var(--pulse-dilemma)" icon={<Lightning size={18} weight="fill" />}
        />
      )}

      {sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map(([pid, count]) => {
            const isElim = pid === eliminatedId;
            const isWinner = pid === winnerId;
            const isImmune = immunePlayerIds.includes(pid);
            const voters = votersFor[pid];
            const name = roster[pid]?.personaName ?? pid;
            return (
              <div key={pid}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10,
                    background: 'var(--pulse-surface-2)',
                    border: '1px solid var(--pulse-border)',
                    opacity: isElim ? 0.75 : 1,
                  }}
                >
                  <Avatar pid={pid} roster={roster} size={28} eliminated={isElim} />
                  <span
                    style={{
                      fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0,
                      color: isElim ? 'var(--pulse-accent)' : 'var(--pulse-text-1)',
                      textDecoration: isElim ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'var(--po-font-display)',
                    }}
                  >
                    {name}
                  </span>
                  {isElim && <Pill label="Eliminated" color="var(--pulse-accent)" />}
                  {isWinner && !isElim && <Pill label="Winner" color="var(--pulse-gold)" />}
                  {isImmune && !isElim && !isWinner && <Pill label="Immune" color="var(--pulse-dilemma)" />}
                  {isSecondToLast ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pulse-text-2)', flexShrink: 0 }}>
                      {count} silver
                    </span>
                  ) : (
                    <VoteBar count={count} max={maxVotes} color="var(--pulse-vote)" />
                  )}
                </div>
                {voters && voters.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 40, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {isShield ? 'shielded by' : 'from'}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {voters.map(vid => (
                        <div key={vid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Avatar pid={vid} roster={roster} size={16} />
                          <span style={{ fontSize: 10, color: 'var(--pulse-text-2)' }}>
                            {(roster[vid]?.personaName ?? vid).split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {abstainers.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '8px 12px', borderRadius: 10,
            background: 'var(--pulse-surface)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Abstained
          </span>
          {abstainers.map(pid => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Avatar pid={pid} roster={roster} size={18} />
              <span style={{ fontSize: 11, color: 'var(--pulse-text-2)' }}>
                {(roster[pid]?.personaName ?? pid).split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {playerId && (isSecondToLast ? selfRank > 0 : selfVotes !== undefined) && (
        <SelfCallout>
          {playerId === eliminatedId ? (
            isSecondToLast ? (
              <>
                <SelfLabel>You were eliminated</SelfLabel> — second-lowest silver.
              </>
            ) : (
              <>
                <SelfLabel>You were eliminated</SelfLabel> with {selfVotes} {tallyLabel}
                {selfVotes !== 1 ? 's' : ''}.
              </>
            )
          ) : immunePlayerIds.includes(playerId) ? (
            <><SelfLabel>You were immune</SelfLabel>.</>
          ) : playerId === executionerId ? (
            <><SelfLabel>You were the Executioner</SelfLabel>.</>
          ) : isSecondToLast ? (
            <>You placed <SelfLabel>{ordinal(selfRank)}</SelfLabel> by silver balance.</>
          ) : (
            <>
              You received <SelfLabel>{selfVotes} {tallyLabel}{selfVotes !== 1 ? 's' : ''}</SelfLabel>
              {' — '}{ordinal(selfRank)} place.
            </>
          )}
        </SelfCallout>
      )}
    </>
  );
}

function OutcomeRow({ pid, roster, label, color, icon, eliminated }: {
  pid: string; roster: Record<string, RosterEntry>; label: string; color: string;
  icon?: React.ReactNode; eliminated?: boolean;
}) {
  const name = roster[pid]?.personaName ?? pid;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 14,
        background: `${color}12`, border: `1px solid ${color}40`,
      }}
    >
      <Avatar pid={pid} roster={roster} size={36} eliminated={eliminated} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0, fontSize: 10, fontWeight: 700, color,
            textTransform: 'uppercase', letterSpacing: 0.8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {icon}
          {label}
        </p>
        <p
          style={{
            margin: '2px 0 0', fontSize: 18, fontWeight: 800,
            fontFamily: 'var(--po-font-display)', color: 'var(--pulse-text-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {name}
        </p>
      </div>
    </div>
  );
}

// ─── game ─────────────────────────────────────────────────────────────────

function extractScore(pid: string, snapshot: any): string | null {
  const playerData = snapshot.summary?.players?.[pid];
  if (playerData) {
    if (playerData.result?.distance != null) return `${playerData.result.distance}m`;
    if (playerData.result?.correctAnswers != null) return `${playerData.result.correctAnswers} correct`;
    if (playerData.correctCount != null) return `${playerData.correctCount} correct`;
    if (playerData.result?.score != null) return `${playerData.result.score} pts`;
    if (playerData.score != null) return `${playerData.score} pts`;
  }
  const scoreFromSummary = snapshot.summary?.scores?.[pid];
  if (scoreFromSummary != null) return `${scoreFromSummary} pts`;
  return null;
}

function GameResult({ snapshot, roster, playerId }: {
  snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null;
}) {
  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const sorted = Object.entries(rewards).sort(([, a], [, b]) => (b as number) - (a as number));

  const selfReward = playerId ? rewards[playerId] : undefined;
  const selfRank = playerId ? sorted.findIndex(([pid]) => pid === playerId) + 1 : 0;

  if (sorted.length === 0) {
    return (
      <p style={{ color: 'var(--pulse-text-3)', fontStyle: 'italic', textAlign: 'center' }}>
        No results yet
      </p>
    );
  }

  return (
    <>
      <SectionLabel>Leaderboard</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(([pid, amount], i) => {
          const rank = i + 1;
          const score = extractScore(pid, snapshot);
          const isDnf = (amount as number) === 0 && !score;
          return (
            <div
              key={pid}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'var(--pulse-surface-2)',
                border: '1px solid var(--pulse-border)',
                opacity: isDnf ? 0.5 : 1,
              }}
            >
              <RankBadge rank={rank} />
              <Avatar pid={pid} roster={roster} size={28} />
              <span
                style={{
                  flex: 1, minWidth: 0,
                  fontSize: 14, fontWeight: rank <= 3 ? 800 : 600,
                  fontFamily: 'var(--po-font-display)',
                  color: isDnf ? 'var(--pulse-text-3)' : 'var(--pulse-text-1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {roster[pid]?.personaName ?? pid}
              </span>
              {isDnf ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>
                  DNF
                </span>
              ) : (
                <>
                  {score && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pulse-text-2)' }}>
                      {score}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pulse-gold)' }}>
                    +{amount}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {playerId && selfRank > 0 && selfReward !== undefined && (
        <SelfCallout>
          You placed <SelfLabel>{ordinal(selfRank)}</SelfLabel> — earned{' '}
          <SelfLabel>{selfReward} silver</SelfLabel>.
        </SelfCallout>
      )}
    </>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'var(--pulse-gold)',
    2: 'var(--pulse-text-2)',
    3: '#c4713b',
  };
  const color = colors[rank];
  if (!color) {
    return (
      <span
        style={{
          width: 22, height: 22, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--pulse-surface-3)',
          color: 'var(--pulse-text-3)', fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}
      >
        #{rank}
      </span>
    );
  }
  return (
    <div
      style={{
        width: 22, height: 22, borderRadius: 6,
        background: `${color}24`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color,
      }}
    >
      {rank === 1 ? <Crown size={14} weight="fill" /> : <span style={{ fontSize: 11, fontWeight: 800 }}>{rank}</span>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        color: 'var(--pulse-text-3)', textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

// ─── prompt ───────────────────────────────────────────────────────────────

function resolveResponseText(response: string, promptType: string, snapshot: any, getName: (pid: string) => string): string {
  switch (promptType) {
    case 'WOULD_YOU_RATHER': {
      const optionA = snapshot.results?.optionA ?? 'Option A';
      const optionB = snapshot.results?.optionB ?? 'Option B';
      return response === 'A' ? optionA : response === 'B' ? optionB : response;
    }
    case 'HOT_TAKE':
      return response === 'AGREE' ? 'Agree' : response === 'DISAGREE' ? 'Disagree' : response;
    case 'PLAYER_PICK':
    case 'PREDICTION':
      return getName(response);
    default:
      return response;
  }
}

function PromptResult({ snapshot, roster, playerId }: {
  snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null;
}) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const promptType: string = snapshot.promptType;
  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const participantCount: number = snapshot.participantCount ?? (snapshot.playerResponses ? Object.keys(snapshot.playerResponses).length : 0);
  const totalPlayers = Object.keys(roster).length || participantCount;
  const isAnonymous = promptType === 'CONFESSION' || promptType === 'GUESS_WHO';
  const anonymousConfessions: { index: number; text: string }[] = snapshot.results?.anonymousConfessions ?? [];
  const selfReward = playerId ? rewards[playerId] : undefined;

  return (
    <>
      {snapshot.promptText && (
        <blockquote
          style={{
            margin: 0, padding: '14px 16px', borderRadius: 12,
            background: 'color-mix(in oklch, var(--pulse-prompt) 8%, var(--pulse-surface-2))',
            border: '1px solid color-mix(in oklch, var(--pulse-prompt) 22%, transparent)',
            fontSize: 14, lineHeight: 1.5, fontStyle: 'italic',
            color: 'var(--pulse-text-1)', fontFamily: 'var(--po-font-body)',
          }}
        >
          &ldquo;{snapshot.promptText}&rdquo;
        </blockquote>
      )}

      {(promptType === 'HOT_TAKE' || promptType === 'WOULD_YOU_RATHER') && snapshot.results && (
        <StanceBar promptType={promptType} results={snapshot.results} />
      )}

      {snapshot.playerResponses && !isAnonymous && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(snapshot.playerResponses as Record<string, string>).map(([pid, response]) => {
            const isSelf = pid === playerId;
            const displayText = resolveResponseText(response, promptType, snapshot, getName);
            return (
              <div
                key={pid}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: isSelf ? 'var(--pulse-accent-glow)' : 'var(--pulse-surface-2)',
                  border: `1px solid ${isSelf ? 'var(--pulse-accent)' : 'var(--pulse-border)'}`,
                }}
              >
                <Avatar pid={pid} roster={roster} size={26} />
                <span
                  style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)',
                    fontFamily: 'var(--po-font-display)', flexShrink: 0,
                    maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {getName(pid)}
                </span>
                {isSelf && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--pulse-accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    you
                  </span>
                )}
                <span
                  style={{
                    flex: 1, minWidth: 0,
                    fontSize: 12, color: 'var(--pulse-text-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {displayText}
                </span>
                {rewards[pid] != null && rewards[pid] > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pulse-gold)' }}>
                    +{rewards[pid]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAnonymous && anonymousConfessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anonymousConfessions.map((c, i) => (
            <blockquote
              key={c.index ?? i}
              style={{
                margin: 0, padding: '10px 14px', borderRadius: 12,
                background: 'var(--pulse-surface-2)',
                border: '1px solid var(--pulse-border)',
                fontSize: 13, lineHeight: 1.5, fontStyle: 'italic',
                color: 'var(--pulse-text-1)', fontFamily: 'var(--po-font-body)',
              }}
            >
              &ldquo;{c.text}&rdquo;
            </blockquote>
          ))}
        </div>
      )}

      <p
        style={{
          margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--pulse-text-3)',
          textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center',
        }}
      >
        {participantCount} of {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} participated
      </p>

      {playerId && (
        <>
          {selfReward != null && selfReward > 0 ? (
            <SelfCallout>You earned <SelfLabel>{selfReward} silver</SelfLabel>.</SelfCallout>
          ) : snapshot.playerResponses?.[playerId] !== undefined ? (
            <SelfCallout>You participated.</SelfCallout>
          ) : null}
        </>
      )}
    </>
  );
}

function StanceBar({ promptType, results }: { promptType: string; results: any }) {
  if (promptType === 'HOT_TAKE') {
    const agree = results.agreeCount ?? 0;
    const disagree = results.disagreeCount ?? 0;
    if (agree + disagree === 0) return null;
    return (
      <DualBar
        leftLabel="Agree" rightLabel="Disagree"
        leftCount={agree} rightCount={disagree}
        leftColor="var(--pulse-vote)" rightColor="var(--pulse-accent)"
        minority={results.minorityStance === 'AGREE' ? 'left' : results.minorityStance === 'DISAGREE' ? 'right' : null}
      />
    );
  }
  if (promptType === 'WOULD_YOU_RATHER') {
    const countA = results.countA ?? 0;
    const countB = results.countB ?? 0;
    if (countA + countB === 0) return null;
    return (
      <DualBar
        leftLabel={(results.optionA ?? 'Option A').slice(0, 30)}
        rightLabel={(results.optionB ?? 'Option B').slice(0, 30)}
        leftCount={countA} rightCount={countB}
        leftColor="var(--pulse-prompt)" rightColor="var(--pulse-nudge)"
        minority={results.minorityChoice === 'A' ? 'left' : results.minorityChoice === 'B' ? 'right' : null}
      />
    );
  }
  return null;
}

function DualBar({ leftLabel, rightLabel, leftCount, rightCount, leftColor, rightColor, minority }: {
  leftLabel: string; rightLabel: string;
  leftCount: number; rightCount: number;
  leftColor: string; rightColor: string;
  minority: 'left' | 'right' | null;
}) {
  const total = leftCount + rightCount;
  const leftPct = total > 0 ? Math.round((leftCount / total) * 100) : 50;
  const rightPct = 100 - leftPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex', height: 26, borderRadius: 10, overflow: 'hidden',
          border: '1px solid var(--pulse-border)',
        }}
      >
        <div
          style={{
            width: `${leftPct}%`,
            background: `${leftColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRight: '1px solid var(--pulse-border)',
            color: leftColor, fontSize: 12, fontWeight: 800,
          }}
        >
          {leftPct}%
        </div>
        <div
          style={{
            width: `${rightPct}%`,
            background: `${rightColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: rightColor, fontSize: 12, fontWeight: 800,
          }}
        >
          {rightPct}%
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 11, fontWeight: minority === 'left' ? 800 : 500,
            color: leftColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '48%',
          }}
        >
          {leftLabel}
          {minority === 'left' && <MinorityTag />}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: minority === 'right' ? 800 : 500,
            color: rightColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '48%', textAlign: 'right',
          }}
        >
          {minority === 'right' && <MinorityTag />}
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

function MinorityTag() {
  return (
    <span
      style={{
        fontSize: 9, fontWeight: 800, color: 'var(--pulse-gold)',
        marginLeft: 4, marginRight: 4, letterSpacing: 0.4,
      }}
    >
      MINORITY
    </span>
  );
}

// ─── dilemma ──────────────────────────────────────────────────────────────

/**
 * DilemmaHero — cinematic winner portrait. The payoff of a dilemma should
 * land as a face + a word, not a banner full of text. Big persona image,
 * themed aura, display-face name.
 */
function DilemmaHero({
  pid,
  roster,
  accent,
  label,
  sublabel,
  icon,
}: {
  pid: string;
  roster: Record<string, RosterEntry>;
  accent: string;
  label: string;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const player = roster[pid];
  const name = player?.personaName ?? pid;
  const firstName = name.split(' ')[0];
  const rosterKeys = Object.keys(roster);
  const idx = Math.max(0, rosterKeys.indexOf(pid));
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.9, 1.04, 1], y: 0 }}
      transition={{ duration: 0.65, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        position: 'relative',
        padding: '22px 18px 20px',
        borderRadius: 18,
        background: `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 24%, transparent) 0%, color-mix(in oklch, ${accent} 8%, transparent) 55%, var(--pulse-surface-2)) 100%`,
        border: `1.5px solid color-mix(in oklch, ${accent} 48%, transparent)`,
        boxShadow: `0 0 42px color-mix(in oklch, ${accent} 32%, transparent), 0 0 96px color-mix(in oklch, ${accent} 14%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* soft atmospheric halo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-40% -10% auto -10%',
          height: '80%',
          background: `radial-gradient(60% 60% at 50% 30%, color-mix(in oklch, ${accent} 28%, transparent) 0%, transparent 70%)`,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      {/* portrait with conic ring */}
      <motion.div
        initial={reduce ? undefined : { scale: 0.9 }}
        animate={reduce ? undefined : { scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'relative',
          width: 124,
          height: 124,
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 40%, transparent), ${accent})`,
          boxShadow: `0 0 28px color-mix(in oklch, ${accent} 55%, transparent), 0 0 64px color-mix(in oklch, ${accent} 20%, transparent)`,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--pulse-surface-2)',
          }}
        >
          <PersonaImage
            avatarUrl={player?.avatarUrl}
            cacheKey={pid}
            preferredVariant="headshot"
            initials={initialsOf(name)}
            playerColor={getPlayerColor(idx)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            alt={name}
          />
        </div>
        {icon && (
          <div
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: accent,
              border: '2.5px solid var(--pulse-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pulse-text-inverted, #111)',
              boxShadow: `0 0 14px color-mix(in oklch, ${accent} 60%, transparent)`,
            }}
          >
            {icon}
          </div>
        )}
      </motion.div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.28em',
            color: accent,
            textTransform: 'uppercase',
            textShadow: `0 0 12px color-mix(in oklch, ${accent} 45%, transparent)`,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(24px, 6vw, 30px)',
            fontWeight: 800,
            letterSpacing: -0.6,
            lineHeight: 1.05,
            color: 'var(--pulse-text-1)',
          }}
        >
          {firstName}
        </span>
        {sublabel && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--po-font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: accent,
              letterSpacing: 0.1,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function DilemmaResult({ snapshot, roster, playerId }: {
  snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null;
}) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const summary: Record<string, any> = snapshot.summary ?? {};
  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const selfReward = playerId ? rewards[playerId] : undefined;

  let outcome: React.ReactNode = null;

  if (summary.timedOut) {
    outcome = (
      <OutcomeBanner
        tone="neutral"
        title="Time's up"
        body={`Only ${summary.submitted} of ${summary.eligible} participated.`}
        icon={<Eye size={16} weight="fill" />}
      />
    );
  } else if (snapshot.dilemmaType === 'SILVER_GAMBIT') {
    outcome = summary.allDonated && summary.winnerId ? (
      <DilemmaHero
        pid={summary.winnerId}
        roster={roster}
        accent="var(--pulse-gold)"
        label="Jackpot"
        sublabel={`wins ${summary.jackpot} silver`}
        icon={<Coins size={18} weight="fill" />}
      />
    ) : (
      <OutcomeBanner
        tone="lose"
        title="Someone defected…"
        body={`${summary.donorCount} donated, ${summary.keeperCount} kept. Donations lost!`}
        icon={<Fire size={16} weight="fill" />}
      />
    );
  } else if (snapshot.dilemmaType === 'SPOTLIGHT') {
    outcome = summary.unanimous && summary.targetId ? (
      <DilemmaHero
        pid={summary.targetId}
        roster={roster}
        accent="var(--pulse-accent)"
        label="Spotlight"
        sublabel="Unanimous — +20 silver"
        icon={<Crown size={18} weight="fill" />}
      />
    ) : (
      <OutcomeBanner
        tone="neutral"
        title="No consensus"
        body="Picks were split — no bonus this time."
      />
    );
  } else if (snapshot.dilemmaType === 'GIFT_OR_GRIEF') {
    const nominations: Record<string, number> = summary.nominations ?? {};
    const giftedIds: string[] = summary.giftedIds ?? [];
    const grievedIds: string[] = summary.grievedIds ?? [];
    const sorted = Object.entries(nominations).sort((a, b) => (b[1] as number) - (a[1] as number));
    const featuredId: string | undefined = giftedIds[0] || grievedIds[0];
    const featuredIsGift = !!giftedIds[0];

    outcome = sorted.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {featuredId && (
          <DilemmaHero
            pid={featuredId}
            roster={roster}
            accent={featuredIsGift ? 'var(--pulse-vote)' : 'var(--pulse-accent)'}
            label={featuredIsGift ? 'Gifted' : 'Grieved'}
            sublabel={featuredIsGift ? '+10 silver' : '−10 silver'}
            icon={featuredIsGift ? <Heart size={18} weight="fill" /> : <Fire size={18} weight="fill" />}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(([pid, count]) => {
          const isGifted = giftedIds.includes(pid);
          const isGrieved = grievedIds.includes(pid);
          const color = isGifted ? 'var(--pulse-vote)' : isGrieved ? 'var(--pulse-accent)' : 'var(--pulse-text-2)';
          return (
            <div
              key={pid}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: `${color}10`,
                border: `1px solid ${color}30`,
              }}
            >
              <Avatar pid={pid} roster={roster} size={26} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--po-font-display)' }}>
                {getName(pid)}
              </span>
              {isGifted && <Pill label="+10" color="var(--pulse-vote)" />}
              {isGrieved && <Pill label="-10" color="var(--pulse-accent)" />}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pulse-text-3)' }}>
                {count} {count === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          );
        })}
        </div>
      </div>
    ) : null;
  }

  return (
    <>
      {outcome}
      {playerId && selfReward != null && selfReward !== 0 && (
        <SelfCallout>
          You {selfReward > 0 ? 'earned' : 'lost'}{' '}
          <SelfLabel>
            {selfReward > 0 ? '+' : ''}{selfReward} silver
          </SelfLabel>.
        </SelfCallout>
      )}
    </>
  );
}

function OutcomeBanner({ tone, title, body, icon }: {
  tone: 'win' | 'lose' | 'neutral';
  title: string; body: React.ReactNode; icon?: React.ReactNode;
}) {
  const color =
    tone === 'win' ? 'var(--pulse-gold)'
    : tone === 'lose' ? 'var(--pulse-accent)'
    : 'var(--pulse-text-2)';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 16px', borderRadius: 14,
        background: `${color}14`, border: `1px solid ${color}40`,
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>
        {icon}
        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--po-font-display)' }}>
          {title}
        </span>
      </div>
      {body && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pulse-text-1)', fontFamily: 'var(--po-font-body)' }}>
          {body}
        </p>
      )}
    </div>
  );
}
