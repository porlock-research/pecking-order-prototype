import React from 'react';
import { useGameStore } from '../store/useGameStore';
import MajorityVoting from './MajorityVoting';
import ExecutionerVoting from './ExecutionerVoting';

interface VotingPanelProps {
  engine: {
    sendVote: (targetId: string) => void;
    sendExecutionerPick: (targetId: string) => void;
  };
}

export default function VotingPanel({ engine }: VotingPanelProps) {
  const activeCartridge = useGameStore((s) => s.activeCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);

  if (!activeCartridge) return null;

  const common = { cartridge: activeCartridge, playerId: playerId!, roster, engine };

  switch (activeCartridge.voteType) {
    case 'MAJORITY':
      return <MajorityVoting {...common} />;
    case 'EXECUTIONER':
      return <ExecutionerVoting {...common} />;
    default:
      return (
        <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base text-center">
          <span className="text-sm font-mono text-skin-muted">
            UNKNOWN_VOTE_TYPE: {activeCartridge.voteType}
          </span>
        </div>
      );
  }
}
