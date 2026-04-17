import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT } from './shared/voting-tokens';
import { ImmuneRow } from './shared/ImmuneRow';

interface BubbleVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function BubbleVoting({ cartridge, playerId, roster, engine }: BubbleVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, immunePlayerIds } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
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
    const eliminatedPlayer = eliminatedId ? roster[eliminatedId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        <VotingResultHero
          subjectPlayer={eliminatedPlayer}
          accent={accent}
          tone={info.mechanismTone}
          haloVariant="burst"
          subtitle={eliminatedId ? info.eliminatedSubtitle : info.noEliminationCopy}
          label={eliminatedId ? info.revealLabel : undefined}
        />
        <VotingTallyGrid
          tallies={revealTallies}
          roster={roster}
          accent={accent}
          eliminatedId={eliminatedId}
          immuneIds={immune}
          unitLabel="saves"
          selfVotedFor={votes[playerId] ?? null}
        />
      </div>
    );
  }

  return (
    <VotingShell
      accentColor={accent}
      header={
        <VotingHeader
          mechanismName={info.name}
          moodSubtitle={info.moodSubtitle}
          cta={info.cta}
          howItWorks={info.howItWorks}
          accentColor={accent}
        />
      }
      engagement={
        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={votes}
          roster={roster}
          accentColor={accent}
          selfId={playerId}
        />
      }
    >
      {immunePlayerIds?.length > 0 && (
        <ImmuneRow ids={immunePlayerIds} roster={roster} />
      )}
      {!canVote && <IneligibleNote reason="You're not in this round." />}
      <AvatarPicker
        eligibleTargets={eligibleTargets}
        roster={roster}
        disabled={!canVote}
        confirmedId={myVote}
        accentColor={accent}
        confirmLabel={info.confirmTemplate}
        actionVerb={info.actionVerb}
        onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.BUBBLE.CAST, targetId)}
      />
    </VotingShell>
  );
}
