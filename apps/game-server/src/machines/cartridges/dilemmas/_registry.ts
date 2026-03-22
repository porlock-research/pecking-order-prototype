import { silverGambitMachine } from './silver-gambit';
import { spotlightMachine } from './spotlight';
import { giftOrGriefMachine } from './gift-or-grief';

export const DILEMMA_REGISTRY = {
  SILVER_GAMBIT: silverGambitMachine,
  SPOTLIGHT: spotlightMachine,
  GIFT_OR_GRIEF: giftOrGriefMachine,
} as const;
