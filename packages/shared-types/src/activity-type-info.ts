/**
 * Activity (prompt) type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain activity mechanics to players.
 *
 * `promptText` is the player-facing question shown during the activity.
 * `options` provides WYR-style option pairs where applicable.
 * Both lobby (static games) and game-master (dynamic games) use these
 * as the canonical source for activity content.
 */
import type { PromptType } from './index';

export interface ActivityTypeInfo {
  name: string;
  description: string;
  promptText: string;
  options?: { optionA: string; optionB: string };
}

export const ACTIVITY_TYPE_INFO: Record<PromptType, ActivityTypeInfo> = {
  PLAYER_PICK:       { name: 'Player Pick',       description: 'Pick a player for a scenario',       promptText: 'Pick your bestie' },
  PREDICTION:        { name: 'Prediction',        description: 'Predict what happens next',          promptText: 'Who do you think will be eliminated tonight?' },
  WOULD_YOU_RATHER:  { name: 'Would You Rather',  description: 'Choose between two options',         promptText: 'Would you rather...', options: { optionA: 'Have immunity for one round', optionB: 'Get 50 bonus silver' } },
  HOT_TAKE:          { name: 'Hot Take',          description: 'Share a controversial opinion',      promptText: 'Hot take' },
  CONFESSION:        { name: 'Confession',        description: 'Reveal something about yourself',    promptText: 'Confess something about your game strategy' },
  GUESS_WHO:         { name: 'Guess Who',         description: 'Figure out who said what',           promptText: 'What is your biggest fear in this game?' },
};
