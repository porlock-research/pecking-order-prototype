import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { Trophy } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT = '#e2b865';

interface FinalsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function FinalsVoting({ cartridge, playerId, roster, engine }: FinalsVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const info = (VOTE_TYPE_INFO as Record<string, any>)[cartridge.voteType];
  const canVote = eligibleVoters.includes(playerId);
  const isFinalist = eligibleTargets.includes(playerId);
  const myVote = votes[playerId] ?? null;

  if (phase === VotingPhases.WINNER) {
    const tallies: Record<string, number> = {};
    for (const targetId of Object.values(votes) as string[]) {
      tallies[targetId] = (tallies[targetId] || 0) + 1;
    }
    const voteCounts: Record<string, number> = results?.summary?.voteCounts ?? tallies;
    const winnerId: string | null = results?.winnerId ?? null;
    const winnerPlayer = winnerId ? roster[winnerId] : null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-center text-glow">
            THE WINNER
          </h3>

          {winnerPlayer && (
            <div className="flex flex-col items-center gap-2 py-3">
              <PersonaAvatar avatarUrl={winnerPlayer.avatarUrl} personaName={winnerPlayer.personaName} size={64} className="ring-2 ring-skin-gold" />
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-bold text-skin-gold">{winnerPlayer.personaName}</span>
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(voteCounts)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([targetId, count]) => {
                const player = roster[targetId];
                const isWinner = targetId === winnerId;
                return (
                  <div
                    key={targetId}
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isWinner
                        ? 'border border-skin-gold bg-skin-gold/20'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isWinner ? 'text-skin-gold' : 'text-skin-base'}`}>
                        {player?.personaName || targetId}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm bg-skin-gold/20 rounded-full px-2 min-w-[24px] text-center text-skin-gold">{count as number}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // VOTING phase
  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
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

        {isFinalist ? (
          <p
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 11,
              color: ACCENT,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            You are a finalist
          </p>
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
          disabled={!canVote || isFinalist}
          confirmedId={myVote}
          accentColor={ACCENT}
          confirmLabel={info.confirmTemplate}
          actionVerb={info.actionVerb}
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.FINALS.CAST, targetId)}
          testIdPrefix="vote-btn"
        />
      </div>
    </div>
  );
}
