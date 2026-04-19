import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { createActor, fromPromise, type AnyActorRef, type Snapshot } from 'xstate';
import {
  Events,
  VoteEvents,
  ActivityEvents,
  DilemmaEvents,
  TouchScreenEvents,
  type SocialPlayer,
} from '@pecking-order/shared-types';
import { CartridgeStageContext } from '../cartridges/CartridgeStageContext';
import { useGameStore } from '../store/useGameStore';

// ---------------------------------------------------------------------------
// Mode + types
// ---------------------------------------------------------------------------

type Mode = 'game' | 'voting' | 'prompt' | 'dilemma';

type GameType = 'GAP_RUN' | 'GRID_PUSH' | 'SEQUENCE' | 'REACTION_TIME' | 'COLOR_MATCH' | 'STACKER' | 'QUICK_MATH' | 'SIMON_SAYS' | 'AIM_TRAINER' | 'TRIVIA' | 'REALTIME_TRIVIA' | 'BET_BET_BET' | 'BLIND_AUCTION' | 'KINGS_RANSOM' | 'TOUCH_SCREEN' | 'THE_SPLIT' | 'SHOCKWAVE' | 'ORBIT' | 'BEAT_DROP' | 'INFLATE' | 'SNAKE' | 'FLAPPY' | 'COLOR_SORT' | 'BLINK' | 'RECALL';

type VoteType = 'MAJORITY' | 'EXECUTIONER' | 'BUBBLE' | 'PODIUM_SACRIFICE' | 'SECOND_TO_LAST' | 'SHIELD' | 'TRUST_PAIRS' | 'FINALS';

type PromptType = 'PLAYER_PICK' | 'PREDICTION' | 'WOULD_YOU_RATHER' | 'HOT_TAKE' | 'CONFESSION' | 'GUESS_WHO';

type DilemmaType = 'SILVER_GAMBIT' | 'SPOTLIGHT' | 'GIFT_OR_GRIEF';

interface LogEntry {
  ts: number;
  type: string;
  payload?: Record<string, any>;
  label?: string;
}

interface PhaseButton {
  label: string;
  event: string;
}

// ---------------------------------------------------------------------------
// Mock roster (6 players, matching demo-seed)
// ---------------------------------------------------------------------------

function buildRoster(): Record<string, SocialPlayer> {
  const personas = [
    { id: 'p1', name: 'Skyler Blue' },
    { id: 'p2', name: 'Bella Rossi' },
    { id: 'p3', name: 'Chad Brock' },
    { id: 'p4', name: 'Brenda Burns' },
    { id: 'p5', name: 'Jax Cash' },
    { id: 'p6', name: 'Raven Thorne' },
  ];
  return Object.fromEntries(personas.map(p => [p.id, {
    id: p.id,
    personaName: p.name,
    avatarUrl: '',
    status: 'ALIVE',
    silver: 30 + (Number(p.id.slice(1)) * 7) % 25,
  } as any]));
}

const MOCK_ROSTER = buildRoster();
const MOCK_PLAYER_ID = 'p1';
const ROSTER_IDS = Object.keys(MOCK_ROSTER);
const BOT_IDS = ROSTER_IDS.filter(id => id !== MOCK_PLAYER_ID);

// ---------------------------------------------------------------------------
// Game registry (preserves existing behavior)
// ---------------------------------------------------------------------------

interface GameDef {
  loadMachine: () => Promise<any>;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
  defaultInput?: Record<string, any>;
  botPayload?: () => Record<string, any>;
}

