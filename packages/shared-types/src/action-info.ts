/**
 * Timeline action descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain game mechanics to players.
 * Template tokens like {silverCost} are resolved via renderActionInfo().
 */
import { Config } from './config';

export interface ActionInfo {
  name: string;
  description: string;
  howItWorks: string;
}

export const ACTION_INFO: Record<string, ActionInfo> = {
  OPEN_DMS: {
    name: 'DMs Open',
    description: 'Private messaging is now available.',
    howItWorks:
      'Send private messages to other players. Each message costs {silverCost} silver.',
  },
  CLOSE_DMS: {
    name: 'DMs Close',
    description: 'Private messaging is now closed.',
    howItWorks: 'Private messaging has closed for the day.',
  },
  OPEN_GROUP_CHAT: {
    name: 'Group Chat Opens',
    description: 'The main group chat is open.',
    howItWorks:
      'The main group chat is open. Everyone can see these messages.',
  },
  CLOSE_GROUP_CHAT: {
    name: 'Group Chat Closes',
    description: 'The group chat has closed.',
    howItWorks: 'The group chat has closed for the day.',
  },
  OPEN_VOTING: {
    name: 'Voting Opens',
    description: 'Cast your vote.',
    howItWorks: 'Cast your vote. Details depend on the vote type.',
  },
  CLOSE_VOTING: {
    name: 'Voting Closes',
    description: 'Voting has ended.',
    howItWorks: 'The votes have been counted.',
  },
  START_GAME: {
    name: 'Mini-Game',
    description: 'A mini-game is starting.',
    howItWorks:
      'Play the mini-game to earn silver. Silver breaks vote ties and unlocks perks.',
  },
  END_GAME: {
    name: 'Game Over',
    description: 'The mini-game has ended.',
    howItWorks: 'Check the results to see how you placed.',
  },
  START_ACTIVITY: {
    name: 'Activity',
    description: 'An activity is starting.',
    howItWorks:
      'Answer the prompt to reveal your personality and earn silver.',
  },
  END_ACTIVITY: {
    name: 'Activity Ends',
    description: 'The activity has ended.',
    howItWorks: 'Check the results to see what everyone said.',
  },
  END_DAY: {
    name: 'Day Ends',
    description: 'The day is over.',
    howItWorks: 'Review the day summary before the next day begins.',
  },
};

/**
 * Resolve template tokens in ACTION_INFO using provided params + Config defaults.
 */
export function renderActionInfo(
  action: string,
  params?: { silverCost?: number },
): ActionInfo {
  const info = ACTION_INFO[action];
  if (!info) {
    return { name: action, description: '', howItWorks: '' };
  }

  const silverCost = params?.silverCost ?? Config.dm.silverCost;

  const resolve = (text: string): string =>
    text.replace(/\{silverCost\}/g, String(silverCost));

  return {
    name: resolve(info.name),
    description: resolve(info.description),
    howItWorks: resolve(info.howItWorks),
  };
}
