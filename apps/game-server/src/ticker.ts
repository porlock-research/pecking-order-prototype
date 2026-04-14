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
    case FactTypes.SILVER_TRANSFER: {
      const amount = fact.payload?.amount || '?';
      const isGmAward = fact.actorId === 'GAME_MASTER' || fact.payload?.gmAward;
      return {
        id: crypto.randomUUID(),
        text: isGmAward
          ? `Game Master awarded ${amount} silver to ${name(fact.targetId)}`
          : `${name(fact.actorId)} sent ${amount} silver to ${name(fact.targetId)}`,
        category: TickerCategories.SOCIAL_TRANSFER,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId, fact.targetId].filter(id => id && id !== 'GAME_MASTER'),
      };
    }
    case FactTypes.GAME_RESULT: {
      const players = fact.payload?.players;
      const gold = fact.payload?.goldContribution || 0;
      if (players) {
        const playerIds = Object.keys(players);
        const sorted = Object.entries(players)
          .map(([pid, data]: [string, any]) => ({ pid, silver: data.silverReward || 0 }))
          .sort((a, b) => b.silver - a.silver);
        let text = '';
        if (sorted.length > 0 && sorted[0].silver > 0) {
          text = `${name(sorted[0].pid)} earned ${sorted[0].silver} silver in today's game!`;
        }
        if (gold > 0) {
          text += text ? ` +${gold} gold to the prize pool.` : `+${gold} gold added to the prize pool.`;
        }
        if (text) {
          return {
            id: crypto.randomUUID(),
            text,
            category: TickerCategories.GAME_REWARD,
            timestamp: fact.timestamp,
            involvedPlayerIds: playerIds,
          };
        }
      } else if (gold > 0) {
        return {
          id: crypto.randomUUID(),
          text: `+${gold} gold added to the prize pool.`,
          category: TickerCategories.GOLD_POOL,
          timestamp: fact.timestamp,
          involvedPlayerIds: [],
        };
      }
      return null;
    }
    case FactTypes.PLAYER_GAME_RESULT: {
      const playerGold = fact.payload?.goldContribution || 0;
      let playerText = `${name(fact.actorId)} earned ${fact.payload?.silverReward || 0} silver in today's game!`;
      if (playerGold > 0) {
        playerText += ` +${playerGold} gold to the prize pool.`;
      }
      return {
        id: crypto.randomUUID(),
        text: playerText,
        category: TickerCategories.GAME_REWARD,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId],
      };
    }
    case FactTypes.ELIMINATION:
      return {
        id: crypto.randomUUID(),
        text: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
        category: TickerCategories.ELIMINATION,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.targetId || fact.actorId].filter(Boolean),
      };
    case FactTypes.WINNER_DECLARED: {
      const goldPool = fact.payload?.goldPool || 0;
      let winText = `${name(fact.targetId || fact.actorId)} has won the game!`;
      if (goldPool > 0) {
        winText += ` They claim the ${goldPool} gold prize pool!`;
      }
      return {
        id: crypto.randomUUID(),
        text: winText,
        category: TickerCategories.PHASE_WINNER,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.targetId || fact.actorId].filter(Boolean),
      };
    }
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
        category: TickerCategories.SOCIAL_PERK,
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
            category: TickerCategories.ACTIVITY,
            timestamp: fact.timestamp,
            involvedPlayerIds: rewardPlayerIds,
          };
        }
      }
      return null;
    }
    case FactTypes.DILEMMA_RESULT: {
      const dilemmaRewards = fact.payload?.silverRewards || {};
      const dilemmaPlayerIds = Object.keys(dilemmaRewards);
      const dilemmaType = fact.payload?.dilemmaType;
      const summary = fact.payload?.results?.summary || {};

      let dilemmaText = 'Daily Dilemma resolved!';
      if (summary.timedOut) {
        dilemmaText = `Daily Dilemma expired — only ${summary.submitted} of ${summary.eligible} participated.`;
      } else if (dilemmaType === 'SILVER_GAMBIT') {
        dilemmaText = summary.allDonated
          ? `Silver Gambit: Everyone donated! Jackpot of ${summary.jackpot} silver awarded.`
          : `Silver Gambit: Someone kept their silver. No jackpot.`;
      } else if (dilemmaType === 'SPOTLIGHT') {
        dilemmaText = summary.unanimous
          ? `Spotlight: Unanimous pick! +20 silver awarded.`
          : `Spotlight: No consensus — picks were split.`;
      } else if (dilemmaType === 'GIFT_OR_GRIEF') {
        const gifted = (summary.giftedIds || []).length;
        const grieved = (summary.grievedIds || []).length;
        dilemmaText = `Gift or Grief: ${gifted} gifted, ${grieved} grieved.`;
      }

      return {
        id: crypto.randomUUID(),
        text: dilemmaText,
        category: TickerCategories.DILEMMA,
        timestamp: fact.timestamp,
        involvedPlayerIds: dilemmaPlayerIds,
      };
    }
    case FactTypes.DM_INVITE_SENT: {
      const kind = fact.payload?.kind ?? 'initial';
      const memberIds: string[] = fact.payload?.memberIds ?? [];
      const actor = name(fact.actorId);
      const totalPartners = memberIds.length;
      let text: string;
      // Markdown-style **bold** wraps persona names and counts. Client NarratorLine
      // parser styles these with the accent color and renders an inline avatar when
      // the bolded token matches a roster persona name. Per v1-narrator-intrigue.md
      // these lines are public intrigue — actor is public, target is NEVER named.
      if (kind === 'add_member') {
        text = `**${actor}** pulled someone else into their chat`;
      } else if (totalPartners >= 4) {
        // Initial alliance formation (4+ invited = 5+ total incl. actor)
        text = `**${totalPartners + 1} players** formed an alliance headed by **${actor}**`;
      } else if (totalPartners >= 2) {
        text = `**${actor}** is scheming with someone`;
      } else {
        text = `**${actor}** started talking to someone`;
      }
      return {
        id: crypto.randomUUID(),
        text,
        category: TickerCategories.SOCIAL_INVITE,
        timestamp: fact.timestamp,
        involvedPlayerIds: [fact.actorId, ...memberIds],
        kind,
      };
    }
    default:
      return null;
  }
}