const GAME_DEFS: Record<GameType, GameDef> = {
  GAP_RUN: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.gapRunMachine), Component: lazy(() => import('../cartridges/games/gap-run/GapRun')), defaultInput: { difficulty: 0.2 } },
  GRID_PUSH: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.gridPushMachine), Component: lazy(() => import('../cartridges/games/grid-push/GridPush')), defaultInput: { difficulty: 0.2 } },
  SEQUENCE: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.sequenceMachine), Component: lazy(() => import('../cartridges/games/sequence/SequenceGame')), defaultInput: { difficulty: 0.2 } },
  REACTION_TIME: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.reactionTimeMachine), Component: lazy(() => import('../cartridges/games/reaction-time/ReactionTime')), defaultInput: { difficulty: 0.2 } },
  COLOR_MATCH: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.colorMatchMachine), Component: lazy(() => import('../cartridges/games/color-match/ColorMatch')), defaultInput: { difficulty: 0.2 } },
  STACKER: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.stackerMachine), Component: lazy(() => import('../cartridges/games/stacker/Stacker')), defaultInput: { difficulty: 0.2 } },
  QUICK_MATH: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.quickMathMachine), Component: lazy(() => import('../cartridges/games/quick-math/QuickMath')), defaultInput: { difficulty: 0.2 } },
  SIMON_SAYS: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.simonSaysMachine), Component: lazy(() => import('../cartridges/games/simon-says/SimonSays')), defaultInput: { difficulty: 0.2 } },
  AIM_TRAINER: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.aimTrainerMachine), Component: lazy(() => import('../cartridges/games/aim-trainer/AimTrainer')), defaultInput: { difficulty: 0.2 } },
  TRIVIA: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.triviaMachine), Component: lazy(() => import('../cartridges/games/trivia/Trivia')), defaultInput: { roundCount: 5 } },
  REALTIME_TRIVIA: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.realtimeTriviaMachine), Component: lazy(() => import('../cartridges/games/realtime-trivia/RealtimeTrivia')), defaultInput: { questionTimer: 8000 } },
  BET_BET_BET: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.betBetBetMachine), Component: lazy(() => import('../cartridges/games/bet-bet-bet/BetBetBet')), defaultInput: { difficulty: 0.2 }, botPayload: () => ({ amount: Math.floor(Math.random() * 30) + 1 }) },
  BLIND_AUCTION: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.blindAuctionMachine), Component: lazy(() => import('../cartridges/games/blind-auction/BlindAuction')), defaultInput: { difficulty: 0.2 }, botPayload: () => ({ slot: Math.floor(Math.random() * 3) + 1, amount: Math.floor(Math.random() * 20) }) },
  KINGS_RANSOM: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.kingsRansomMachine), Component: lazy(() => import('../cartridges/games/kings-ransom/KingsRansom')), defaultInput: { difficulty: 0.2 }, botPayload: () => ({ action: Math.random() > 0.5 ? 'STEAL' : 'PROTECT' }) },
  TOUCH_SCREEN: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.touchScreenMachine), Component: lazy(() => import('../cartridges/games/touch-screen/TouchScreen')), defaultInput: { difficulty: 0.2, mode: 'SOLO' } },
  THE_SPLIT: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.theSplitMachine), Component: lazy(() => import('../cartridges/games/the-split/TheSplit')), defaultInput: { difficulty: 0.2 }, botPayload: () => ({ action: Math.random() > 0.5 ? 'SPLIT' : 'STEAL' }) },
  SHOCKWAVE: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.shockwaveMachine), Component: lazy(() => import('../cartridges/games/shockwave/Shockwave')), defaultInput: { difficulty: 0.2 } },
  ORBIT: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.orbitMachine), Component: lazy(() => import('../cartridges/games/orbit/Orbit')), defaultInput: { difficulty: 0.2 } },
  BEAT_DROP: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.beatDropMachine), Component: lazy(() => import('../cartridges/games/beat-drop/BeatDrop')), defaultInput: { difficulty: 0.2 } },
  INFLATE: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.inflateMachine), Component: lazy(() => import('../cartridges/games/inflate/Inflate')), defaultInput: { difficulty: 0.2 } },
  SNAKE: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.snakeMachine), Component: lazy(() => import('../cartridges/games/snake/Snake')), defaultInput: { difficulty: 0.2 } },
  FLAPPY: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.flappyMachine), Component: lazy(() => import('../cartridges/games/flappy/Flappy')), defaultInput: { difficulty: 0.2 } },
  COLOR_SORT: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.colorSortMachine), Component: lazy(() => import('../cartridges/games/color-sort/ColorSort')), defaultInput: { difficulty: 0.2 } },
  BLINK: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.blinkMachine), Component: lazy(() => import('../cartridges/games/blink/Blink')), defaultInput: { difficulty: 0.2 } },
  RECALL: { loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.recallMachine), Component: lazy(() => import('../cartridges/games/recall/Recall')), defaultInput: { difficulty: 0.2 } },
};

// ---------------------------------------------------------------------------
// Voting registry
// ---------------------------------------------------------------------------

interface VotingDef {
  loadMachine: () => Promise<any>;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Type-specific bot vote — random valid target for each bot. */
  botCast: (actor: AnyActorRef, botIds: string[], roster: Record<string, SocialPlayer>) => Array<{ event: string; payload: any }>;
}

function genericBotCast(eventType: string): VotingDef['botCast'] {
  return (actor, botIds, roster) => {
    const targets = Object.keys(roster);
    return botIds.map(senderId => {
      const targetId = targets[Math.floor(Math.random() * targets.length)];
      actor.send({ type: eventType, senderId, targetId });
      return { event: eventType, payload: { senderId, targetId } };
    });
  };
}

