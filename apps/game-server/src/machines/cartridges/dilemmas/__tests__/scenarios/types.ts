/**
 * Shared Dilemma Scenario type definition.
 *
 * Design rule: every dilemma produces silverRewards for participants
 * and a type-specific summary object.
 */
export interface DilemmaScenario {
  name: string;
  dilemmaType: string;
  roster: Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }>;
  decisions: Record<string, any>; // playerId -> decision payload (type-specific)
  allSubmit: boolean; // true = all eligible submit, false = only those in decisions
  expected: {
    silverRewards: Record<string, number>;
    summary: Record<string, any>; // type-specific expected summary fields
  };
}
