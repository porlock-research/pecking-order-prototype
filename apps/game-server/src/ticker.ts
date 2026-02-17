/**
 * Ticker pipeline — fact-to-ticker conversion, state-to-ticker conversion,
 * debug summary, and broadcast helpers.
 */
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events, FactTypes, TickerCategories } from "@pecking-order/shared-types";
import type { Connection } from "partyserver";

// --- Pure functions ---

/** Flatten nested XState state value to a dot path: { dayLoop: { activeSession: 'running' } } -> "dayLoop.activeSession.running" */
export function flattenState(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([k, v]) => `${k}.${flattenState(v)}`).join(', ');
  }
  return String(value);
}

/** Convert a persisted fact into a humanized ticker message. */
export function factToTicker(fact: any, roster: Record<string, any>): TickerMessage | null {
  const name = (id: string) => roster[id]?.personaName || id;

  switch (fact.type) {
    case FactTypes.SILVER_TRANSFER:
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.actorId)} sent ${fact.payload?.amount || '?'} silver to ${name(fact.targetId)}`,
        category: TickerCategories.SOCIAL,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId, fact.targetId].filter(Boolean),
      };
    case FactTypes.GAME_RESULT: {
      const players = fact.payload?.players;
      if (players) {
        const playerIds = Object.keys(players);
        const sorted = Object.entries(players)
          .map(([pid, data]: [string, any]) => ({ pid, silver: data.silverReward || 0 }))
          .sort((a, b) => b.silver - a.silver);
        if (sorted.length > 0 && sorted[0].silver > 0) {
          return {
            id: crypto.randomUUID(),
            text: `${name(sorted[0].pid)} earned ${sorted[0].silver} silver in today's game!`,
            category: TickerCategories.GAME,
            timestamp: fact.timestamp,
            involvedPlayerIds: playerIds,
          };
        }
      }
      return null;
    }
    case FactTypes.PLAYER_GAME_RESULT:
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.actorId)} earned ${fact.payload?.silverReward || 0} silver in today's game!`,
        category: TickerCategories.GAME,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId],
      };
    case FactTypes.ELIMINATION:
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
        category: TickerCategories.ELIMINATION,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.targetId || fact.actorId].filter(Boolean),
      };
    case FactTypes.WINNER_DECLARED:
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.targetId || fact.actorId)} has won the game!`,
        category: TickerCategories.SYSTEM,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.targetId || fact.actorId].filter(Boolean),
      };
    case FactTypes.PERK_USED: {
      const perkType = fact.payload?.perkType || 'unknown';
      const perkLabels: Record<string, string> = {
        SPY_DMS: 'Spy DMs',
        EXTRA_DM_PARTNER: 'Extra DM Partner',
        EXTRA_DM_CHARS: 'Extra DM Characters',
      };
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.actorId)} used ${perkLabels[perkType] || perkType}!`,
        category: TickerCategories.SOCIAL,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId],
      };
    }
    case FactTypes.PROMPT_RESULT: {
      const rewards = fact.payload?.silverRewards;
      if (rewards) {
        const rewardPlayerIds = Object.keys(rewards);
        const totalSilver = Object.values(rewards).reduce((sum: number, v: any) => sum + (v || 0), 0);
        if (totalSilver > 0) {
          return {
            id: crypto.randomUUID(),
            text: `Activity complete! ${rewardPlayerIds.length} players earned ${totalSilver} silver total.`,
            category: TickerCategories.SOCIAL,
            timestamp: fact.timestamp,
            involvedPlayerIds: rewardPlayerIds,
          };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/** Convert a combined L2+L3 state string into a ticker message for phase transitions. */
export function stateToTicker(stateStr: string, context: any): TickerMessage | null {
  const dayIndex = context?.dayIndex || 0;

  if (stateStr.includes('nightSummary')) {
    return { id: crypto.randomUUID(), text: 'Night has fallen...', category: TickerCategories.SYSTEM, timestamp: Date.now() };
  }
  if (stateStr.includes('morningBriefing')) {
    return { id: crypto.randomUUID(), text: `Day ${dayIndex} has begun!`, category: TickerCategories.SYSTEM, timestamp: Date.now() };
  }
  if (stateStr.includes('voting')) {
    return { id: crypto.randomUUID(), text: 'Voting has begun!', category: TickerCategories.VOTE, timestamp: Date.now() };
  }
  if (stateStr.includes('dailyGame')) {
    return { id: crypto.randomUUID(), text: "Today's game is starting!", category: TickerCategories.GAME, timestamp: Date.now() };
  }
  if (stateStr.includes('gameSummary')) {
    return { id: crypto.randomUUID(), text: 'The winner has been crowned!', category: TickerCategories.SYSTEM, timestamp: Date.now() };
  }
  if (stateStr.includes('gameOver')) {
    return { id: crypto.randomUUID(), text: 'The game is over!', category: TickerCategories.SYSTEM, timestamp: Date.now() };
  }
  return null;
}

/** Build a debug summary string from L2 + L3 snapshots. */
export function buildDebugSummary(snapshot: any, l3Snapshot: any): string {
  const dayIndex = snapshot.context.dayIndex || 0;
  const l2State = flattenState(snapshot.value);
  const manifest = snapshot.context.manifest;
  const currentDay = manifest?.days?.find((d: any) => d.dayIndex === dayIndex);
  const voteType = currentDay?.voteType || '—';
  const gameType = currentDay?.gameType || 'NONE';
  const dmsOpen = l3Snapshot?.context?.dmsOpen ? 'OPEN' : 'CLOSED';

  let mainStage = '—';
  if (l3Snapshot?.value?.running?.mainStage) {
    mainStage = l3Snapshot.value.running.mainStage;
  } else if (!l3Snapshot) {
    mainStage = 'NO L3';
  }

  return `DAY ${dayIndex} · L2: ${l2State} · VOTE: ${voteType} · GAME: ${gameType} · DMs: ${dmsOpen} · STAGE: ${mainStage}`;
}

// --- Side-effect functions ---

/** Broadcast a ticker message to all connected clients and append to history buffer. Returns updated history. */
export function broadcastTicker(
  msg: TickerMessage,
  tickerHistory: TickerMessage[],
  getConnections: () => Iterable<Connection>,
): TickerMessage[] {
  const updated = [...tickerHistory, msg].slice(-20);
  const payload = JSON.stringify({ type: Events.Ticker.UPDATE, message: msg });
  for (const ws of getConnections()) {
    ws.send(payload);
  }
  return updated;
}

/** Broadcast a debug ticker summary to all connected clients. */
export function broadcastDebugTicker(summary: string, getConnections: () => Iterable<Connection>): void {
  const payload = JSON.stringify({ type: Events.Ticker.DEBUG, summary });
  for (const ws of getConnections()) {
    ws.send(payload);
  }
}
