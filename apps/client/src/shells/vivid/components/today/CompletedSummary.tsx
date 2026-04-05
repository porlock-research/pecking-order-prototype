// apps/client/src/shells/vivid/components/today/CompletedSummary.tsx
//
// Rich result cards for completed cartridges in the Today tab.
// These render inside the existing card wrapper (SectionHeader is already shown),
// so we skip mechanic name/description headers.

import React from 'react';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import { useGameStore } from '../../../../store/useGameStore';
import { SelfHighlight, SelfHighlightLabel } from '../dashboard/SelfHighlight';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { Cup, MedalRibbonStar } from '@solar-icons/react';

/* ── shared types ─────────────────────────────────── */

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface CompletedSummaryProps {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  snapshot: any;
}

/* ── shared helpers ───────────────────────────────── */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function SemanticLabel({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontFamily: 'var(--vivid-font-display)',
      fontSize: 9, fontWeight: 800,
      color, textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '2px 6px', borderRadius: 4,
      background: `${color}14`, flexShrink: 0,
    }}>
      {text}
    </span>
  );
}

function VoteBar({ votes, maxVotes, color }: { votes: number; maxVotes: number; color: string }) {
  const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        height: 6,
        width: Math.max(12, pct * 0.8), maxWidth: 80,
        borderRadius: 3,
        background: `linear-gradient(90deg, ${color}60, ${color})`,
      }} />
      <span style={{
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 11, fontWeight: 700, color,
        minWidth: 14, textAlign: 'right',
      }}>
        {votes}
      </span>
    </div>
  );
}

const RANK_COLORS: Record<number, string> = { 1: '#D4960A', 2: '#9B8E7E', 3: '#C4713B' };

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank];
  if (!color) {
    return (
      <span style={{
        fontFamily: 'var(--vivid-font-mono)', fontSize: 10, fontWeight: 700,
        color: '#9B8E7E', width: 20, textAlign: 'center', flexShrink: 0,
      }}>
        #{rank}
      </span>
    );
  }
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 6,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {rank === 1
        ? <Cup size={12} weight="Bold" color={color} />
        : <MedalRibbonStar size={12} weight="Bold" color={color} />
      }
    </div>
  );
}

/* ── main entry ───────────────────────────────────── */

export function CompletedSummary({ kind, snapshot }: CompletedSummaryProps) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);

  return (
    <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {kind === 'voting' && <VotingCompleted snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'game' && <GameCompleted snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'prompt' && <PromptCompleted snapshot={snapshot} roster={roster} playerId={playerId} />}
      {kind === 'dilemma' && <DilemmaCompleted snapshot={snapshot} roster={roster} playerId={playerId} />}
    </div>
  );
}

/* ── voting ────────────────────────────────────────── */

const VOTING_COLOR = '#E89B3A';

