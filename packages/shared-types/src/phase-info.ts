/**
 * Phase transition text — shell-agnostic reference data.
 * Extracts all game-semantic text from PhaseTransitionSplash.
 * Colors, backgrounds, and icon choices stay in the shell.
 */
import { DayPhases } from './index';
import { VOTE_TYPE_INFO } from './vote-type-info';
import { GAME_TYPE_INFO } from './game-type-info';
import { ACTIVITY_TYPE_INFO } from './activity-type-info';
import type { DayPhase, VoteType, GameType, PromptType } from './index';

export interface PhaseInfo {
  title: string;
  subtitle: string;
  body: string;
  detail?: string;
  detailLabel?: string;
}

export function buildPhaseInfo(
  phase: DayPhase,
  params?: {
    dayIndex?: number;
    aliveCount?: number;
    totalDays?: number;
    voteType?: string;
    gameType?: string;
    activityType?: string;
    dmsOpen?: boolean;
  },
): PhaseInfo | null {
  const dayIndex = params?.dayIndex ?? 1;
  const aliveCount = params?.aliveCount ?? 0;
  const totalDays = params?.totalDays ?? '?';
  const voteType = params?.voteType;
  const voteInfo = voteType
    ? VOTE_TYPE_INFO[voteType as VoteType]
    : null;

  switch (phase) {
    case DayPhases.MORNING: {
      const parts: string[] = [];
      if (voteInfo) parts.push(`Vote: ${voteInfo.name}`);
      if (params?.gameType && params.gameType !== 'NONE') parts.push('Mini-game today');
      if (params?.activityType && params.activityType !== 'NONE') parts.push('Activity today');
      return {
        title: `Day ${dayIndex}`,
        subtitle: `${aliveCount} players remaining \u00B7 Day ${dayIndex} of ${totalDays}`,
        body: parts.length > 0
          ? parts.join(' \u00B7 ')
          : 'Chat, strategize, and prepare for tonight\u2019s vote.',
        detail: voteInfo?.howItWorks,
        detailLabel: voteInfo ? `Tonight: ${voteInfo.name}` : undefined,
      };
    }

    case DayPhases.SOCIAL:
      return {
        title: 'Social Hour',
        subtitle: params?.dmsOpen ? 'DMs are now open' : 'Chat and strategize',
        body: params?.dmsOpen
          ? 'Send private messages, form alliances, and gather information. Your DM slots are limited \u2014 choose wisely.'
          : 'Talk in the group chat, check the schedule, and prepare for what\u2019s ahead.',
      };

    case DayPhases.GAME: {
      const gameType = params?.gameType;
      const gameInfo = gameType && gameType !== 'NONE'
        ? GAME_TYPE_INFO[gameType as Exclude<GameType, 'NONE'>]
        : null;
      return {
        title: gameInfo ? gameInfo.name : 'Game Time',
        subtitle: 'Earn silver to stay in the game',
        body: gameInfo
          ? gameInfo.description
          : 'Play the mini-game to earn silver. Silver breaks vote ties and unlocks perks \u2014 every coin matters.',
      };
    }

    case DayPhases.ACTIVITY: {
      const actType = params?.activityType;
      const actInfo = actType && actType !== 'NONE'
        ? ACTIVITY_TYPE_INFO[actType as PromptType]
        : null;
      return {
        title: actInfo ? actInfo.name : 'Activity',
        subtitle: actInfo ? actInfo.description : 'Express yourself',
        body: 'Answer the prompt to earn silver. Other players will see your response.',
      };
    }

    case DayPhases.VOTING:
      return {
        title: 'Voting',
        subtitle: voteInfo ? voteInfo.name : 'Cast your vote',
        body: voteInfo?.description ?? 'Choose carefully \u2014 someone will be eliminated.',
        detail: voteInfo?.howItWorks,
        detailLabel: 'How it works',
      };

    case DayPhases.ELIMINATION:
      return {
        title: 'Elimination',
        subtitle: 'The votes have been counted',
        body: 'See who was eliminated and check the vote breakdown in your dashboard.',
      };

    case DayPhases.FINALE:
    case DayPhases.GAME_OVER:
      return {
        title: 'Finale',
        subtitle: 'The game is over',
        body: 'The winner has been decided. Check the dashboard for the full results.',
      };

    default:
      return null;
  }
}
