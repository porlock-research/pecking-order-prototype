import type { AnyStateMachine } from 'xstate';
import type { DilemmaType } from '@pecking-order/shared-types';
import { silverGambitMachine } from './silver-gambit';
import { spotlightMachine } from './spotlight';
import { giftOrGriefMachine } from './gift-or-grief';

// Typed as Record<DilemmaType, AnyStateMachine> so the .d.ts emit doesn't need
// to surface each machine's private context type (TS4023).
export const DILEMMA_REGISTRY: Record<DilemmaType, AnyStateMachine> = {
  SILVER_GAMBIT: silverGambitMachine,
  SPOTLIGHT: spotlightMachine,
  GIFT_OR_GRIEF: giftOrGriefMachine,
};
