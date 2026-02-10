/**
 * Voting Cartridge Contract
 *
 * Every voting machine must:
 * - Accept VotingCartridgeInput as input
 * - Handle GAME.VOTE, INTERNAL.CLOSE_VOTING (and optionally GAME.EXECUTIONER_PICK)
 * - Emit VOTE_CAST facts via sendParent on each valid vote
 * - Emit GAME_RESULT fact via sendParent on completion
 * - Return VoteResult as output from final state
 * - Expose context matching BaseVoteContext for SYSTEM.SYNC rendering
 */
import type { VoteType, VotingPhase, VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';

export type { VoteType, VotingPhase, VoteResult, VotingCartridgeInput };

export interface BaseVoteContext {
  voteType: VoteType;
  phase: VotingPhase;
  eligibleVoters: string[];
  eligibleTargets: string[];
  votes: Record<string, string>;
  results: VoteResult | null;
}

export type VoteEvent =
  | { type: 'GAME.VOTE'; senderId: string; targetId: string; slot?: string }
  | { type: 'GAME.EXECUTIONER_PICK'; senderId: string; targetId: string }
  | { type: 'INTERNAL.CLOSE_VOTING' };
