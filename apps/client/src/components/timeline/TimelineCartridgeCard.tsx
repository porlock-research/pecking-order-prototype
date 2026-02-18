import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VotingPanel from '../panels/VotingPanel';
import GamePanel from '../panels/GamePanel';
import PromptPanel from '../panels/PromptPanel';
import { useGameStore } from '../../store/useGameStore';
import { Vote, Gamepad2, MessageSquare, Skull, Trophy, Coins, ChevronRight } from 'lucide-react';
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

// --- Game helpers ---

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

// --- Vote helpers ---

function getVoteTotal(snapshot: any): number | null {
  const summary = snapshot.summary;
  if (!summary) return null;
  const countObj = summary.tallies || summary.electionTallies || summary.voteCounts || summary.saveCounts;
  if (!countObj || typeof countObj !== 'object') return null;
  const total = Object.values(countObj as Record<string, number>).reduce((a: number, b: any) => a + (b as number), 0);
  return total > 0 ? total : null;
}

function hasVotingDetail(snapshot: any): boolean {
  const summary = snapshot.summary;
  if (!summary) return false;
  return !!(summary.tallies || summary.electionTallies || summary.voteCounts || summary.saveCounts || summary.silverRanking);
}

// --- Prompt helpers ---

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

function hasPromptDetail(snapshot: any): boolean {
  const results = snapshot.results;
  if (!results) return false;
  switch (snapshot.promptType) {
    case 'WOULD_YOU_RATHER': return !!(results.optionA || results.optionB);
    case 'HOT_TAKE': return !!results.statement;
    case 'CONFESSION': return !!results.winnerText;
    case 'GUESS_WHO': return !!results.correctGuesses && Object.keys(results.correctGuesses).length > 0;
    case 'PREDICTION': return !!(results.consensusVoters?.length);
    case 'PLAYER_PICK': return !!(results.mutualPicks?.length);
    default: return false;
  }
}

// --- Shared sub-components ---

