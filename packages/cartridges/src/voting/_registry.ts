import type { AnyStateMachine } from 'xstate';
import type { VoteType } from '@pecking-order/shared-types';
import { majorityMachine } from './majority-machine';
import { executionerMachine } from './executioner-machine';
import { bubbleMachine } from './bubble-machine';
import { podiumSacrificeMachine } from './podium-sacrifice-machine';
import { secondToLastMachine } from './second-to-last-machine';
import { shieldMachine } from './shield-machine';
import { trustPairsMachine } from './trust-pairs-machine';
import { finalsMachine } from './finals-machine';

// Typed as Record<Exclude<VoteType, 'DUELS'>, AnyStateMachine> so the .d.ts
// emit doesn't need to surface each machine's private context type (TS4023).
// DUELS is in the VoteType union but not implemented yet.
export const VOTE_REGISTRY: Record<Exclude<VoteType, 'DUELS'>, AnyStateMachine> = {
  MAJORITY: majorityMachine,
  EXECUTIONER: executionerMachine,
  BUBBLE: bubbleMachine,
  PODIUM_SACRIFICE: podiumSacrificeMachine,
  SECOND_TO_LAST: secondToLastMachine,
  SHIELD: shieldMachine,
  TRUST_PAIRS: trustPairsMachine,
  FINALS: finalsMachine,
};