const VOTING_DEFS: Record<VoteType, VotingDef> = {
  MAJORITY: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.majorityMachine), Component: lazy(() => import('../cartridges/voting/MajorityVoting')), botCast: genericBotCast(VoteEvents.MAJORITY.CAST) },
  EXECUTIONER: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.executionerMachine), Component: lazy(() => import('../cartridges/voting/ExecutionerVoting')), botCast: genericBotCast(VoteEvents.EXECUTIONER.PICK) },
  BUBBLE: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.bubbleMachine), Component: lazy(() => import('../cartridges/voting/BubbleVoting')), botCast: genericBotCast(VoteEvents.BUBBLE.CAST) },
  PODIUM_SACRIFICE: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.podiumSacrificeMachine), Component: lazy(() => import('../cartridges/voting/PodiumSacrificeVoting')), botCast: genericBotCast(VoteEvents.PODIUM_SACRIFICE.CAST) },
  SECOND_TO_LAST: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.secondToLastMachine), Component: lazy(() => import('../cartridges/voting/SecondToLastVoting')), botCast: () => [] /* display-only mechanism */ },
  SHIELD: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.shieldMachine), Component: lazy(() => import('../cartridges/voting/ShieldVoting')), botCast: genericBotCast(VoteEvents.SHIELD.SAVE) },
  TRUST_PAIRS: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.trustPairsMachine), Component: lazy(() => import('../cartridges/voting/TrustPairsVoting')), botCast: genericBotCast(VoteEvents.TRUST_PAIRS.TRUST) },
  FINALS: { loadMachine: () => import('@pecking-order/cartridges').then(m => m.finalsMachine), Component: lazy(() => import('../cartridges/voting/FinalsVoting')), botCast: genericBotCast(VoteEvents.FINALS.CAST) },
};

// ---------------------------------------------------------------------------
// Prompt registry
// ---------------------------------------------------------------------------

interface PromptDef {
  loadMachine: () => Promise<any>;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Per-type input fields beyond the base { promptType, roster, dayIndex } —
   *  promptText is required for all; HOT_TAKE needs options[]; WYR needs
   *  optionA/optionB. Without these the cartridge renders empty. */
  extraInput: Record<string, any>;
  /** Type-specific bot submit. */
  botSubmit: (actor: AnyActorRef, botIds: string[], roster: Record<string, SocialPlayer>) => Array<{ event: string; payload: any }>;
  /** Per-phase advance buttons (e.g. CONFESSION COLLECTING → VOTING → REVEAL). */
  phaseButtons: PhaseButton[];
}

/**
 * Each prompt's bot helper inspects the live snapshot to dispatch the right
 * event for the current phase. CONFESSION and GUESS_WHO are two-phase: bots
 * submit text in phase 1, then auto-advance and bots vote/guess in phase 2.
 * Calling Run Bots twice walks them through both phases.
 */
