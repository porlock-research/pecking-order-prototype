import React from 'react';
import { VoteTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';
import MajorityVoting from '../../cartridges/voting/MajorityVoting';
import ExecutionerVoting from '../../cartridges/voting/ExecutionerVoting';
import BubbleVoting from '../../cartridges/voting/BubbleVoting';
import PodiumSacrificeVoting from '../../cartridges/voting/PodiumSacrificeVoting';
import SecondToLastVoting from '../../cartridges/voting/SecondToLastVoting';
import ShieldVoting from '../../cartridges/voting/ShieldVoting';
import TrustPairsVoting from '../../cartridges/voting/TrustPairsVoting';
import FinalsVoting from '../../cartridges/voting/FinalsVoting';

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

  let panel: React.ReactNode;
  switch (activeVotingCartridge.voteType) {
    case VoteTypes.MAJORITY:
      panel = <MajorityVoting {...common} />; break;
    case VoteTypes.EXECUTIONER:
      panel = <ExecutionerVoting {...common} />; break;
    case VoteTypes.BUBBLE:
      panel = <BubbleVoting {...common} />; break;
    case VoteTypes.PODIUM_SACRIFICE:
      panel = <PodiumSacrificeVoting {...common} />; break;
    case VoteTypes.SECOND_TO_LAST:
      panel = <SecondToLastVoting {...common} />; break;
    case VoteTypes.SHIELD:
      panel = <ShieldVoting {...common} />; break;
    case VoteTypes.TRUST_PAIRS:
      panel = <TrustPairsVoting {...common} />; break;
    case VoteTypes.FINALS:
      panel = <FinalsVoting {...common} />; break;
    default:
      panel = (
        <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base text-center">
          <span className="text-sm font-mono text-skin-muted">
            UNKNOWN_VOTE_TYPE: {activeVotingCartridge.voteType}
          </span>
        </div>
      );
  }

  return <div data-testid="voting-panel">{panel}</div>;
}
