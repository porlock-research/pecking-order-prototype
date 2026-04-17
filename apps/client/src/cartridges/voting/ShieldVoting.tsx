import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT } from './shared/voting-tokens';

interface ShieldVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ShieldVoting({ cartridge, playerId, roster, engine }: ShieldVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  if (phase === VotingPhases.REVEAL) {
    const saveCounts: Record<string, number> = {};
    for (const targetId of Object.values(votes) as string[]) {
      saveCounts[targetId] = (saveCounts[targetId] || 0) + 1;
    }
    const revealSaves: Record<string, number> = results?.summary?.saveCounts ?? saveCounts;
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const eliminatedPlayer = eliminatedId ? roster[eliminatedId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        <VotingResultHero
          subjectPlayer={eliminatedPlayer}
          accent={accent}
          tone={info.mechanismTone}
          haloVariant="shield"
          subtitle={eliminatedId ? info.eliminatedSubtitle : info.noEliminationCopy}
          label={eliminatedId ? info.revealLabel : undefined}
        />
        <VotingTallyGrid
          tallies={revealSaves}
          roster={roster}
          accent={accent}
          eliminatedId={eliminatedId}
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
      {!canVote && <IneligibleNote reason="You're not in this round." />}
      <AvatarPicker
        eligibleTargets={eligibleTargets}
        roster={roster}
        disabled={!canVote}
        confirmedId={myVote}
        accentColor={accent}
        confirmLabel={info.confirmTemplate}
        actionVerb={info.actionVerb}
        onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.SHIELD.SAVE, targetId)}
      />
    </VotingShell>
  );
}
