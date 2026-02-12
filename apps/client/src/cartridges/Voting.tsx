import React from 'react';
import { useGameStore } from '../store/useGameStore';
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
    case 'MAJORITY':
      return <MajorityVoting {...common} />;
    case 'EXECUTIONER':
      return <ExecutionerVoting {...common} />;
    case 'BUBBLE':
      return <BubbleVoting {...common} />;
    case 'PODIUM_SACRIFICE':
      return <PodiumSacrificeVoting {...common} />;
    case 'SECOND_TO_LAST':
      return <SecondToLastVoting {...common} />;
    case 'SHIELD':
      return <ShieldVoting {...common} />;
    case 'TRUST_PAIRS':
      return <TrustPairsVoting {...common} />;
    case 'FINALS':
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
