import React, { Suspense } from 'react';
import { VoteTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';

const VOTING_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  [VoteTypes.MAJORITY]: React.lazy(() => import('../../cartridges/voting/MajorityVoting')),
  [VoteTypes.EXECUTIONER]: React.lazy(() => import('../../cartridges/voting/ExecutionerVoting')),
  [VoteTypes.BUBBLE]: React.lazy(() => import('../../cartridges/voting/BubbleVoting')),
  [VoteTypes.PODIUM_SACRIFICE]: React.lazy(() => import('../../cartridges/voting/PodiumSacrificeVoting')),
  [VoteTypes.SECOND_TO_LAST]: React.lazy(() => import('../../cartridges/voting/SecondToLastVoting')),
  [VoteTypes.SHIELD]: React.lazy(() => import('../../cartridges/voting/ShieldVoting')),
  [VoteTypes.TRUST_PAIRS]: React.lazy(() => import('../../cartridges/voting/TrustPairsVoting')),
  [VoteTypes.FINALS]: React.lazy(() => import('../../cartridges/voting/FinalsVoting')),
};

interface VotingPanelProps {
  engine: {
    sendVoteAction: (type: string, targetId: string) => void;
  };
}

export default function VotingPanel({ engine }: VotingPanelProps) {
  const activeVotingCartridge = useGameStore((s) => s.activeVotingCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);

  if (!activeVotingCartridge) return null;

  const common = { cartridge: activeVotingCartridge, playerId: playerId!, roster, engine };
  const Component = VOTING_COMPONENTS[activeVotingCartridge.voteType];

  if (!Component) {
    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base text-center">
        <span className="text-sm font-mono text-skin-muted">
          UNKNOWN_VOTE_TYPE: {activeVotingCartridge.voteType}
        </span>
      </div>
    );
  }

  return (
    <div data-testid="voting-panel">
      <Suspense fallback={null}>
        <Component {...common} />
      </Suspense>
    </div>
  );
}