function VotingCompleted({ snapshot, roster, playerId }: { snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null }) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster[pid]?.avatarUrl;

  const eliminatedId: string | null = snapshot.eliminatedId ?? snapshot.results?.eliminatedId ?? null;
  const winnerId: string | null = snapshot.winnerId ?? snapshot.results?.winnerId ?? null;
  const rawTallies: Record<string, number> = snapshot.summary?.tallies ?? snapshot.tallies ?? {};
  const votes: Record<string, string> | undefined = snapshot.summary?.votes;
  const immunePlayerIds: string[] = snapshot.summary?.immunePlayerIds ?? [];

  // Build full tally including 0-vote players from roster
  const tallies = { ...rawTallies };
  for (const pid of Object.keys(roster)) {
    if (!(pid in tallies) && roster[pid]?.status !== 'ELIMINATED') {
      tallies[pid] = 0;
    }
  }
  const maxVotes = Math.max(1, ...Object.values(tallies));

  const sorted = Object.entries(tallies).sort(([, a], [, b]) => b - a);

  // Self info
  const selfVotes = playerId ? tallies[playerId] : undefined;
  const selfRank = playerId ? sorted.findIndex(([pid]) => pid === playerId) + 1 : 0;

  // Build who-voted-for-whom reverse map: targetId -> voterIds
  const votersFor: Record<string, string[]> = {};
  const allVoterIds = new Set<string>();
  if (votes) {
    for (const [voterId, targetId] of Object.entries(votes)) {
      if (!votersFor[targetId]) votersFor[targetId] = [];
      votersFor[targetId].push(voterId);
      allVoterIds.add(voterId);
    }
  }

  // Detect abstainers — anyone who was eligible (alive at vote time) but didn't vote.
  // Players eliminated by THIS vote were alive during voting, so include them.
  // Players eliminated in previous days (status=ELIMINATED, not this vote's target) are excluded.
  const abstainers: string[] = [];
  if (votes) {
    for (const pid of Object.keys(roster)) {
      const wasEliminatedBefore = roster[pid]?.status === 'ELIMINATED' && pid !== eliminatedId;
      if (!wasEliminatedBefore && !allVoterIds.has(pid)) {
        abstainers.push(pid);
      }
    }
  }

  const mechanism = snapshot.mechanism;
  const mechanicInfo = mechanism ? (VOTE_TYPE_INFO as Record<string, { oneLiner?: string }>)[mechanism] : null;

  return (
    <>
      {/* Mechanic explanation */}
      {mechanicInfo?.oneLiner && (
        <div style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 11,
          color: '#9B8E7E', lineHeight: 1.4,
          padding: '4px 0 2px',
        }}>
          {mechanicInfo.oneLiner}
        </div>
      )}

      {/* Outcome callout */}
      {eliminatedId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(232, 97, 77, 0.06)', border: '1px solid rgba(232, 97, 77, 0.12)',
        }}>
          <PersonaAvatar avatarUrl={getAvatar(eliminatedId)} personaName={getName(eliminatedId)} size={24} eliminated />
          <span style={{
            fontFamily: 'var(--vivid-font-display)', fontSize: 13,
            fontWeight: 700, color: '#D04A35', flex: 1,
          }}>
            {getName(eliminatedId)}
          </span>
          <SemanticLabel text="Eliminated" color="#D04A35" />
        </div>
      )}
      {winnerId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(212, 150, 10, 0.06)', border: '1px solid rgba(212, 150, 10, 0.15)',
        }}>
          <Cup size={16} weight="Bold" color="#B8840A" />
          <span style={{
            fontFamily: 'var(--vivid-font-display)', fontSize: 13,
            fontWeight: 700, color: '#B8840A', flex: 1,
          }}>
            {getName(winnerId)} wins!
          </span>
        </div>
      )}

      {/* Tally rows with avatars, vote bars, semantic labels */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          {sorted.map(([pid, count]) => {
            const isElim = pid === eliminatedId;
            const isWinner = pid === winnerId;
            const isImmune = immunePlayerIds.includes(pid);
            const voters = votersFor[pid];
            return (
              <div key={pid}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                  opacity: isElim ? 0.7 : 1,
                }}>
                  <PersonaAvatar
                    avatarUrl={getAvatar(pid)}
                    personaName={getName(pid)}
                    size={24}
                    eliminated={isElim}
                  />
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)', fontSize: 13,
                    fontWeight: 600, flex: 1,
                    color: isElim ? '#D04A35' : '#3D2E1F',
                    textDecoration: isElim ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {getName(pid)}
                  </span>
                  {isElim && <SemanticLabel text="Eliminated" color="#D04A35" />}
                  {isWinner && !isElim && <SemanticLabel text="Winner" color="#B8840A" />}
                  {isImmune && !isElim && !isWinner && <SemanticLabel text="Immune" color="#8B6CC1" />}
                  <VoteBar votes={count} maxVotes={maxVotes} color={VOTING_COLOR} />
                </div>
                {/* Who voted for this player */}
                {voters && voters.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    marginLeft: 32, marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--vivid-font-body)', fontSize: 10,
                      color: '#9B8E7E',
                    }}>
                      from
                    </span>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {voters.map(vid => (
                        <div key={vid} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <PersonaAvatar avatarUrl={getAvatar(vid)} personaName={getName(vid)} size={16} />
                          <span style={{
                            fontFamily: 'var(--vivid-font-body)', fontSize: 10, color: '#9B8E7E',
                          }}>
                            {getName(vid).split(' ')[0]}
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

      {/* Abstainers */}
      {abstainers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(139, 115, 85, 0.04)',
        }}>
          <span style={{
            fontFamily: 'var(--vivid-font-display)', fontSize: 9, fontWeight: 700,
            color: '#9B8E7E', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
          }}>
            Abstained
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {abstainers.map(pid => (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <PersonaAvatar avatarUrl={getAvatar(pid)} personaName={getName(pid)} size={16} />
                <span style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 10, color: '#9B8E7E' }}>
                  {getName(pid).split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Self-highlight */}
      {playerId && selfVotes !== undefined && (
        <SelfHighlight>
          {playerId === eliminatedId ? (
            <>
              <SelfHighlightLabel>You were eliminated</SelfHighlightLabel> with {selfVotes} vote{selfVotes !== 1 ? 's' : ''}.
            </>
          ) : immunePlayerIds.includes(playerId) ? (
            <>
              <SelfHighlightLabel>You were immune</SelfHighlightLabel>.
            </>
          ) : (
            <>
              You received <SelfHighlightLabel>{selfVotes} vote{selfVotes !== 1 ? 's' : ''}</SelfHighlightLabel> — {ordinal(selfRank)} place.
            </>
          )}
        </SelfHighlight>
      )}
    </>
  );
}

/* ── game ──────────────────────────────────────────── */

const GAME_COLOR = '#3BA99C';

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

function GameCompleted({ snapshot, roster, playerId }: { snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null }) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster[pid]?.avatarUrl;

  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const sorted = Object.entries(rewards).sort(([, a], [, b]) => b - a);

  const selfReward = playerId ? rewards[playerId] : undefined;
  const selfRank = playerId ? sorted.findIndex(([pid]) => pid === playerId) + 1 : 0;

  if (sorted.length === 0) {
    return (
      <span style={{
        fontFamily: 'var(--vivid-font-body)', fontSize: 12,
        color: '#9B8E7E', fontStyle: 'italic',
      }}>
        No results yet
      </span>
    );
  }

  return (
    <>
      {/* Section label */}
      <div style={{
        fontFamily: 'var(--vivid-font-display)', fontSize: 9, fontWeight: 800,
        color: '#9B8E7E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
      }}>
        Leaderboard
      </div>

      {/* Leaderboard rows */}
      {sorted.map(([pid, amount], i) => {
        const rank = i + 1;
        const score = extractScore(pid, snapshot);
        const isDnf = amount === 0 && !score;
        return (
          <div key={pid} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 0', opacity: isDnf ? 0.45 : 1,
          }}>
            <RankBadge rank={rank} />
            <PersonaAvatar avatarUrl={getAvatar(pid)} personaName={getName(pid)} size={24} />
            <span style={{
              fontFamily: 'var(--vivid-font-display)', fontSize: 13,
              fontWeight: rank <= 3 ? 700 : 500,
              color: isDnf ? '#9B8E7E' : '#3D2E1F',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {getName(pid)}
            </span>
            {isDnf ? (
              <span style={{
                fontFamily: 'var(--vivid-font-mono)', fontSize: 10, fontWeight: 700,
                color: '#9B8E7E', fontStyle: 'italic', flexShrink: 0,
              }}>
                DNF
              </span>
            ) : (
              <>
                {score && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-mono)', fontSize: 10, fontWeight: 600,
                    color: '#7A6E60', flexShrink: 0,
                  }}>
                    {score}
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--vivid-font-mono)', fontSize: 12, fontWeight: 700,
                  color: '#B8840A', flexShrink: 0,
                }}>
                  +{amount}
                </span>
              </>
            )}
          </div>
        );
      })}

      {/* Self-highlight */}
      {playerId && selfRank > 0 && selfReward !== undefined && (
        <SelfHighlight>
          You placed <SelfHighlightLabel>{ordinal(selfRank)}</SelfHighlightLabel> — earned <SelfHighlightLabel>{selfReward} silver</SelfHighlightLabel>.
        </SelfHighlight>
      )}
    </>
  );
}

