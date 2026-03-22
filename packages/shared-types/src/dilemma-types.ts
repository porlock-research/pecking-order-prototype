import { z } from 'zod';
import type { SocialPlayer } from './index';

export const DilemmaTypeSchema = z.enum([
  'SILVER_GAMBIT',
  'SPOTLIGHT',
  'GIFT_OR_GRIEF',
]);
export type DilemmaType = z.infer<typeof DilemmaTypeSchema>;

export interface DilemmaCartridgeInput {
  dilemmaType: DilemmaType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

export interface DilemmaOutput {
  silverRewards: Record<string, number>;
  dilemmaType: DilemmaType;
  summary: Record<string, any>;
}
