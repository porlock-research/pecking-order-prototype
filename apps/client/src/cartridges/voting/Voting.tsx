import React from 'react';
import { VoteTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';
import MajorityVoting from './MajorityVoting';
import ExecutionerVoting from './ExecutionerVoting';
import BubbleVoting from './BubbleVoting';
import PodiumSacrificeVoting from './PodiumSacrificeVoting';
import SecondToLastVoting from './SecondToLastVoting';
import ShieldVoting from './ShieldVoting';
import TrustPairsVoting from './TrustPairsVoting';
import FinalsVoting from './FinalsVoting';

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

  switch (activeVotingCartridge.voteType) {
    case VoteTypes.MAJORITY:
      return <MajorityVoting {...common} />;
    case VoteTypes.EXECUTIONER:
      return <ExecutionerVoting {...common} />;
    case VoteTypes.BUBBLE:
      return <BubbleVoting {...common} />;
    case VoteTypes.PODIUM_SACRIFICE:
      return <PodiumSacrificeVoting {...common} />;
    case VoteTypes.SECOND_TO_LAST:
      return <SecondToLastVoting {...common} />;
    case VoteTypes.SHIELD:
      return <ShieldVoting {...common} />;
    case VoteTypes.TRUST_PAIRS:
      return <TrustPairsVoting {...common} />;
    case VoteTypes.FINALS:
      return <FinalsVoting {...common} />;
    default:
      return (
        <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base text-center">
          <span className="text-sm font-mono text-skin-muted">
            UNKNOWN_VOTE_TYPE: {activeVotingCartridge.voteType}
          </span>
        </div>
      );
  }
}