const PROMPT_DEFS: Record<PromptType, PromptDef> = {
  PLAYER_PICK: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.playerPickMachine),
    Component: lazy(() => import('../cartridges/prompts/PlayerPickPrompt')),
    extraInput: { promptText: 'Who would you trust with your last silver coin?' },
    botSubmit: (actor, botIds, roster) => botIds.map(senderId => {
      const targets = Object.keys(roster).filter(id => id !== senderId);
      const targetId = targets[Math.floor(Math.random() * targets.length)];
      actor.send({ type: ActivityEvents.PROMPT.SUBMIT, senderId, targetId });
      return { event: ActivityEvents.PROMPT.SUBMIT, payload: { senderId, targetId } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_ACTIVITY }],
  },
  PREDICTION: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.predictionMachine),
    Component: lazy(() => import('../cartridges/prompts/PredictionPrompt')),
    extraInput: { promptText: 'Who will be eliminated tonight?' },
    botSubmit: (actor, botIds, roster) => botIds.map(senderId => {
      const targets = Object.keys(roster);
      const targetId = targets[Math.floor(Math.random() * targets.length)];
      actor.send({ type: ActivityEvents.PROMPT.SUBMIT, senderId, targetId });
      return { event: ActivityEvents.PROMPT.SUBMIT, payload: { senderId, targetId } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_ACTIVITY }],
  },
  WOULD_YOU_RATHER: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.wyrMachine),
    Component: lazy(() => import('../cartridges/prompts/WouldYouRatherPrompt')),
    extraInput: { promptText: 'Would you rather…', optionA: 'Win the game alone', optionB: 'Split the prize five ways' },
    botSubmit: (actor, botIds) => botIds.map(senderId => {
      const choice = Math.random() > 0.5 ? 'A' : 'B';
      actor.send({ type: ActivityEvents.WYR.CHOOSE, senderId, choice });
      return { event: ActivityEvents.WYR.CHOOSE, payload: { senderId, choice } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_ACTIVITY }],
  },
  HOT_TAKE: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.hotTakeMachine),
    Component: lazy(() => import('../cartridges/prompts/HotTakePrompt')),
    extraInput: {
      promptText: 'Lying in DMs is a perfectly valid strategy.',
      options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
      promptId: 'dev-hot-take',
    },
    botSubmit: (actor, botIds) => botIds.map(senderId => {
      const stance = Math.floor(Math.random() * 5);
      actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId, stance });
      return { event: ActivityEvents.HOTTAKE.RESPOND, payload: { senderId, stance } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_ACTIVITY }],
  },
  CONFESSION: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.confessionMachine),
    Component: lazy(() => import('../cartridges/prompts/ConfessionPrompt')),
    extraInput: { promptText: 'Confess your worst game-day move so far.' },
    botSubmit: (actor, botIds) => {
      const phase = (actor.getSnapshot() as any)?.value;
      if (phase === 'voting') {
        // Phase 2: vote on the anonymous confessions.
        const anonIds: string[] = Object.keys(((actor.getSnapshot() as any)?.context?.anonymousConfessions) || {});
        return botIds.map(senderId => {
          const confessionId = anonIds[Math.floor(Math.random() * anonIds.length)];
          actor.send({ type: ActivityEvents.CONFESSION.VOTE, senderId, confessionId });
          return { event: ActivityEvents.CONFESSION.VOTE, payload: { senderId, confessionId } };
        });
      }
      // Phase 1: submit confessions.
      const samples = ['I once skipped a vote.', 'I lied in a DM.', 'I planted gossip.', 'I bluffed.', 'I broke an alliance.'];
      return botIds.map(senderId => {
        const text = samples[Math.floor(Math.random() * samples.length)];
        actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId, text });
        return { event: ActivityEvents.CONFESSION.SUBMIT, payload: { senderId, text } };
      });
    },
    phaseButtons: [{ label: 'Force Reveal', event: Events.Internal.END_ACTIVITY }],
  },
  GUESS_WHO: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.guessWhoMachine),
    Component: lazy(() => import('../cartridges/prompts/GuessWhoPrompt')),
    extraInput: { promptText: 'In one word, describe your game so far.' },
    botSubmit: (actor, botIds, roster) => {
      const phase = (actor.getSnapshot() as any)?.value;
      if (phase === 'guessing') {
        // Phase 2: guess who wrote each anonymous answer.
        const anonIds: string[] = Object.keys(((actor.getSnapshot() as any)?.context?.anonymousAnswers) || {});
        const targets = Object.keys(roster);
        return botIds.map(senderId => {
          const answerId = anonIds[Math.floor(Math.random() * anonIds.length)];
          const guessedAuthorId = targets[Math.floor(Math.random() * targets.length)];
          actor.send({ type: ActivityEvents.GUESSWHO.GUESS, senderId, answerId, guessedAuthorId });
          return { event: ActivityEvents.GUESSWHO.GUESS, payload: { senderId, answerId, guessedAuthorId } };
        });
      }
      // Phase 1: submit answers.
      const samples = ['Skipped', 'Lied', 'Bluffed', 'Snitched'];
      return botIds.map(senderId => {
        const text = samples[Math.floor(Math.random() * samples.length)];
        actor.send({ type: ActivityEvents.GUESSWHO.ANSWER, senderId, text });
        return { event: ActivityEvents.GUESSWHO.ANSWER, payload: { senderId, text } };
      });
    },
    phaseButtons: [{ label: 'Force Reveal', event: Events.Internal.END_ACTIVITY }],
  },
};

// ---------------------------------------------------------------------------
// Dilemma registry
// ---------------------------------------------------------------------------

interface DilemmaDef {
  loadMachine: () => Promise<any>;
  /** Component is the unified DilemmaCard router that reads from useGameStore. */
  botSubmit: (actor: AnyActorRef, botIds: string[], roster: Record<string, SocialPlayer>) => Array<{ event: string; payload: any }>;
  phaseButtons: PhaseButton[];
}

const DILEMMA_DEFS: Record<DilemmaType, DilemmaDef> = {
  SILVER_GAMBIT: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.silverGambitMachine),
    botSubmit: (actor, botIds) => botIds.map(senderId => {
      const action = Math.random() > 0.5 ? 'DONATE' : 'KEEP';
      actor.send({ type: DilemmaEvents.SILVER_GAMBIT.SUBMIT, senderId, action });
      return { event: DilemmaEvents.SILVER_GAMBIT.SUBMIT, payload: { senderId, action } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_DILEMMA }],
  },
  SPOTLIGHT: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.spotlightMachine),
    botSubmit: (actor, botIds, roster) => botIds.map(senderId => {
      const targets = Object.keys(roster).filter(id => id !== senderId);
      const targetId = targets[Math.floor(Math.random() * targets.length)];
      actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId, targetId });
      return { event: DilemmaEvents.SPOTLIGHT.SUBMIT, payload: { senderId, targetId } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_DILEMMA }],
  },
  GIFT_OR_GRIEF: {
    loadMachine: () => import('@pecking-order/cartridges').then(m => m.giftOrGriefMachine),
    botSubmit: (actor, botIds, roster) => botIds.map(senderId => {
      const targets = Object.keys(roster).filter(id => id !== senderId);
      const targetId = targets[Math.floor(Math.random() * targets.length)];
      const choice = Math.random() > 0.5 ? 'GIFT' : 'GRIEF';
      actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId, targetId, choice });
      return { event: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, payload: { senderId, targetId, choice } };
    }),
    phaseButtons: [{ label: 'Reveal', event: Events.Internal.END_DILEMMA }],
  },
};

