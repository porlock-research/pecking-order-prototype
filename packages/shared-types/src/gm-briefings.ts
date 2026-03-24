import { VOTE_TYPE_INFO } from './vote-type-info';
import { GAME_TYPE_INFO } from './game-type-info';
import { ACTIVITY_TYPE_INFO } from './activity-type-info';
import { DILEMMA_TYPE_INFO } from './dilemma-type-info';
import type { VoteType, GameType, PromptType } from './index';
import type { DilemmaType } from './dilemma-types';

interface DayBriefingInput {
  dayIndex: number;
  voteType: string;
  gameType?: string;
  activityType?: string;
  dilemmaType?: string;
}

export function buildDayBriefingMessages(
  day: DayBriefingInput,
  aliveCount: number,
): string[] {
  const messages: string[] = [];

  const voteInfo = VOTE_TYPE_INFO[day.voteType as VoteType];
  const parts: string[] = [
    `Day ${day.dayIndex} begins. ${aliveCount} players remain.`,
  ];

  if (voteInfo) {
    parts.push(`Tonight's vote: ${voteInfo.name} — ${voteInfo.howItWorks}`);
  }

  if (day.gameType && day.gameType !== 'NONE') {
    const gameInfo = GAME_TYPE_INFO[day.gameType as Exclude<GameType, 'NONE'>];
    if (gameInfo) {
      parts.push(`Today's game: ${gameInfo.name} — ${gameInfo.description}`);
    }
  }

  if (day.activityType && day.activityType !== 'NONE') {
    const actInfo = ACTIVITY_TYPE_INFO[day.activityType as PromptType];
    if (actInfo) {
      parts.push(`Today's activity: ${actInfo.name} — ${actInfo.description}`);
    }
  }

  messages.push(parts.join('\n\n'));

  if (day.dilemmaType && day.dilemmaType !== 'NONE') {
    const dilemmaInfo = DILEMMA_TYPE_INFO[day.dilemmaType as DilemmaType];
    if (dilemmaInfo) {
      messages.push(`Today's dilemma: ${dilemmaInfo.name} — ${dilemmaInfo.howItWorks}`);
    }
  }

  return messages;
}
