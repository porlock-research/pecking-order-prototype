import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';

const ACCENT = '#6b5b95';
const TRUST_COLOR = '#2d6a4f';
const BETRAY_COLOR = '#dc2626';

interface TrustPairsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function TrustPairsVoting({ cartridge, playerId, roster, engine }: TrustPairsVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    votes,
    results,
    trustPicks,
    votePicks,
    mutualPairs,
    immunePlayerIds,
  } = cartridge;

  const info = (VOTE_TYPE_INFO as Record<string, any>)[cartridge.voteType];
  const canVote = eligibleVoters.includes(playerId);
  const myTrust = trustPicks?.[playerId] ?? null;
  const myEliminate = votePicks?.[playerId] ?? null;

  if (phase === VotingPhases.REVEAL) {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? {};
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const pairs: string[][] = results?.summary?.mutualPairs ?? mutualPairs ?? [];
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-trust" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-green uppercase tracking-widest text-center">
            TRUST PAIRS -- RESULTS
          </h3>

          {pairs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Mutual Trust = Immune</p>
              {pairs.map((pair: string[], i: number) => {
                const a = roster[pair[0]];
                const b = roster[pair[1]];
                return (
                  <div key={i} className="flex items-center justify-center gap-2 p-2 rounded-xl border border-skin-green/30 bg-skin-green/10 animate-badge-pop">
                    <PersonaAvatar avatarUrl={a?.avatarUrl} personaName={a?.personaName} size={28} />
                    <span className="text-xs font-bold text-skin-green">{a?.personaName || pair[0]}</span>
                    <span className="text-xs font-mono text-skin-dim">+</span>
                    <PersonaAvatar avatarUrl={b?.avatarUrl} personaName={b?.personaName} size={28} />
                    <span className="text-xs font-bold text-skin-green">{b?.personaName || pair[1]}</span>
                    <span className="text-[10px] font-mono bg-skin-green/20 text-skin-green px-2 py-0.5 rounded-full uppercase ml-1">immune</span>
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(revealTallies).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(revealTallies)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([targetId, count]) => {
                  const player = roster[targetId];
                  const isEliminated = targetId === eliminatedId;
                  const isImmune = immune.includes(targetId);
                  return (
                    <div
                      key={targetId}
                      className={`flex items-center gap-2 p-2 rounded-xl ${
                        isEliminated
                          ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                          : isImmune
                            ? 'border border-skin-green/30 bg-skin-green/10 opacity-60'
                            : 'bg-skin-deep/40 border border-white/[0.06]'
                      }`}
                    >
                      <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                          {player?.personaName || targetId}
                        </div>
                        {isEliminated && (
                          <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm bg-skin-green/20 rounded-full px-2 min-w-[24px] text-center text-skin-green">{count as number}</span>
                    </div>
                  );
                })}
            </div>
          )}

          {!eliminatedId && (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase -- binary trust/betray choices
  const otherPlayers = eligibleTargets?.filter((id: string) => id !== playerId) ?? [];

  // Build a combined votes object for VoterStrip: a voter has "voted" if they have both picks
  const combinedVotes: Record<string, string> = {};
  for (const voterId of eligibleVoters) {
    if (trustPicks?.[voterId] && votePicks?.[voterId]) {
      combinedVotes[voterId] = 'done';
    }
  }

  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-trust" />
      <div className="p-4 space-y-4">
        <VotingHeader
          header={info.header}
          cta={info.cta}
          oneLiner={info.oneLiner}
          howItWorks={info.howItWorks}
          accentColor={ACCENT}
        />

        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={combinedVotes}
          roster={roster}
        />

        {/* Section 1: Trust — pick one partner to trust */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRUST_COLOR }} />
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                fontWeight: 700,
                color: TRUST_COLOR,
                textTransform: 'uppercase',
              }}
            >
              Choose Your Trust Buddy
            </span>
          </div>

          {myTrust && (
            <p
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 10,
                color: TRUST_COLOR,
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            >
              Trusted: {roster[myTrust]?.personaName || myTrust}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {otherPlayers.map((targetId: string) => {
              const player = roster[targetId];
              const isSelected = myTrust === targetId;
              const isDisabled = !!myTrust || !canVote;
              const isDimmed = isDisabled && !isSelected;
              const firstName = player?.personaName?.split(' ')[0] ?? targetId;

              return (
                <div
                  key={`trust-${targetId}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    opacity: isDimmed ? 0.3 : 1,
                    filter: isDimmed ? 'grayscale(40%)' : undefined,
                    transition: 'opacity 0.2s, filter 0.2s',
                  }}
                >
                  <button
                    disabled={isDisabled}
                    onClick={() => engine.sendVoteAction(VoteEvents.TRUST_PAIRS.TRUST, targetId)}
                    style={{
                      background: 'none',
                      padding: 0,
                      cursor: isDisabled ? 'default' : 'pointer',
                      border: isSelected
                        ? `3px solid ${TRUST_COLOR}`
                        : '3px solid rgba(255,255,255,0.1)',
                      borderRadius: '50%',
                      boxShadow: isSelected ? `0 0 12px ${TRUST_COLOR}40` : undefined,
                      transition: 'border 0.2s, box-shadow 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={48} />
                  </button>
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-body)',
                      fontSize: 11,
                      fontWeight: 500,
                      color: isSelected ? TRUST_COLOR : '#f5f0e8',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {firstName}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 9,
                        color: TRUST_COLOR,
                        textTransform: 'uppercase',
                      }}
                    >
                      Trusted
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 10,
              color: '#9B8E7E',
              textTransform: 'uppercase',
            }}
          >
            vs
          </span>
          <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
        </div>

        {/* Section 2: Eliminate — pick one partner to betray */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: BETRAY_COLOR }} />
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                fontWeight: 700,
                color: BETRAY_COLOR,
                textTransform: 'uppercase',
              }}
            >
              Vote to Eliminate
            </span>
          </div>

          {myEliminate && (
            <p
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 10,
                color: BETRAY_COLOR,
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            >
              Targeting: {roster[myEliminate]?.personaName || myEliminate}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {eligibleTargets?.map((targetId: string) => {
              const player = roster[targetId];
              const isSelected = myEliminate === targetId;
              const isDisabled = !!myEliminate || !canVote;
              const isDimmed = isDisabled && !isSelected;
              const firstName = player?.personaName?.split(' ')[0] ?? targetId;

              return (
                <div
                  key={`elim-${targetId}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    opacity: isDimmed ? 0.3 : 1,
                    filter: isDimmed ? 'grayscale(40%)' : undefined,
                    transition: 'opacity 0.2s, filter 0.2s',
                  }}
                >
                  <button
                    disabled={isDisabled}
                    onClick={() => engine.sendVoteAction(VoteEvents.TRUST_PAIRS.ELIMINATE, targetId)}
                    style={{
                      background: 'none',
                      padding: 0,
                      cursor: isDisabled ? 'default' : 'pointer',
                      border: isSelected
                        ? `3px solid ${BETRAY_COLOR}`
                        : '3px solid rgba(255,255,255,0.1)',
                      borderRadius: '50%',
                      boxShadow: isSelected ? `0 0 12px ${BETRAY_COLOR}40` : undefined,
                      transition: 'border 0.2s, box-shadow 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={48} />
                  </button>
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-body)',
                      fontSize: 11,
                      fontWeight: 500,
                      color: isSelected ? BETRAY_COLOR : '#f5f0e8',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {firstName}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 9,
                        color: BETRAY_COLOR,
                        textTransform: 'uppercase',
                      }}
                    >
                      Eliminated
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status summary */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            fontFamily: 'var(--vivid-font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 10,
              background: myTrust ? 'rgba(45,106,79,0.15)' : 'rgba(255,255,255,0.04)',
              color: myTrust ? TRUST_COLOR : '#9B8E7E',
            }}
          >
            Trust {myTrust ? '\u2713' : '--'}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 10,
              background: myEliminate ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
              color: myEliminate ? BETRAY_COLOR : '#9B8E7E',
            }}
          >
            Eliminate {myEliminate ? '\u2713' : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
