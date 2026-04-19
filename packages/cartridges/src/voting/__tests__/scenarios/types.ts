/**
 * Shared Voting Scenario type definition.
 *
 * Design rule: every voting mechanism MUST always eliminate exactly one player.
 * Fallback is always lowest-silver when there's no participation.
 */
export interface VotingScenario {
  name: string;
  mechanism: string;
  roster: Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }>;
  /** Standard single-phase votes: voterId -> targetId */
  votes?: Record<string, string>;
  /** Executioner election votes */
  phase1Votes?: Record<string, string>;
  /** Executioner pick action */
  phase2Action?: { actorId: string; targetId: string };
  /** Trust Pairs: trust slot */
  trustPicks?: Record<string, string>;
  /** Trust Pairs: eliminate slot */
  eliminatePicks?: Record<string, string>;
  expected: {
    eliminatedId: string;
    immune?: string[];
    winnerId?: string;
    reason?: string;
    executionerId?: string | null;
  };
}