// ---------------------------------------------------------------------------
// Mode metadata
// ---------------------------------------------------------------------------

const MODE_TYPES: Record<Mode, string[]> = {
  game: Object.keys(GAME_DEFS),
  voting: Object.keys(VOTING_DEFS),
  prompt: Object.keys(PROMPT_DEFS),
  dilemma: Object.keys(DILEMMA_DEFS),
};

const MODE_LABELS: Record<Mode, string> = {
  game: 'Games',
  voting: 'Voting',
  prompt: 'Prompts',
  dilemma: 'Dilemmas',
};

const DEFAULT_TYPE: Record<Mode, string> = {
  game: 'GAP_RUN',
  voting: 'MAJORITY',
  prompt: 'PLAYER_PICK',
  dilemma: 'SILVER_GAMBIT',
};

// ---------------------------------------------------------------------------
// Stub actions — replace sendParent so rootless actors don't throw.
// ---------------------------------------------------------------------------

function buildParentStubs(logEvent: (type: string, payload: any) => void) {
  const passthrough = (label: string) => (args: any) => {
    const ev = args?.event;
    logEvent(label, ev ? { eventType: ev.type } : {});
  };
  return {
    // Game cartridges
    emitSync: passthrough('FACT.GAME_ROUND'),
    emitRoundSync: passthrough('FACT.GAME_ROUND'),
    emitPlayerGameResult: ({ event }: any) => logEvent('CARTRIDGE.PLAYER_GAME_RESULT', { playerId: event?.playerId, silverReward: event?.silverReward }),
    emitDecisionFact: ({ event }: any) => logEvent('FACT.GAME_DECISION', { actorId: event?.senderId }),
    emitAllSubmitted: passthrough('FACT.ALL_SUBMITTED'),
    // Voting (per machine: emitVoteCastFact, emitTrustFact, emitEliminateFact, reportResults)
    emitVoteCastFact: ({ event }: any) => logEvent('FACT.VOTE_CAST', { actorId: event?.senderId, targetId: event?.targetId }),
    emitTrustFact: ({ event }: any) => logEvent('FACT.TRUST', { actorId: event?.senderId, targetId: event?.targetId }),
    emitEliminateFact: ({ event }: any) => logEvent('FACT.ELIMINATE', { actorId: event?.senderId, targetId: event?.targetId }),
    // Voting + game both call this on completion
    reportResults: ({ context }: any) => logEvent('FACT.RESULT', { type: context?.gameType ?? context?.voteType, silverRewards: context?.results?.silverRewards }),
    // Prompts (entry action on completed final state in all 6 machines)
    emitPromptResultFact: ({ context }: any) => logEvent('FACT.PROMPT_RESULT', { promptType: context?.promptType }),
    // Dilemmas (factory-shared name)
    emitResultFact: ({ context }: any) => logEvent('FACT.DILEMMA_RESULT', { dilemmaType: context?.dilemmaType }),
  };
}

// ---------------------------------------------------------------------------
// Projection per mode
// ---------------------------------------------------------------------------

async function projectByMode(mode: Mode, ctx: any): Promise<any> {
  if (!ctx) return null;
  if (mode === 'game') {
    const { projectGameCartridge } = await import('@pecking-order/game-cartridges');
    return projectGameCartridge(ctx, MOCK_PLAYER_ID);
  }
  if (mode === 'prompt') {
    const { projectPromptCartridge } = await import('@pecking-order/cartridges');
    return projectPromptCartridge(ctx);
  }
  if (mode === 'dilemma') {
    const { projectDilemmaCartridge } = await import('@pecking-order/cartridges');
    return projectDilemmaCartridge(ctx);
  }
  return ctx; // voting renders raw context
}

// ---------------------------------------------------------------------------
// Engine prop builder per mode
// ---------------------------------------------------------------------------

function buildEngine(mode: Mode, sendEvent: (type: string, payload?: Record<string, any>) => void) {
  switch (mode) {
    case 'game': return { sendGameAction: sendEvent };
    case 'voting': return { sendVoteAction: (type: string, targetId: string) => sendEvent(type, { targetId }) };
    case 'prompt': return { sendActivityAction: sendEvent };
    case 'dilemma': return { sendActivityAction: sendEvent };
  }
}

// ---------------------------------------------------------------------------
// Cartridge view per mode
// ---------------------------------------------------------------------------

const DilemmaCardLazy = lazy(() => import('../cartridges/dilemmas/DilemmaCard'));

interface CartridgeViewProps {
  mode: Mode;
  type: string;
  cartridge: any;
  engine: any;
  onDismiss: () => void;
}

