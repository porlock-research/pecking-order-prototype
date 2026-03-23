import type { DilemmaType } from './dilemma-types';

export interface DilemmaTypeInfo {
  name: string;
  description: string;
  howItWorks: string;
  header: string;
  cta: string;
  actionVerb: string;
}

export const DILEMMA_TYPE_INFO: Record<DilemmaType, DilemmaTypeInfo> = {
  SILVER_GAMBIT: {
    name: 'Silver Gambit',
    description: 'All-or-nothing donation gamble',
    howItWorks: 'Each player secretly chooses to donate 5 silver or keep it. If everyone donates, one lucky player wins the jackpot. If anyone keeps their silver, donors lose their donation.',
    header: 'Silver Gambit: Donate or Keep',
    cta: 'Do you trust everyone to donate?',
    actionVerb: 'donated',
  },
  SPOTLIGHT: {
    name: 'Spotlight',
    description: 'Blind unanimous pick',
    howItWorks: 'Every player secretly picks one person. If everyone picks the same player, that player gets 20 silver. Can you coordinate without talking?',
    header: 'Spotlight: Pick a Player',
    cta: 'Who does everyone agree on?',
    actionVerb: 'picked',
  },
  GIFT_OR_GRIEF: {
    name: 'Gift or Grief',
    description: 'Nominate for fortune or ruin',
    howItWorks: 'Name one player. The most-nominated gets +10 silver (a gift!). The least-nominated gets -10 silver (grief!). Choose wisely.',
    header: 'Gift or Grief: Name a Player',
    cta: 'Who are you nominating?',
    actionVerb: 'nominated',
  },
};
