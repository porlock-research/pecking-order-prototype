import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT = '#2d6a4f';

interface ShieldVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ShieldVoting({ cartridge, playerId, roster, engine }: ShieldVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const info = (VOTE_TYPE_INFO as Record<string, any>)[cartridge.voteType];
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  if (phase === VotingPhases.REVEAL) {
    const saveCounts: Record<string, number> = {};
    for (const targetId of Object.values(votes) as string[]) {
      saveCounts[targetId] = (saveCounts[targetId] || 0) + 1;
    }
    const revealSaves: Record<string, number> = results?.summary?.saveCounts ?? saveCounts;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-shield" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-pink uppercase tracking-widest text-center">
            THE SHIELD -- RESULTS
          </h3>

          <p className="text-[10px] font-mono text-skin-dim text-center uppercase">
            Fewest saves = eliminated
          </p>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(revealSaves)
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
                    <span className="font-mono font-bold text-sm bg-skin-pink/20 rounded-full px-2 min-w-[24px] text-center text-skin-pink">{count as number}</span>
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
      <div className="h-1 vote-strip-shield" />
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

        <AvatarPicker
          eligibleTargets={eligibleTargets}
          roster={roster}
          disabled={!canVote}
          confirmedId={myVote}
          accentColor={ACCENT}
          confirmLabel={info.confirmTemplate}
          actionVerb={info.actionVerb}
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.SHIELD.SAVE, targetId)}
        />
      </div>
    </div>
  );
}
