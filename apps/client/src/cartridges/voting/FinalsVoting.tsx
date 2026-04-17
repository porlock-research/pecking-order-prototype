import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { Crown } from 'lucide-react';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT } from './shared/voting-tokens';

interface FinalsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function FinalsVoting({ cartridge, playerId, roster, engine }: FinalsVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
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
    const winnerPlayer = winnerId ? roster[winnerId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        <VotingResultHero
          subjectPlayer={winnerPlayer}
          accent={accent}
          tone="celebratory"
          haloVariant="crown"
          subtitle={info.winnerSubtitle ?? 'Winner'}
          label="Crowned"
          Icon={Crown}
          portraitSize={128}
        />
        <VotingTallyGrid
          tallies={voteCounts}
          roster={roster}
          accent={accent}
          winnerId={winnerId}
          unitLabel="votes"
        />
      </div>
    );
  }

  // VOTING phase
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
      {isFinalist ? (
        <IneligibleNote reason="You're a finalist — the others vote on you." />
      ) : !canVote ? (
        <IneligibleNote reason="You're not in this round." />
      ) : null}
      <AvatarPicker
        eligibleTargets={eligibleTargets}
        roster={roster}
        disabled={!canVote || isFinalist}
        confirmedId={myVote}
        accentColor={accent}
        confirmLabel={info.confirmTemplate}
        actionVerb={info.actionVerb}
        onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.FINALS.CAST, targetId)}
        testIdPrefix="vote-btn"
      />
    </VotingShell>
  );
}