const VoteTallyGrid: React.FC<{
  tallies: Record<string, number> | null | undefined;
  eliminatedId?: string | null;
  winnerId?: string | null;
  immuneIds?: string[];
  roster: Record<string, any>;
}> = ({ tallies, eliminatedId, winnerId, immuneIds, roster }) => {
  if (!tallies || typeof tallies !== 'object') return null;

  const entries = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);
  const immuneSet = new Set(immuneIds || []);

  return (
    <div className="space-y-1">
      {entries.map(([playerId, count]) => {
        const isEliminated = playerId === eliminatedId;
        const isWinner = playerId === winnerId;
        const isImmune = immuneSet.has(playerId);
        const barWidth = Math.max((count / maxCount) * 100, 4);

        return (
          <div key={playerId} className="flex items-center gap-2 text-xs">
            <span className={`w-24 truncate ${
              isEliminated ? 'text-skin-danger' :
              isWinner ? 'text-skin-gold font-medium' :
              isImmune ? 'text-skin-muted line-through' :
              'text-skin-dim'
            }`}>
              {getPlayerName(roster, playerId)}
            </span>
            <div className="flex-1 h-3 rounded-full bg-skin-base/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isEliminated ? 'bg-skin-danger/50' :
                  isWinner ? 'bg-skin-gold/50' :
                  isImmune ? 'bg-skin-muted/20' :
                  'bg-skin-gold/30'
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className={`w-5 text-right tabular-nums ${
              isEliminated ? 'text-skin-danger' : 'text-skin-muted'
            }`}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const SilverRankingList: React.FC<{
  ranking: Array<{ id: string; silver: number }> | null | undefined;
  eliminatedId?: string | null;
  roster: Record<string, any>;
}> = ({ ranking, eliminatedId, roster }) => {
  if (!ranking || !Array.isArray(ranking)) return null;

  return (
    <div className="space-y-0.5">
      {ranking.map((entry, i) => {
        const isEliminated = entry.id === eliminatedId;
        return (
          <div key={entry.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 text-right tabular-nums ${isEliminated ? 'text-skin-danger font-medium' : 'text-skin-muted'}`}>
                #{i + 1}
              </span>
              <span className={isEliminated ? 'text-skin-danger font-medium' : 'text-skin-dim'}>
                {getPlayerName(roster, entry.id)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-skin-muted">
              <Coins size={10} />
              <span>{entry.silver}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- Voting expanded detail ---

const VotingDetail: React.FC<{ voteType: string; snapshot: any; roster: Record<string, any> }> = ({ voteType, snapshot, roster }) => {
  const summary = snapshot.summary || {};
  const eliminatedId = snapshot.eliminatedId ?? snapshot.results?.eliminatedId;
  const winnerId = snapshot.winnerId ?? snapshot.results?.winnerId;

  const detail = (() => {
    switch (voteType) {
      case 'MAJORITY':
      case 'PODIUM_SACRIFICE':
        return <VoteTallyGrid tallies={summary.tallies} eliminatedId={eliminatedId} roster={roster} />;

      case 'EXECUTIONER':
        return (
          <div className="space-y-2">
            {summary.executionerId && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-skin-muted">Executioner:</span>
                <span className="text-skin-base font-medium">{getPlayerName(roster, summary.executionerId)}</span>
              </div>
            )}
            {summary.electionTallies && (
              <VoteTallyGrid tallies={summary.electionTallies} winnerId={summary.executionerId} roster={roster} />
            )}
          </div>
        );

      case 'BUBBLE':
        return (
          <div className="space-y-2">
            {summary.immunePlayerIds?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.immunePlayerIds.map((id: string) => (
                  <span key={id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-skin-green/10 text-skin-green">
                    {getPlayerName(roster, id)} safe
                  </span>
                ))}
              </div>
            )}
            <VoteTallyGrid tallies={summary.tallies} eliminatedId={eliminatedId} immuneIds={summary.immunePlayerIds} roster={roster} />
          </div>
        );

      case 'SECOND_TO_LAST':
        return <SilverRankingList ranking={summary.silverRanking} eliminatedId={eliminatedId} roster={roster} />;

      case 'SHIELD':
        return <VoteTallyGrid tallies={summary.saveCounts} eliminatedId={eliminatedId} roster={roster} />;

      case 'TRUST_PAIRS':
        return (
          <div className="space-y-2">
            {summary.mutualPairs?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.mutualPairs.map((pair: string[], i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-skin-pink/10 text-skin-pink">
                    {getPlayerName(roster, pair[0])} + {getPlayerName(roster, pair[1])}
                  </span>
                ))}
              </div>
            )}
            <VoteTallyGrid tallies={summary.tallies} eliminatedId={eliminatedId} immuneIds={summary.immunePlayerIds} roster={roster} />
          </div>
        );

      case 'FINALS':
        return <VoteTallyGrid tallies={summary.voteCounts} winnerId={winnerId} roster={roster} />;

      default:
        return null;
    }
  })();

  if (!detail) return null;
  return <div className="mt-2 ml-8">{detail}</div>;
};

// --- Prompt expanded detail ---

const PromptDetail: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const results = snapshot.results;
  if (!results) return null;

  const detail = (() => {
    switch (snapshot.promptType) {
      case 'WOULD_YOU_RATHER': {
        const total = (results.countA || 0) + (results.countB || 0);
        if (!total) return null;
        const pctA = Math.round(((results.countA || 0) / total) * 100);
        const pctB = 100 - pctA;
        return (
          <div className="space-y-1.5">
            <div className="text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className={results.minorityChoice === 'A' ? 'text-skin-pink font-medium' : 'text-skin-dim'}>
                  {results.optionA || 'Option A'}
                </span>
                <span className="text-skin-muted tabular-nums">{results.countA} ({pctA}%)</span>
              </div>
              <div className="h-2 rounded-full bg-skin-base/10 overflow-hidden">
                <div className="h-full rounded-full bg-skin-pink/40" style={{ width: `${pctA}%` }} />
              </div>
            </div>
            <div className="text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className={results.minorityChoice === 'B' ? 'text-skin-pink font-medium' : 'text-skin-dim'}>
                  {results.optionB || 'Option B'}
                </span>
                <span className="text-skin-muted tabular-nums">{results.countB} ({pctB}%)</span>
              </div>
              <div className="h-2 rounded-full bg-skin-base/10 overflow-hidden">
                <div className="h-full rounded-full bg-skin-pink/40" style={{ width: `${pctB}%` }} />
              </div>
            </div>
          </div>
        );
      }

      case 'HOT_TAKE': {
        const total = (results.agreeCount || 0) + (results.disagreeCount || 0);
        if (!total) return null;
        const pctAgree = Math.round(((results.agreeCount || 0) / total) * 100);
        return (
          <div className="space-y-1.5">
            {results.statement && (
              <p className="text-xs text-skin-dim italic">&ldquo;{results.statement}&rdquo;</p>
            )}
            <div className="flex gap-2 text-xs">
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-skin-green">Agree</span>
                  <span className="text-skin-muted tabular-nums">{results.agreeCount}</span>
                </div>
                <div className="h-2 rounded-full bg-skin-base/10 overflow-hidden">
                  <div className="h-full rounded-full bg-skin-green/40" style={{ width: `${pctAgree}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-skin-danger">Disagree</span>
                  <span className="text-skin-muted tabular-nums">{results.disagreeCount}</span>
                </div>
                <div className="h-2 rounded-full bg-skin-base/10 overflow-hidden">
                  <div className="h-full rounded-full bg-skin-danger/40" style={{ width: `${100 - pctAgree}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'CONFESSION': {
        if (!results.winnerText) return null;
        return (
          <div>
            <p className="text-xs text-skin-dim italic">&ldquo;{results.winnerText}&rdquo;</p>
            {results.winnerId && (
              <p className="text-[10px] text-skin-muted mt-0.5">
                &mdash; {getPlayerName(roster, results.winnerId)}
              </p>
            )}
          </div>
        );
      }

      case 'GUESS_WHO': {
        const guesses = results.correctGuesses as Record<string, number> | undefined;
        if (!guesses) return null;
        const entries = Object.entries(guesses).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return null;
        return (
          <div className="space-y-0.5">
            {entries.map(([pid, count]) => (
              <div key={pid} className="flex items-center justify-between text-xs">
                <span className="text-skin-dim truncate">{getPlayerName(roster, pid)}</span>
                <span className="text-skin-muted tabular-nums">{count} correct</span>
              </div>
            ))}
          </div>
        );
      }

      case 'PREDICTION': {
        const voters = results.consensusVoters as string[] | undefined;
        if (!voters || voters.length === 0) return null;
        return (
          <div>
            <div className="flex flex-wrap gap-1">
              {voters.map((id: string) => (
                <span key={id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-skin-pink/10 text-skin-pink">
                  {getPlayerName(roster, id)}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-skin-muted mt-1">picked the consensus</p>
          </div>
        );
      }

      case 'PLAYER_PICK': {
        const mutualPicks = results.mutualPicks as Array<[string, string]> | undefined;
        if (!mutualPicks || mutualPicks.length === 0) return null;
        return (
          <div>
            <div className="flex flex-wrap gap-1">
              {mutualPicks.map(([a, b]: [string, string], i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-skin-pink/10 text-skin-pink">
                  {getPlayerName(roster, a)} &harr; {getPlayerName(roster, b)}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-skin-muted mt-1">mutual picks</p>
          </div>
        );
      }

      default:
        return null;
    }
  })();

  if (!detail) return null;
  return <div className="mt-2 ml-8">{detail}</div>;
};

// --- Main summary components ---

const VotingSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const [expanded, setExpanded] = useState(false);
  const voteType = snapshot.mechanism || snapshot.voteType || 'UNKNOWN';
  const label = VOTE_TYPE_LABELS[voteType] || voteType;
  const eliminatedId = snapshot.eliminatedId ?? snapshot.results?.eliminatedId;
  const winnerId = snapshot.winnerId ?? snapshot.results?.winnerId;
  const voteTotal = getVoteTotal(snapshot);
  const canExpand = hasVotingDetail(snapshot);

  return (
    <div>
      <div
        className={canExpand ? 'cursor-pointer select-none' : ''}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-skin-gold/10 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_var(--po-gold-dim)]">
            <Vote size={13} className="text-skin-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wide text-skin-gold">
                {label}{voteTotal ? ` \u00b7 ${voteTotal} votes` : ''}
              </span>
              {canExpand && (
                <ChevronRight
                  size={14}
                  className={`text-skin-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                />
              )}
            </div>
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
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="voting-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <VotingDetail voteType={voteType} snapshot={snapshot} roster={roster} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const GameSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const [expanded, setExpanded] = useState(false);
  const gameType = snapshot.gameType || 'UNKNOWN';
  const label = GAME_TYPE_LABELS[gameType] || gameType;
  const gold = snapshot.goldContribution || 0;
  const rows = getPlayerRows(snapshot, roster);
  const bestRow = rows.find(r => r.isBest);
  const canExpand = rows.length > 1;

  return (
    <div>
      <div
        className={canExpand ? 'cursor-pointer select-none' : ''}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-skin-green/10 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_var(--po-green-dim)]">
              <Gamepad2 size={13} className="text-skin-green" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wide text-skin-green">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {gold > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <Trophy size={11} />
                <span>+{gold} gold</span>
              </div>
            )}
            {canExpand && (
              <ChevronRight
                size={14}
                className={`text-skin-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              />
            )}
          </div>
        </div>
        {!expanded && bestRow && (
          <div className="mt-1 ml-8 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Trophy size={11} className="text-skin-gold flex-shrink-0" />
              <span className="font-medium text-skin-base truncate">{bestRow.name}</span>
              {bestRow.metric && <span className="text-skin-muted flex-shrink-0">{bestRow.metric}</span>}
            </div>
            {bestRow.silver > 0 && (
              <div className="flex items-center gap-1 text-skin-dim flex-shrink-0 ml-2">
                <Coins size={10} className="text-skin-dim" />
                <span>+{bestRow.silver}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expanded && rows.length > 0 && (
          <motion.div
            key="game-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PromptSummary: React.FC<{ snapshot: any; roster: Record<string, any> }> = ({ snapshot, roster }) => {
  const [expanded, setExpanded] = useState(false);
  const promptType = snapshot.promptType || 'UNKNOWN';
  const label = PROMPT_TYPE_LABELS[promptType] || promptType;
  const detail = getPromptDetail(snapshot, roster);
  const participantCount = snapshot.participantCount ?? 0;
  const canExpand = hasPromptDetail(snapshot);

  return (
    <div>
      <div
        className={canExpand ? 'cursor-pointer select-none' : ''}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-skin-pink/10 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 8px rgba(236, 73, 153, 0.2)' }}>
            <MessageSquare size={13} className="text-skin-pink" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wide text-skin-pink">
                {label}{participantCount > 0 ? ` \u00b7 ${participantCount} responded` : ''}
              </span>
              {canExpand && (
                <ChevronRight
                  size={14}
                  className={`text-skin-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                />
              )}
            </div>
            {detail && (
              <div className="text-xs text-skin-dim mt-0.5">{detail}</div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="prompt-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <PromptDetail snapshot={snapshot} roster={roster} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Card wrapper ---

export const CompletedCartridgeCard: React.FC<CompletedCartridgeCardProps> = ({ entry }) => {
  const roster = useGameStore(s => s.roster);
  const { kind, snapshot } = entry.data;

  const borderColor = kind === 'voting'
    ? 'border-skin-gold/30'
    : kind === 'game'
      ? 'border-skin-green/30'
      : 'border-skin-pink/30';

  const stripClass = kind === 'voting'
    ? 'cartridge-strip-voting'
    : kind === 'game'
      ? 'cartridge-strip-game'
      : 'cartridge-strip-prompt';

  return (
    <div className={`rounded-xl border ${borderColor} bg-glass shadow-card overflow-hidden`}>
      <div className={`h-[2px] ${stripClass}`} />
      <div className="px-3 py-2.5">
        {kind === 'voting' && <VotingSummary snapshot={snapshot} roster={roster} />}
        {kind === 'game' && <GameSummary snapshot={snapshot} roster={roster} />}
        {kind === 'prompt' && <PromptSummary snapshot={snapshot} roster={roster} />}
      </div>
    </div>
  );
};
