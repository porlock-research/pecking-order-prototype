import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT = '#3b82f6';

interface BubbleVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function BubbleVoting({ cartridge, playerId, roster, engine }: BubbleVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, immunePlayerIds } = cartridge;
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
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-bubble" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-info uppercase tracking-widest text-center">
            THE BUBBLE -- RESULTS
          </h3>

          {immune.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Immune (Top 3 Silver)</p>
              <div className="flex justify-center gap-2">
                {immune.map((id: string) => {
                  const player = roster[id];
                  return (
                    <div key={id} className="flex items-center gap-1 p-1.5 rounded-lg border border-skin-info/30 bg-skin-info/10 text-xs animate-badge-pop">
                      <span className="font-mono text-skin-info text-[10px]">[*]</span>
                      <span className="text-skin-info font-bold">{player?.personaName || id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    <span className="font-mono font-bold text-sm bg-skin-info/20 rounded-full px-2 min-w-[24px] text-center text-skin-info">{count as number}</span>
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
      <div className="h-1 vote-strip-bubble" />
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

        {/* Immune player badges (Top 3 silver) — shown above the picker */}
        {immunePlayerIds?.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {immunePlayerIds.map((id: string) => {
              const player = roster[id];
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(59,130,246,0.3)',
                    background: 'rgba(59,130,246,0.08)',
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 11,
                  }}
                >
                  <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={18} />
                  <span style={{ color: ACCENT, fontWeight: 600 }}>{player?.personaName || id}</span>
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-mono)',
                      fontSize: 9,
                      color: ACCENT,
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    immune
                  </span>
                </div>
              );
            })}
          </div>
        )}

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
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.BUBBLE.CAST, targetId)}
        />
      </div>
    </div>
  );
}
