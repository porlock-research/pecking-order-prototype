import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT } from './shared/voting-tokens';
import { PodiumRow } from './shared/PodiumRow';

interface PodiumSacrificeVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function PodiumSacrificeVoting({
  cartridge,
  playerId,
  roster,
  engine,
}: PodiumSacrificeVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, podiumPlayerIds } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
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
    const eliminatedPlayer = eliminatedId ? roster[eliminatedId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        <VotingResultHero
          subjectPlayer={eliminatedPlayer}
          accent={accent}
          tone={info.mechanismTone}
          haloVariant="frame"
          subtitle={eliminatedId ? info.eliminatedSubtitle : info.noEliminationCopy}
          label={eliminatedId ? 'Sacrificed' : undefined}
        />
        <VotingTallyGrid
          tallies={revealTallies}
          roster={roster}
          accent={accent}
          eliminatedId={eliminatedId}
          unitLabel="saves"
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
      {podiumPlayerIds?.length > 0 && (
        <PodiumRow ids={podiumPlayerIds} roster={roster} selfId={playerId} />
      )}
      {isOnPodium ? (
        <IneligibleNote reason="You're on the podium — you can't vote on yourself." />
      ) : !canVote ? (
        <IneligibleNote reason="You're not in this round." />
      ) : null}
      <AvatarPicker
        eligibleTargets={eligibleTargets}
        roster={roster}
        disabled={!canVote}
        confirmedId={myVote}
        accentColor={accent}
        confirmLabel={info.confirmTemplate}
        actionVerb={info.actionVerb}
        onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.PODIUM_SACRIFICE.CAST, targetId)}
      />
    </VotingShell>
  );
}
