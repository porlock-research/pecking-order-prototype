import React from 'react';
import VotingPanel from '../panels/VotingPanel';
import GamePanel from '../panels/GamePanel';
import PromptPanel from '../panels/PromptPanel';
import { useGameStore } from '../../store/useGameStore';
import { Vote, Gamepad2, MessageSquare, Skull, Trophy, Coins } from 'lucide-react';
import type { TimelineEntry } from './types';

interface TimelineCartridgeCardProps {
  entry: Extract<TimelineEntry, { kind: 'voting' | 'game' | 'prompt' }>;
  engine: any;
}

export const TimelineCartridgeCard: React.FC<TimelineCartridgeCardProps> = ({ entry, engine }) => {
  switch (entry.kind) {
    case 'voting':
      return <VotingPanel engine={engine} />;
    case 'game':
      return <GamePanel engine={engine} />;
    case 'prompt':
      return <PromptPanel engine={engine} />;
  }
};

// --- Completed cartridge summary ---

interface CompletedCartridgeCardProps {
  entry: Extract<TimelineEntry, { kind: 'completed-cartridge' }>;
}

const VOTE_TYPE_LABELS: Record<string, string> = {
  MAJORITY: 'Majority Vote',
  EXECUTIONER: 'Executioner',
  BUBBLE: 'On the Bubble',
  PODIUM_SACRIFICE: 'Podium Sacrifice',
  SECOND_TO_LAST: 'Second to Last',
  SHIELD: 'Shield Vote',
  TRUST_PAIRS: 'Trust Pairs',
  FINALS: 'Finals',
};

const GAME_TYPE_LABELS: Record<string, string> = {
  GAP_RUN: 'Gap Run',
  GRID_PUSH: 'Grid Push',
  SEQUENCE: 'Sequence',
  REACTION_TIME: 'Reaction Time',
  COLOR_MATCH: 'Color Match',
  STACKER: 'Stacker',
  QUICK_MATH: 'Quick Math',
  SIMON_SAYS: 'Simon Says',
  AIM_TRAINER: 'Aim Trainer',
  TRIVIA: 'Trivia',
  REALTIME_TRIVIA: 'Live Trivia',
  TOUCH_SCREEN: 'Touch Screen',
};

const PROMPT_TYPE_LABELS: Record<string, string> = {
  PLAYER_PICK: 'Player Pick',
  PREDICTION: 'Prediction',
  WOULD_YOU_RATHER: 'Would You Rather',
  HOT_TAKE: 'Hot Take',
  CONFESSION: 'Confession',
  GUESS_WHO: 'Guess Who',
};

function getPlayerName(roster: Record<string, any>, id: string | null | undefined): string {
  if (!id) return 'Unknown';
  return roster[id]?.personaName || id.slice(0, 8);
}

interface PlayerRow {
  id: string;
  name: string;
  metric: string | null;
  silver: number;
  isBest: boolean;
}

function formatMetric(gameType: string, result: any): string | null {
  if (!result) return null;
  switch (gameType) {
    case 'GAP_RUN':
      return result.distance != null ? `${result.distance} dist` : null;
    case 'STACKER':
      return result.height != null ? `${result.height} high` : null;
    case 'REACTION_TIME':
      return result.avgReactionMs != null ? `${Math.round(result.avgReactionMs)}ms` : null;
    case 'QUICK_MATH':
    case 'COLOR_MATCH':
      return result.correctAnswers != null ? `${result.correctAnswers}/${result.totalRounds}` : null;
    case 'SIMON_SAYS':
      return result.roundsCompleted != null ? `round ${result.roundsCompleted}` : null;
    case 'SEQUENCE':
      return result.correctRounds != null ? `${result.correctRounds} rounds` : null;
    case 'GRID_PUSH':
      return result.bankedTotal != null ? `${result.bankedTotal} banked` : null;
    case 'AIM_TRAINER':
      return result.targetsHit != null ? `${result.targetsHit}/${result.totalTargets} hits` : null;
    default:
      return null;
  }
}

