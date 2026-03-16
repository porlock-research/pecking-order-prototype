/**
 * Activity (prompt) type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain activity mechanics to players.
 */
import type { PromptType } from './index';

export interface ActivityTypeInfo {
  name: string;
  description: string;
}

export const ACTIVITY_TYPE_INFO: Record<PromptType, ActivityTypeInfo> = {
  PLAYER_PICK:       { name: 'Player Pick',       description: 'Pick a player for a scenario' },
  PREDICTION:        { name: 'Prediction',        description: 'Predict what happens next' },
  WOULD_YOU_RATHER:  { name: 'Would You Rather',  description: 'Choose between two options' },
  HOT_TAKE:          { name: 'Hot Take',          description: 'Share a controversial opinion' },
  CONFESSION:        { name: 'Confession',        description: 'Reveal something about yourself' },
  GUESS_WHO:         { name: 'Guess Who',         description: 'Figure out who said what' },
};