/** Convert a combined L2+L3 state string into a ticker message for phase transitions. */
export function stateToTicker(stateStr: string, context: any): TickerMessage | null {
  const dayIndex = context?.dayIndex || 0;

  if (stateStr.includes('nightSummary')) {
    return { id: crypto.randomUUID(), text: 'Night has fallen...', category: TickerCategories.PHASE_NIGHT, timestamp: Date.now() };
  }
  if (stateStr.includes('morningBriefing')) {
    return { id: crypto.randomUUID(), text: `Day ${dayIndex} has begun!`, category: TickerCategories.PHASE_DAY_START, timestamp: Date.now() };
  }
  if (stateStr.includes('voting')) {
    return { id: crypto.randomUUID(), text: 'Voting has begun!', category: TickerCategories.VOTE, timestamp: Date.now() };
  }
  if (stateStr.includes('dailyGame')) {
    return { id: crypto.randomUUID(), text: "Today's game is starting!", category: TickerCategories.GAME, timestamp: Date.now() };
  }
  if (stateStr.includes('gameSummary')) {
    return { id: crypto.randomUUID(), text: 'The winner has been crowned!', category: TickerCategories.PHASE_WINNER, timestamp: Date.now() };
  }
  if (stateStr.includes('gameOver')) {
    return { id: crypto.randomUUID(), text: 'The game is over!', category: TickerCategories.PHASE_GAME_OVER, timestamp: Date.now() };
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

/** Time-based ticker retention window: last 60 minutes of entries.
 * Replaces the prior count-based 20-message cap so 4-hour-gap returning players
 * receive meaningful narrator/silver backfill (Pulse Phase 4 §0.3). */
const TICKER_RETENTION_MS = 60 * 60 * 1000;
/** Safety cap for pathological high-throughput games. Realistic worst case:
 * ~10 players × ~3 events/player/min × 60 min ≈ 1800 entries; 2000 gives headroom. */
const TICKER_SAFETY_CAP = 2000;

/** Broadcast a ticker message to all connected clients and append to history buffer. Returns updated history. */
export function broadcastTicker(
  msg: TickerMessage,
  tickerHistory: TickerMessage[],
  getConnections: () => Iterable<Connection>,
): TickerMessage[] {
  const cutoff = Date.now() - TICKER_RETENTION_MS;
  const appended = [...tickerHistory, msg];
  const withinWindow = appended.filter(m => {
    const ts = typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp as any).getTime();
    return ts >= cutoff;
  });
  const updated = withinWindow.length > TICKER_SAFETY_CAP
    ? withinWindow.slice(-TICKER_SAFETY_CAP)
    : withinWindow;

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