function getPlayerRows(snapshot: any, roster: Record<string, any>): PlayerRow[] {
  const gameType = snapshot.gameType;
  const summary = snapshot.summary;
  const silverRewards = snapshot.silverRewards || {};
  const rows: PlayerRow[] = [];

  if (gameType === 'TRIVIA' && summary?.players) {
    const players = summary.players as Record<string, { correctCount?: number; score?: number; silverReward?: number }>;
    for (const [pid, data] of Object.entries(players)) {
      const totalRounds = summary.totalRounds || 5;
      rows.push({
        id: pid,
        name: getPlayerName(roster, pid),
        metric: data.correctCount != null ? `${data.correctCount}/${totalRounds}` : null,
        silver: data.silverReward ?? silverRewards[pid] ?? 0,
        isBest: false,
      });
    }
  } else if (gameType === 'REALTIME_TRIVIA' && summary?.correctCounts) {
    const counts = summary.correctCounts as Record<string, number>;
    for (const [pid, count] of Object.entries(counts)) {
      rows.push({
        id: pid,
        name: getPlayerName(roster, pid),
        metric: `${count} correct`,
        silver: silverRewards[pid] ?? 0,
        isBest: false,
      });
    }
  } else if (gameType === 'TOUCH_SCREEN' && summary?.rankings) {
    const rankings = summary.rankings as Array<{ playerId: string; duration: number }>;
    for (const entry of rankings) {
      rows.push({
        id: entry.playerId,
        name: getPlayerName(roster, entry.playerId),
        metric: `${(entry.duration / 1000).toFixed(1)}s`,
        silver: silverRewards[entry.playerId] ?? 0,
        isBest: false,
      });
    }
  } else if (summary?.playerResults) {
    const results = summary.playerResults as Record<string, { silverReward?: number; result?: any }>;
    for (const [pid, data] of Object.entries(results)) {
      rows.push({
        id: pid,
        name: getPlayerName(roster, pid),
        metric: formatMetric(gameType, data.result),
        silver: data.silverReward ?? silverRewards[pid] ?? 0,
        isBest: false,
      });
    }
  } else {
    for (const [pid, silver] of Object.entries(silverRewards)) {
      rows.push({
        id: pid,
        name: getPlayerName(roster, pid),
        metric: null,
        silver: silver as number,
        isBest: false,
      });
    }
  }

  rows.sort((a, b) => b.silver - a.silver);
  if (rows.length > 0 && rows[0].silver > 0) {
    rows[0].isBest = true;
  }

  return rows;
}

function getPromptDetail(snapshot: any, roster: Record<string, any>): string | null {
  const results = snapshot.results;
  if (!results) return null;

  switch (snapshot.promptType) {
    case 'PREDICTION':
      if (results.mostPicked?.playerId) {
        return `Most picked: ${getPlayerName(roster, results.mostPicked.playerId)}`;
      }
      return null;

    case 'WOULD_YOU_RATHER':
      if (results.countA != null && results.countB != null) {
        return `A: ${results.countA} vs B: ${results.countB}`;
      }
      return null;

    case 'HOT_TAKE':
      if (results.agreeCount != null && results.disagreeCount != null) {
        return `Agree: ${results.agreeCount} / Disagree: ${results.disagreeCount}`;
      }
      return null;

    case 'CONFESSION':
      if (results.winnerId) {
        return `Winner: ${getPlayerName(roster, results.winnerId)}`;
      }
      return null;

    case 'GUESS_WHO':
      if (results.correctGuesses) {
        const entries = Object.entries(results.correctGuesses as Record<string, number>);
        if (entries.length > 0) {
          entries.sort((a, b) => (b[1] as number) - (a[1] as number));
          const [topId, count] = entries[0];
          if ((count as number) > 0) {
            return `${getPlayerName(roster, topId)} guessed ${count} correct`;
          }
        }
      }
      return null;

    default:
      return null;
  }
}

function getVoteTotal(snapshot: any): number | null {
  const tallies = snapshot.summary?.tallies;
  if (!tallies || typeof tallies !== 'object') return null;
  const total = Object.values(tallies as Record<string, number>).reduce((a: number, b: any) => a + (b as number), 0);
  return total > 0 ? total : null;
}

const VotingSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const voteType = snapshot.mechanism || snapshot.voteType || 'UNKNOWN';
  const label = VOTE_TYPE_LABELS[voteType] || voteType;
  const eliminatedId = snapshot.eliminatedId ?? snapshot.results?.eliminatedId;
  const winnerId = snapshot.winnerId ?? snapshot.results?.winnerId;
  const voteTotal = getVoteTotal(snapshot);

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 w-6 h-6 rounded-full bg-skin-gold/10 flex items-center justify-center flex-shrink-0">
        <Vote size={13} className="text-skin-gold" />
      </div>
      <div className="min-w-0">
        <span className="text-[11px] font-mono uppercase tracking-wide text-skin-gold">
          {label}{voteTotal ? ` \u00b7 ${voteTotal} votes` : ''}
        </span>
        {eliminatedId && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Skull size={11} className="text-skin-danger flex-shrink-0" />
            <span className="text-xs text-skin-dim">{getPlayerName(roster, eliminatedId)} eliminated</span>
          </div>
        )}
        {winnerId && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Trophy size={11} className="text-skin-gold flex-shrink-0" />
            <span className="text-xs text-skin-dim">{getPlayerName(roster, winnerId)} wins!</span>
          </div>
        )}
      </div>
    </div>
  );
};

const GameSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const gameType = snapshot.gameType || 'UNKNOWN';
  const label = GAME_TYPE_LABELS[gameType] || gameType;
  const gold = snapshot.goldContribution || 0;
  const rows = getPlayerRows(snapshot, roster);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-skin-green/10 flex items-center justify-center flex-shrink-0">
            <Gamepad2 size={13} className="text-skin-green" />
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wide text-skin-green">{label}</span>
        </div>
        {gold > 0 && (
          <div className="flex items-center gap-1 text-xs text-skin-gold">
            <Coins size={11} />
            <span>+{gold}</span>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="mt-1.5 space-y-0.5 ml-8">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {row.isBest ? (
                  <Trophy size={11} className="text-skin-gold flex-shrink-0" />
                ) : (
                  <span className="w-[11px] flex-shrink-0" />
                )}
                <span className={row.isBest ? 'font-medium text-skin-base truncate' : 'text-skin-dim truncate'}>
                  {row.name}
                </span>
                {row.metric && (
                  <span className="text-skin-muted flex-shrink-0">{row.metric}</span>
                )}
              </div>
              {row.silver > 0 && (
                <div className="flex items-center gap-1 text-skin-dim flex-shrink-0 ml-2">
                  <Coins size={10} className="text-skin-dim" />
                  <span>+{row.silver}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PromptSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const promptType = snapshot.promptType || 'UNKNOWN';
  const label = PROMPT_TYPE_LABELS[promptType] || promptType;
  const detail = getPromptDetail(snapshot, roster);
  const participantCount = snapshot.participantCount ?? 0;

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 w-6 h-6 rounded-full bg-skin-pink/10 flex items-center justify-center flex-shrink-0">
        <MessageSquare size={13} className="text-skin-pink" />
      </div>
      <div className="min-w-0">
        <span className="text-[11px] font-mono uppercase tracking-wide text-skin-pink">
          {label}{participantCount > 0 ? ` \u00b7 ${participantCount} responded` : ''}
        </span>
        {detail && (
          <div className="text-xs text-skin-dim mt-0.5">{detail}</div>
        )}
      </div>
    </div>
  );
};

export const CompletedCartridgeCard: React.FC<CompletedCartridgeCardProps> = ({ entry }) => {
  const roster = useGameStore(s => s.roster);
  const { kind, snapshot } = entry.data;

  const borderColor = kind === 'voting'
    ? 'border-skin-gold/20'
    : kind === 'game'
      ? 'border-skin-green/20'
      : 'border-skin-pink/20';

  return (
    <div className={`rounded-lg border ${borderColor} bg-glass px-3 py-2.5`}>
      {kind === 'voting' && <VotingSummary snapshot={snapshot} roster={roster} />}
      {kind === 'game' && <GameSummary snapshot={snapshot} roster={roster} />}
      {kind === 'prompt' && <PromptSummary snapshot={snapshot} roster={roster} />}
    </div>
  );
};
