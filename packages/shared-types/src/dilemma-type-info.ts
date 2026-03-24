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
    howItWorks: 'If all players chose to donate five silver, one player will get 15 silver back.',
    header: 'Silver Gambit: Donate or Keep',
    cta: 'Do you trust everyone to donate?',
    actionVerb: 'decided',
  },
  SPOTLIGHT: {
    name: 'Spotlight',
    description: 'Blind unanimous pick',
    howItWorks: 'If you all agree on one person (in a blind submission) that person will get 20 silver.',
    header: 'Spotlight: Pick a Player',
    cta: 'Who does everyone agree on?',
    actionVerb: 'decided',
  },
  GIFT_OR_GRIEF: {
    name: 'Gift or Grief',
    description: 'Nominate for fortune or ruin',
    howItWorks: 'Write down any person but you. That person will get +10 silver or -10 at the end of the group chat.',
    header: 'Gift or Grief: Name a Player',
    cta: 'Who are you nominating?',
    actionVerb: 'decided',
  },
};
