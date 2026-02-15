/**
 * Reaction Time Machine
 *
 * Reflex minigame. Player waits for a color change, taps as fast as possible.
 * Multiple rounds, score = average reaction time (lower = better silver).
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 60_000;
const MAX_SILVER = 15;

export const reactionTimeMachine = createArcadeMachine({
  gameType: 'REACTION_TIME',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const avgMs = result.avgReactionMs || 9999;
    const rounds = result.roundsCompleted || 0;
    if (rounds === 0) return { silver: 0, gold: 0 };
    // Faster = more silver: <200ms = 15, <250ms = 12, <300ms = 10, etc.
    let silver = 0;
    if (avgMs < 200) silver = 15;
    else if (avgMs < 250) silver = 12;
    else if (avgMs < 300) silver = 10;
    else if (avgMs < 350) silver = 8;
    else if (avgMs < 400) silver = 6;
    else if (avgMs < 500) silver = 4;
    else if (avgMs < 700) silver = 2;
    else silver = 1;
    silver = Math.min(MAX_SILVER, silver);
    const gold = Math.floor(rounds / 3);
    return { silver, gold };
  },
});
