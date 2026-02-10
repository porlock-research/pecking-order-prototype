/**
 * Voting Cartridge Contract
 *
 * Every voting machine must:
 * - Accept VotingCartridgeInput as input
 * - Handle VOTE.{MECHANISM}.* events and INTERNAL.CLOSE_VOTING
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
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: 'INTERNAL.CLOSE_VOTING' };
