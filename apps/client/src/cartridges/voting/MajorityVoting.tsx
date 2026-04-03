import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT = '#e2b865';

interface MajorityVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function MajorityVoting({ cartridge, playerId, roster, engine }: MajorityVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const canVote = eligibleVoters.includes(playerId);
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
        <div className="h-1 vote-strip-majority" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-center text-glow">
            VOTE RESULTS
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
                    <span className="font-mono font-bold text-sm bg-skin-gold/20 rounded-full px-2 min-w-[24px] text-center text-skin-gold">{count as number}</span>
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
      <div className="h-1 vote-strip-majority" />
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

        {!canVote && (
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
        )}

        {myVote && (
          <p
            data-testid="vote-confirmed"
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 9,
              color: '#9B8E7E',
              textAlign: 'center',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Vote locked in
          </p>
        )}

        <AvatarPicker
          eligibleTargets={eligibleTargets}
          roster={roster}
          disabled={!canVote}
          confirmedId={myVote}
          accentColor={ACCENT}
          confirmLabel={info.confirmTemplate}
          actionVerb={info.actionVerb}
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.MAJORITY.CAST, targetId)}
          testIdPrefix="vote-btn"
        />
      </div>
    </div>
  );
}
