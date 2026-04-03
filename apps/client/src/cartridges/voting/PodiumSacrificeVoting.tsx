import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT = '#b8840a';

interface PodiumSacrificeVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function PodiumSacrificeVoting({ cartridge, playerId, roster, engine }: PodiumSacrificeVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, podiumPlayerIds } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const canVote = eligibleVoters.includes(playerId);
  const isOnPodium = podiumPlayerIds?.includes(playerId);
  const myVote = votes[playerId] ?? null;

  if (phase === VotingPhases.REVEAL) {
    const tallies: Record<string, number> = {};
    for (const targetId of Object.values(votes) as string[]) {
      tallies[targetId] = (tallies[targetId] || 0) + 1;
    }
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-podium" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-orange uppercase tracking-widest text-center">
            PODIUM SACRIFICE -- RESULTS
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(revealTallies)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([targetId, count]) => {
                const player = roster[targetId];
                const isEliminated = targetId === eliminatedId;
                return (
                  <div
                    key={targetId}
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isEliminated
                        ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
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
                    <span className="font-mono font-bold text-sm bg-skin-orange/20 rounded-full px-2 min-w-[24px] text-center text-skin-orange">{count as number}</span>
                  </div>
                );
              })}
          </div>

          {!eliminatedId && (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase
  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-podium" />
      <div className="p-4 space-y-3">
        <VotingHeader
          header={info.header}
          cta={info.cta}
          oneLiner={info.oneLiner}
          howItWorks={info.howItWorks}
          accentColor={ACCENT}
        />

        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={votes}
          roster={roster}
        />

        {/* Podium players display — prominent badges above picker */}
        {podiumPlayerIds?.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {podiumPlayerIds.map((id: string, i: number) => {
              const player = roster[id];
              const isPodiumMe = id === playerId;
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: isPodiumMe
                      ? '1px solid rgba(184,132,10,0.4)'
                      : '1px solid rgba(184,132,10,0.2)',
                    background: isPodiumMe
                      ? 'rgba(184,132,10,0.1)'
                      : 'rgba(184,132,10,0.05)',
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-mono)',
                      fontSize: 10,
                      color: ACCENT,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={20} />
                  <span
                    style={{
                      fontWeight: 600,
                      color: isPodiumMe ? ACCENT : '#f5f0e8',
                    }}
                  >
                    {player?.personaName || id}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isOnPodium ? (
          <div
            style={{
              textAlign: 'center',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(184,132,10,0.1)',
              border: '1px solid rgba(184,132,10,0.2)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                color: ACCENT,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              You're on the podium -- you cannot vote
            </p>
          </div>
        ) : !canVote ? (
          <p
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 11,
              color: '#9B8E7E',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            You are not eligible to vote
          </p>
        ) : null}

        <AvatarPicker
          eligibleTargets={eligibleTargets}
          roster={roster}
          disabled={!canVote}
          confirmedId={myVote}
          accentColor={ACCENT}
          confirmLabel={info.confirmTemplate}
          actionVerb={info.actionVerb}
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.PODIUM_SACRIFICE.CAST, targetId)}
        />
      </div>
    </div>
  );
}