/* ── prompt ────────────────────────────────────────── */

const PROMPT_COLOR = '#8B6CC1';

function resolveResponseText(
  response: string,
  promptType: string,
  snapshot: any,
  getName: (pid: string) => string,
): string {
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

function PromptCompleted({ snapshot, roster, playerId }: { snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null }) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster[pid]?.avatarUrl;

  const promptType = snapshot.promptType;
  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const participantCount = snapshot.participantCount ?? (snapshot.playerResponses ? Object.keys(snapshot.playerResponses).length : 0);
  const totalPlayers = Object.keys(roster).length || participantCount;
  const isAnonymous = promptType === 'CONFESSION' || promptType === 'GUESS_WHO';
  const anonymousConfessions: { index: number; text: string }[] = snapshot.results?.anonymousConfessions ?? [];
  const selfReward = playerId ? rewards[playerId] : undefined;

  return (
    <>
      {/* Prompt text */}
      {snapshot.promptText && (
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: `${PROMPT_COLOR}08`,
          borderLeft: `3px solid ${PROMPT_COLOR}40`,
        }}>
          <p style={{
            margin: 0, fontFamily: 'var(--vivid-font-body)',
            fontSize: 13, lineHeight: 1.5, color: '#3D2E1F', fontStyle: 'italic',
          }}>
            &ldquo;{snapshot.promptText}&rdquo;
          </p>
        </div>
      )}

      {/* HOT_TAKE / WOULD_YOU_RATHER: stance bar */}
      {(promptType === 'HOT_TAKE' || promptType === 'WOULD_YOU_RATHER') && snapshot.results && (
        <StanceBar promptType={promptType} results={snapshot.results} />
      )}

      {/* Attributed player responses */}
      {snapshot.playerResponses && !isAnonymous && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(snapshot.playerResponses as Record<string, string>).map(([pid, response]) => {
            const isSelf = pid === playerId;
            const displayText = resolveResponseText(response, promptType, snapshot, getName);
            return (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <PersonaAvatar avatarUrl={getAvatar(pid)} personaName={getName(pid)} size={22} />
                <span style={{
                  fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 500,
                  color: '#3D2E1F', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 90,
                }}>
                  {getName(pid)}
                </span>
                {isSelf && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)', fontSize: 9, fontWeight: 800,
                    color: '#7B5DAF', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
                  }}>
                    (you)
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#7A6E60',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayText}
                </span>
                {rewards[pid] != null && rewards[pid] > 0 && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-mono)', fontSize: 11, fontWeight: 700,
                    color: '#B8840A', flexShrink: 0,
                  }}>
                    +{rewards[pid]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Anonymous confessions */}
      {isAnonymous && anonymousConfessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anonymousConfessions.map((c, i) => (
            <div key={c.index ?? i} style={{
              padding: '8px 10px', borderRadius: 8,
              background: `${PROMPT_COLOR}06`, border: `1px solid ${PROMPT_COLOR}10`,
            }}>
              <p style={{
                margin: 0, fontFamily: 'var(--vivid-font-body)',
                fontSize: 12, lineHeight: 1.5, color: '#3D2E1F', fontStyle: 'italic',
              }}>
                &ldquo;{c.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Participation count */}
      <div style={{
        fontFamily: 'var(--vivid-font-display)', fontSize: 10, fontWeight: 700,
        color: '#9B8E7E', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {participantCount} of {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} participated
      </div>

      {/* Self-highlight */}
      {playerId && (
        <SelfHighlight>
          {selfReward != null && selfReward > 0 ? (
            <>You earned <SelfHighlightLabel>{selfReward} silver</SelfHighlightLabel>.</>
          ) : snapshot.playerResponses?.[playerId] !== undefined ? (
            <>You participated.</>
          ) : null}
        </SelfHighlight>
      )}
    </>
  );
}

/** Agree/Disagree or Option A/B percentage bar */
function StanceBar({ promptType, results }: { promptType: string; results: any }) {
  if (promptType === 'HOT_TAKE') {
    const agree = results.agreeCount ?? 0;
    const disagree = results.disagreeCount ?? 0;
    const total = agree + disagree;
    if (total === 0) return null;
    const minority = results.minorityStance;
    return <DualBar leftLabel="Agree" rightLabel="Disagree" leftCount={agree} rightCount={disagree} leftColor="#4A9B5A" rightColor="#D04A35" highlight={minority === 'AGREE' ? 'left' : minority === 'DISAGREE' ? 'right' : null} />;
  }
  if (promptType === 'WOULD_YOU_RATHER') {
    const countA = results.countA ?? 0;
    const countB = results.countB ?? 0;
    const total = countA + countB;
    if (total === 0) return null;
    const minority = results.minorityChoice;
    const labelA = (results.optionA ?? 'Option A').slice(0, 25);
    const labelB = (results.optionB ?? 'Option B').slice(0, 25);
    return <DualBar leftLabel={labelA} rightLabel={labelB} leftCount={countA} rightCount={countB} leftColor="#3BA99C" rightColor="#CF864B" highlight={minority === 'A' ? 'left' : minority === 'B' ? 'right' : null} />;
  }
  return null;
}

function DualBar({ leftLabel, rightLabel, leftCount, rightCount, leftColor, rightColor, highlight }: {
  leftLabel: string; rightLabel: string;
  leftCount: number; rightCount: number;
  leftColor: string; rightColor: string;
  highlight: 'left' | 'right' | null;
}) {
  const total = leftCount + rightCount;
  const leftPct = total > 0 ? Math.round((leftCount / total) * 100) : 50;
  const rightPct = 100 - leftPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Bar */}
      <div style={{
        display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--vivid-border)',
      }}>
        <div style={{
          width: `${leftPct}%`, background: `${leftColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRight: '1px solid var(--vivid-border)',
        }}>
          <span style={{
            fontFamily: 'var(--vivid-font-mono)', fontSize: 11, fontWeight: 700,
            color: leftColor,
          }}>
            {leftPct}%
          </span>
        </div>
        <div style={{
          width: `${rightPct}%`, background: `${rightColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--vivid-font-mono)', fontSize: 11, fontWeight: 700,
            color: rightColor,
          }}>
            {rightPct}%
          </span>
        </div>
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 11,
          color: leftColor, fontWeight: highlight === 'left' ? 700 : 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '48%',
        }}>
          {leftLabel}
          {highlight === 'left' && (
            <span style={{
              fontFamily: 'var(--vivid-font-mono)', fontSize: 9, fontWeight: 800,
              color: '#B8840A', marginLeft: 4,
            }}>
              MINORITY
            </span>
          )}
        </span>
        <span style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 11,
          color: rightColor, fontWeight: highlight === 'right' ? 700 : 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '48%', textAlign: 'right',
        }}>
          {highlight === 'right' && (
            <span style={{
              fontFamily: 'var(--vivid-font-mono)', fontSize: 9, fontWeight: 800,
              color: '#B8840A', marginRight: 4,
            }}>
              MINORITY
            </span>
          )}
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

