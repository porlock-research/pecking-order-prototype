import { majorityMachine } from './majority-machine';
import { executionerMachine } from './executioner-machine';
import { bubbleMachine } from './bubble-machine';
import { podiumSacrificeMachine } from './podium-sacrifice-machine';
import { secondToLastMachine } from './second-to-last-machine';
import { shieldMachine } from './shield-machine';
import { trustPairsMachine } from './trust-pairs-machine';
import { finalsMachine } from './finals-machine';

export const VOTE_REGISTRY = {
  MAJORITY: majorityMachine,
  EXECUTIONER: executionerMachine,
  BUBBLE: bubbleMachine,
  PODIUM_SACRIFICE: podiumSacrificeMachine,
  SECOND_TO_LAST: secondToLastMachine,
  SHIELD: shieldMachine,
  TRUST_PAIRS: trustPairsMachine,
  FINALS: finalsMachine,
  // Future: DUELS (needs minigame system)
} as const;
