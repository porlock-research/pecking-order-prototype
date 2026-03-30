import { useMemo, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { VotingPhases, ArcadePhases, PromptPhases, DilemmaPhases, TickerCategories } from '@pecking-order/shared-types';
import type { TimelineEntry } from '../types/timeline';

/* ------------------------------------------------------------------ */
/*  Cartridge state tracking for system message injection              */
/* ------------------------------------------------------------------ */

interface CartridgeState {
  votingActive: boolean;
  votingReveal: boolean;
  gameActive: boolean;
  gameComplete: boolean;
  promptActive: boolean;
  promptComplete: boolean;
  dilemmaActive: boolean;
  dilemmaComplete: boolean;
}

function getCurrentCartridgeState(
  voting: any,
  game: any,
  prompt: any,
  dilemma: any,
): CartridgeState {
  const votingPhase = voting?.phase;
  const gameStatus = game?.status;
  const gamePhase = game?.phase;
  const promptPhase = prompt?.phase;
  const dilemmaPhase = dilemma?.phase;

  return {
    votingActive: !!voting,
    votingReveal: votingPhase === VotingPhases.REVEAL || votingPhase === VotingPhases.WINNER,
    gameActive: !!game,
    gameComplete:
      gameStatus === ArcadePhases.COMPLETED ||
      gamePhase === 'REVEAL' ||
      gamePhase === 'SCOREBOARD',
    promptActive: !!prompt,
    promptComplete: promptPhase === PromptPhases.RESULTS,
    dilemmaActive: !!dilemma,
    dilemmaComplete: dilemmaPhase === DilemmaPhases.REVEAL,
  };
}

function makeSystemEntry(text: string, category: string, ts: number): TimelineEntry {
  return {
    kind: 'system',
    key: `sys-${category}-${ts}`,
    timestamp: ts,
    data: {
      id: `sys-${category}-${ts}`,
      text,
      category: category as any,
      timestamp: ts,
    },
  };
}

/**
 * Main chat timeline: chat messages + injected system messages for cartridge events.
 * Cartridges are rendered in the Today tab (ADR-124).
 */
export function useTimeline(): TimelineEntry[] {
  const chatLog = useGameStore(s => s.chatLog);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const activeDilemma = useGameStore(s => s.activeDilemma);

  const prevStateRef = useRef<CartridgeState>({
    votingActive: false,
    votingReveal: false,
    gameActive: false,
    gameComplete: false,
    promptActive: false,
    promptComplete: false,
    dilemmaActive: false,
    dilemmaComplete: false,
  });

  const systemMessagesRef = useRef<TimelineEntry[]>([]);

  // Detect cartridge transitions and inject system messages
  const currentState = getCurrentCartridgeState(
    activeVotingCartridge,
    activeGameCartridge,
    activePromptCartridge,
    activeDilemma,
  );
  const prev = prevStateRef.current;
  const now = Date.now();

  // Voting transitions
  if (currentState.votingActive && !prev.votingActive && !currentState.votingReveal) {
    systemMessagesRef.current.push(
      makeSystemEntry('Voting has started', TickerCategories.VOTE, now),
    );
  }
  if (currentState.votingReveal && !prev.votingReveal) {
    systemMessagesRef.current.push(
      makeSystemEntry('Voting complete \u2014 see results in Today', TickerCategories.VOTE, now),
    );
  }

  // Game transitions
  if (currentState.gameActive && !prev.gameActive && !currentState.gameComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Game Time', TickerCategories.GAME, now),
    );
  }
  if (currentState.gameComplete && !prev.gameComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Game complete \u2014 see results in Today', TickerCategories.GAME, now),
    );
  }

  // Prompt transitions
  if (currentState.promptActive && !prev.promptActive && !currentState.promptComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Activity has started', TickerCategories.ACTIVITY, now),
    );
  }
  if (currentState.promptComplete && !prev.promptComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Activity complete \u2014 see results in Today', TickerCategories.ACTIVITY, now),
    );
  }

  // Dilemma transitions
  if (currentState.dilemmaActive && !prev.dilemmaActive && !currentState.dilemmaComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Dilemma has started', TickerCategories.DILEMMA, now),
    );
  }
  if (currentState.dilemmaComplete && !prev.dilemmaComplete) {
    systemMessagesRef.current.push(
      makeSystemEntry('Dilemma resolved \u2014 see results in Today', TickerCategories.DILEMMA, now),
    );
  }

  prevStateRef.current = currentState;

  return useMemo(() => {
    const entries: TimelineEntry[] = [];

    const mainChat = chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));
    for (const msg of mainChat) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    // Include accumulated system messages
    for (const sys of systemMessagesRef.current) {
      entries.push(sys);
    }

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    return entries;
  }, [chatLog, activeVotingCartridge, activeGameCartridge, activePromptCartridge, activeDilemma]);
}