/* ── dilemma ──────────────────────────────────────── */

function DilemmaCompleted({ snapshot, roster, playerId }: { snapshot: any; roster: Record<string, RosterEntry>; playerId: string | null }) {
  const getName = (pid: string) => roster[pid]?.personaName ?? pid;
  const summary: Record<string, any> = snapshot.summary ?? {};
  const rewards: Record<string, number> = snapshot.silverRewards ?? {};
  const selfReward = playerId ? rewards[playerId] : undefined;

  // Timed out — universal fallback
  if (summary.timedOut) {
    return (
      <>
        <div style={{
          textAlign: 'center', padding: '12px 14px', borderRadius: 10,
          background: 'rgba(139, 115, 85, 0.06)', border: '1px solid rgba(139, 115, 85, 0.12)',
        }}>
          <div style={{
            fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 700, color: '#9B8E7E',
          }}>
            Time's up
          </div>
          <div style={{
            fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#9B8E7E', marginTop: 4,
          }}>
            Only {summary.submitted} of {summary.eligible} participated.
          </div>
        </div>
      </>
    );
  }

  let outcomeNode: React.ReactNode = null;

  if (snapshot.dilemmaType === 'SILVER_GAMBIT') {
    outcomeNode = summary.allDonated ? (
      <div style={{
        textAlign: 'center', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(45, 106, 79, 0.06)', border: '1px solid rgba(45, 106, 79, 0.15)',
      }}>
        <div style={{
          fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 700, color: '#2D6A4F',
        }}>
          Everyone donated!
        </div>
        {summary.winnerId && (
          <div style={{
            fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#3D2E1F', marginTop: 4,
          }}>
            <strong style={{ color: '#B8840A' }}>{getName(summary.winnerId)}</strong> wins {summary.jackpot} silver
          </div>
        )}
      </div>
    ) : (
      <div style={{
        textAlign: 'center', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(157, 23, 77, 0.06)', border: '1px solid rgba(157, 23, 77, 0.15)',
      }}>
        <div style={{
          fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 700, color: '#9D174D',
        }}>
          Someone defected...
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#9B8E7E', marginTop: 4,
        }}>
          {summary.donorCount} donated, {summary.keeperCount} kept. Donations lost!
        </div>
      </div>
    );
  } else if (snapshot.dilemmaType === 'SPOTLIGHT') {
    outcomeNode = summary.unanimous && summary.targetId ? (
      <div style={{
        textAlign: 'center', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(184, 132, 10, 0.06)', border: '1px solid rgba(184, 132, 10, 0.15)',
      }}>
        <div style={{
          fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 700, color: '#B8840A',
        }}>
          Unanimous!
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#3D2E1F', marginTop: 4,
        }}>
          <strong style={{ color: '#B8840A' }}>{getName(summary.targetId)}</strong> gets 20 silver
        </div>
      </div>
    ) : (
      <div style={{
        textAlign: 'center', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(139, 115, 85, 0.06)', border: '1px solid rgba(139, 115, 85, 0.12)',
      }}>
        <div style={{
          fontFamily: 'var(--vivid-font-display)', fontSize: 13, fontWeight: 700, color: '#9B8E7E',
        }}>
          No consensus
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#9B8E7E', marginTop: 4,
        }}>
          Picks were split — no bonus this time.
        </div>
      </div>
    );
  } else if (snapshot.dilemmaType === 'GIFT_OR_GRIEF') {
    const nominations: Record<string, number> = summary.nominations ?? {};
    const giftedIds: string[] = summary.giftedIds ?? [];
    const grievedIds: string[] = summary.grievedIds ?? [];
    const sorted = Object.entries(nominations).sort((a, b) => b[1] - a[1]);

    outcomeNode = sorted.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(([pid, count]) => {
          const isGifted = giftedIds.includes(pid);
          const isGrieved = grievedIds.includes(pid);
          return (
            <div key={pid} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: isGifted ? 'rgba(45, 106, 79, 0.05)' : isGrieved ? 'rgba(157, 23, 77, 0.05)' : 'rgba(139, 115, 85, 0.04)',
              border: `1px solid ${isGifted ? 'rgba(45, 106, 79, 0.15)' : isGrieved ? 'rgba(157, 23, 77, 0.15)' : 'rgba(139, 115, 85, 0.08)'}`,
            }}>
              <PersonaAvatar avatarUrl={roster[pid]?.avatarUrl} personaName={getName(pid)} size={22} />
              <span style={{
                fontFamily: 'var(--vivid-font-body)', fontSize: 12, fontWeight: 600,
                color: isGifted ? '#2D6A4F' : isGrieved ? '#9D174D' : '#3D2E1F', flex: 1,
              }}>
                {getName(pid)}
              </span>
              {isGifted && <SemanticLabel text="+10" color="#2D6A4F" />}
              {isGrieved && <SemanticLabel text="-10" color="#9D174D" />}
              <span style={{
                fontFamily: 'var(--vivid-font-mono)', fontSize: 11, fontWeight: 700, color: '#9B8E7E',
              }}>
                {count} {count === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          );
        })}
      </div>
    ) : null;
  }

  return (
    <>
      {outcomeNode}

      {/* Self-highlight */}
      {playerId && selfReward != null && selfReward !== 0 && (
        <SelfHighlight>
          You {selfReward > 0 ? 'earned' : 'lost'}{' '}
          <SelfHighlightLabel>{selfReward > 0 ? '+' : ''}{selfReward} silver</SelfHighlightLabel>.
        </SelfHighlight>
      )}
    </>
  );
}