function CartridgeView({ mode, type, cartridge, engine, onDismiss }: CartridgeViewProps) {
  if (mode === 'game') {
    const Component = GAME_DEFS[type as GameType].Component;
    return <Component cartridge={cartridge} playerId={MOCK_PLAYER_ID} roster={MOCK_ROSTER} engine={engine} onDismiss={onDismiss} />;
  }
  if (mode === 'voting') {
    const Component = VOTING_DEFS[type as VoteType].Component;
    return (
      <CartridgeStageContext.Provider value={{ staged: true }}>
        <Component cartridge={cartridge} playerId={MOCK_PLAYER_ID} roster={MOCK_ROSTER} engine={engine} />
      </CartridgeStageContext.Provider>
    );
  }
  if (mode === 'prompt') {
    const Component = PROMPT_DEFS[type as PromptType].Component;
    return (
      <CartridgeStageContext.Provider value={{ staged: true }}>
        <Component cartridge={cartridge} playerId={MOCK_PLAYER_ID} roster={MOCK_ROSTER} engine={engine} />
      </CartridgeStageContext.Provider>
    );
  }
  // dilemma
  return (
    <CartridgeStageContext.Provider value={{ staged: true }}>
      <DilemmaCardLazy engine={engine} />
    </CartridgeStageContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Per-mode actor input builder
// ---------------------------------------------------------------------------

function buildInput(mode: Mode, type: string, config: Record<string, any>): any {
  const base = { roster: MOCK_ROSTER, dayIndex: 1, gameId: 'DEV' };
  if (mode === 'game') {
    const def = GAME_DEFS[type as GameType];
    return { ...base, gameType: type, ...(def.defaultInput || {}), ...config };
  }
  if (mode === 'voting') return { ...base, voteType: type };
  if (mode === 'prompt') {
    const def = PROMPT_DEFS[type as PromptType];
    return { ...base, promptType: type, ...def.extraInput };
  }
  if (mode === 'dilemma') return { ...base, dilemmaType: type };
  return base;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GameDevHarness() {
  const [mode, setMode] = useState<Mode>('game');
  const [type, setType] = useState<string>(DEFAULT_TYPE.game);
  const [config, setConfig] = useState<Record<string, any>>(GAME_DEFS.GAP_RUN.defaultInput || {});
  const [cartridge, setCartridge] = useState<any>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [eventLogOpen, setEventLogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<AnyActorRef | null>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [eventLog]);

  const logEvent = useCallback((eventType: string, payload?: Record<string, any>, label?: string) => {
    setEventLog(prev => [...prev, { ts: Date.now(), type: eventType, payload, label }]);
  }, []);

  const reset = useCallback(async (m: Mode, t: string, cfg: Record<string, any>) => {
    if (actorRef.current) {
      actorRef.current.stop();
      actorRef.current = null;
    }
    setEventLog([]);
    setCartridge(null);
    setLoading(true);

    let machine: any;
    let extraActors: Record<string, any> = {};
    if (m === 'game') {
      const [mch, pkg] = await Promise.all([GAME_DEFS[t as GameType].loadMachine(), import('@pecking-order/game-cartridges')]);
      machine = mch;
      if (t === 'TRIVIA' || t === 'REALTIME_TRIVIA') {
        extraActors.fetchQuestions = fromPromise(async () => pkg.FALLBACK_QUESTIONS);
      }
    } else if (m === 'voting') machine = await VOTING_DEFS[t as VoteType].loadMachine();
    else if (m === 'prompt') machine = await PROMPT_DEFS[t as PromptType].loadMachine();
    else machine = await DILEMMA_DEFS[t as DilemmaType].loadMachine();

    setLoading(false);

    const stubs = buildParentStubs((eventType, payload) => logEvent(eventType, payload, 'Machine Event'));
    const provideConfig: any = { actions: stubs };
    if (Object.keys(extraActors).length > 0) provideConfig.actors = extraActors;
    if (m === 'game' && t === 'REALTIME_TRIVIA') {
      provideConfig.delays = { QUESTION_TIMER: cfg.questionTimer ?? 8000, RESULT_TIMER: 2000 };
    }

    const configured = (machine as any).provide(provideConfig);
    const input = buildInput(m, t, cfg);
    const actor = createActor(configured, { input });

    actor.subscribe(async (snap: Snapshot<any>) => {
      const ctx = (snap as any).context;
      if (!ctx) return;
      const projected = await projectByMode(m, ctx);
      if (!projected) return;
      // DilemmaCard reads from useGameStore — push BEFORE setCartridge so the
      // store has the data on the same render that mounts the component
      // (otherwise DilemmaCard's pre-existing hook-order bug fires: it calls
      // useCartridgeStage *after* an early return when activeDilemma is null).
      if (m === 'dilemma') {
        useGameStore.setState({
          activeDilemma: projected,
          playerId: MOCK_PLAYER_ID,
          roster: MOCK_ROSTER as any,
        });
      }
      setCartridge(projected);
    });

    actor.start();
    actorRef.current = actor;
  }, [logEvent]);

  useEffect(() => {
    reset(mode, type, config);
    return () => {
      if (actorRef.current) {
        actorRef.current.stop();
        actorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendEvent = useCallback((eventType: string, payload?: Record<string, any>) => {
    logEvent(eventType, payload, 'sendAction');
    // Default to the human player's senderId; let callers override (bot dispatch
    // can call sendEvent with an explicit senderId in the payload).
    actorRef.current?.send({ type: eventType, senderId: MOCK_PLAYER_ID, ...payload });
  }, [logEvent]);

  const engine = useMemo(() => buildEngine(mode, sendEvent), [mode, sendEvent]);

  const runBots = useCallback(() => {
    if (!actorRef.current) return;
    let results: Array<{ event: string; payload: any }> = [];
    if (mode === 'voting') results = VOTING_DEFS[type as VoteType].botCast(actorRef.current, BOT_IDS, MOCK_ROSTER);
    else if (mode === 'prompt') results = PROMPT_DEFS[type as PromptType].botSubmit(actorRef.current, BOT_IDS, MOCK_ROSTER);
    else if (mode === 'dilemma') results = DILEMMA_DEFS[type as DilemmaType].botSubmit(actorRef.current, BOT_IDS, MOCK_ROSTER);
    else if (mode === 'game') {
      const def = GAME_DEFS[type as GameType];
      if (!def.botPayload) return;
      results = BOT_IDS.map(senderId => {
        const payload = def.botPayload!();
        const eventType = Events.Game.event(type, 'SUBMIT');
        actorRef.current!.send({ type: eventType, senderId, ...payload });
        return { event: eventType, payload: { senderId, ...payload } };
      });
    }
    results.forEach(r => logEvent(r.event, r.payload, 'Bot'));
  }, [mode, type, logEvent]);

  const phaseButtons = useMemo<PhaseButton[]>(() => {
    if (mode === 'voting') return [{ label: 'Close Voting', event: Events.Internal.CLOSE_VOTING }];
    if (mode === 'prompt') return PROMPT_DEFS[type as PromptType].phaseButtons;
    if (mode === 'dilemma') return DILEMMA_DEFS[type as DilemmaType].phaseButtons;
    return [];
  }, [mode, type]);

  const sendPhaseEvent = useCallback((event: string) => {
    actorRef.current?.send({ type: event });
    logEvent(event, undefined, 'Phase');
  }, [logEvent]);

  const showGameKnobs = mode === 'game';
  const gameDef = mode === 'game' ? GAME_DEFS[type as GameType] : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern">
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex flex-wrap items-center gap-3 z-50">
        <h1 className="text-sm font-black font-display tracking-tighter text-skin-gold uppercase">
          Cartridge Dev Harness
        </h1>

        {/* Mode picker */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => {
                const newType = DEFAULT_TYPE[m];
                const newCfg = m === 'game' ? (GAME_DEFS[newType as GameType].defaultInput || {}) : {};
                setMode(m);
                setType(newType);
                setConfig(newCfg);
                reset(m, newType, newCfg);
              }}
              className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                mode === m ? 'bg-skin-gold/20 text-skin-gold' : 'text-skin-dim hover:text-skin-base'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Type picker */}
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value;
            const newCfg = mode === 'game' ? (GAME_DEFS[t as GameType].defaultInput || {}) : {};
            setType(t);
            setConfig(newCfg);
            reset(mode, t, newCfg);
          }}
          className="bg-skin-panel border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
        >
          {MODE_TYPES[mode].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Game knobs preserved from prior version */}
        {showGameKnobs && gameDef && (
          <>
            {'mode' in (gameDef.defaultInput || {}) && (
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                {(['SOLO', 'LIVE'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      const newCfg = { ...config, mode: m };
                      setConfig(newCfg);
                      reset(mode, type, newCfg);
                    }}
                    className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                      config.mode === m ? 'bg-skin-gold/20 text-skin-gold' : 'text-skin-dim hover:text-skin-base'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {!['TRIVIA', 'REALTIME_TRIVIA'].includes(type) && 'difficulty' in (gameDef.defaultInput || {}) && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Difficulty</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((config.difficulty ?? 0.2) * 100)}
                  onChange={(e) => setConfig({ ...config, difficulty: Number(e.target.value) / 100 })}
                  className="w-24 accent-[#ffd700]"
                />
                <span className="text-xs font-mono text-skin-base w-8 text-right">
                  {Math.round((config.difficulty ?? 0.2) * 100)}%
                </span>
              </div>
            )}
            {type === 'TRIVIA' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Rounds</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.roundCount ?? 5}
                  onChange={(e) => setConfig({ ...config, roundCount: Math.max(1, Number(e.target.value) || 5) })}
                  className="w-16 bg-skin-panel border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
                />
              </div>
            )}
            {type === 'REALTIME_TRIVIA' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Timer</label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={Math.round((config.questionTimer ?? 8000) / 1000)}
                  onChange={(e) => setConfig({ ...config, questionTimer: Math.max(3000, Number(e.target.value) * 1000 || 8000) })}
                  className="w-16 bg-skin-panel border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
                />
                <span className="text-[10px] font-mono text-skin-dim">sec</span>
              </div>
            )}
          </>
        )}

        {/* Bot button — voting/prompt/dilemma always; games only if def has botPayload */}
        {(mode !== 'game' || gameDef?.botPayload) && (
          <button
            onClick={runBots}
            className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs font-mono font-bold text-purple-400 uppercase tracking-wider hover:bg-purple-500/20 transition-colors"
          >
            Run Bots
          </button>
        )}

        {/* Phase advance buttons */}
        {phaseButtons.map(btn => (
          <button
            key={btn.event}
            onClick={() => sendPhaseEvent(btn.event)}
            className="px-4 py-1.5 bg-skin-gold/10 border border-skin-gold/30 rounded-lg text-xs font-mono font-bold text-skin-gold uppercase tracking-wider hover:bg-skin-gold/20 transition-colors"
          >
            {btn.label}
          </button>
        ))}

        {/* TOUCH_SCREEN-specific bot buttons */}
        {mode === 'game' && type === 'TOUCH_SCREEN' && (
          <>
            <button onClick={() => BOT_IDS.forEach(senderId => actorRef.current?.send({ type: TouchScreenEvents.READY, senderId }))} className="px-4 py-1.5 bg-skin-green/10 border border-skin-green/30 rounded-lg text-xs font-mono font-bold text-skin-green uppercase tracking-wider hover:bg-skin-green/20">Ready Bots</button>
            <button onClick={() => BOT_IDS.forEach(senderId => actorRef.current?.send({ type: TouchScreenEvents.TOUCH, senderId }))} className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-mono font-bold text-blue-400 uppercase tracking-wider hover:bg-blue-500/20">Touch Bots</button>
            <button onClick={() => actorRef.current?.send({ type: TouchScreenEvents.RELEASE, senderId: BOT_IDS[Math.floor(Math.random() * BOT_IDS.length)] })} className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-mono font-bold text-red-400 uppercase tracking-wider hover:bg-red-500/20">Release Bot</button>
          </>
        )}

        {mode === 'game' && (
          <button onClick={() => actorRef.current?.send({ type: Events.Internal.END_GAME })} className="px-4 py-1.5 bg-skin-gold/10 border border-skin-gold/30 rounded-lg text-xs font-mono font-bold text-skin-gold uppercase tracking-wider hover:bg-skin-gold/20">End Game</button>
        )}
        <button
          onClick={() => reset(mode, type, config)}
          className="px-4 py-1.5 bg-white/[0.06] border border-white/[0.1] rounded-lg text-xs font-mono font-bold text-skin-dim uppercase tracking-wider hover:bg-white/[0.1] hover:text-skin-base transition-colors"
        >
          Reset
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          {(loading || !cartridge) && (
            <div className="p-6 text-center">
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse mt-2">Loading machine...</p>
            </div>
          )}
          <Suspense fallback={
            <div className="p-6 text-center">
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse mt-2">Loading component...</p>
            </div>
          }>
            {cartridge && !loading && (
              <CartridgeView
                mode={mode}
                type={type}
                cartridge={cartridge}
                engine={engine}
                onDismiss={() => logEvent('UI', { action: 'dismiss' }, 'Dismiss')}
              />
            )}
          </Suspense>
        </div>
      </div>

      <div className={`shrink-0 border-t border-white/[0.06] bg-skin-panel/60 flex flex-col ${eventLogOpen ? 'h-48' : ''}`}>
        <button
          type="button"
          onClick={() => setEventLogOpen(v => !v)}
          className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] hover:bg-white/[0.03] cursor-pointer text-left"
        >
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest flex items-center gap-2">
            <span className="inline-block w-3 text-center">{eventLogOpen ? '▾' : '▸'}</span>
            Event Log
          </span>
          <span className="text-[10px] font-mono text-skin-dim">{eventLog.length} events</span>
        </button>
        {eventLogOpen && (
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 font-mono text-[11px]">
            {eventLog.length === 0 && (
              <p className="text-skin-dim/40 italic">No events yet.</p>
            )}
            {eventLog.map((entry, i) => {
              const time = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 } as any);
              const isMachineEvent = entry.label === 'Machine Event';
              const isUi = entry.label === 'Dismiss';
              return (
                <div key={i} className="flex gap-2">
                  <span className="text-skin-dim/40 shrink-0">{time}</span>
                  {entry.label && (
                    <span className={`shrink-0 px-1.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                      isMachineEvent ? 'bg-purple-500/20 text-purple-400' : isUi ? 'bg-blue-500/20 text-blue-400' : 'bg-skin-gold/20 text-skin-gold'
                    }`}>
                      {entry.label}
                    </span>
                  )}
                  <span className={`font-bold ${isMachineEvent ? 'text-purple-400' : 'text-skin-base'}`}>
                    {entry.type}
                  </span>
                  {entry.payload && Object.keys(entry.payload).length > 0 && (
                    <span className="text-skin-dim/60 truncate">
                      {JSON.stringify(entry.payload)}
                    </span>
                  )}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
