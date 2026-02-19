import type { PerkType } from './index';

export const Config = {
  dm: {
    maxPartnersPerDay: 3,
    maxCharsPerDay: 1200,
    silverCost: 1,
    maxGroupsPerDay: 3,
  },
  chat: {
    maxLogSize: 50,
    maxMessageLength: 280,
  },
  perk: {
    costs: { SPY_DMS: 5, EXTRA_DM_PARTNER: 3, EXTRA_DM_CHARS: 2 } as Record<PerkType, number>,
    extraCharsBonus: 600,
  },
  prompt: {
    silverParticipation: 5,
    silverMutualBonus: 10,
    silverConsensusBonus: 10,
    silverMinorityBonus: 10,
    confession: {
      silverSubmit: 5,
      silverVote: 5,
      silverWinner: 15,
    },
    guessWho: {
      silverPerCorrectGuess: 5,
      silverPerFooled: 5,
    },
  },
  game: {
    arcade: {
      maxSilver: 15,
      defaultTimeLimitMs: 45_000,
      difficultyScalePerDay: 0.15,
    },
    gapRun: {
      timeLimitMs: 45_000,
      maxDistanceSilver: 15,
      survivalBonus: 5,
      distancePerSilver: 100,
      survivalGraceMs: 1_000,
      distancePerGold: 500,
    },
    gridPush: {
      timeLimitMs: 180_000,
      scorePerSilver: 5,
      scorePerGold: 25,
    },
    colorMatch: {
      timeLimitMs: 60_000,
      correctPerGold: 5,
    },
    reactionTime: {
      timeLimitMs: 60_000,
      roundsPerGold: 3,
    },
    sequence: {
      timeLimitMs: 180_000,
      silverPerRound: 2,
      roundsPerGold: 3,
    },
    simonSays: {
      timeLimitMs: 180_000,
      silverPerRound: 2,
      roundsPerGold: 3,
    },
    quickMath: {
      timeLimitMs: 90_000,
      streakPerBonus: 3,
      correctPerGold: 4,
    },
    aimTrainer: {
      timeLimitMs: 60_000,
      scorePerSilver: 10,
      scorePerGold: 50,
    },
    stacker: {
      timeLimitMs: 120_000,
      layersPerGold: 3,
    },
    trivia: {
      totalRounds: 5,
      questionTimeMs: 15_000,
      baseSilver: 2,
      maxSpeedBonus: 3,
      perfectBonus: 5,
      goldPerCorrect: 1,
      questionPoolSize: 50,
      networkGraceMs: 1_000,
      resultDisplayMs: 3_000,
    },
    touchScreen: {
      readyTimeoutMs: 15_000,
      countdownMs: 3_000,
      maxHoldTimeMs: 300_000,
      silverByRank: [15, 10, 7, 3] as readonly number[],
      msPerGoldUnit: 5_000,
    },
    blindAuction: {
      prizePool: [5, 10, 15, 20] as readonly number[],
      prizeSlots: 3,
    },
    betBetBet: {
      tiePenaltyMultiplier: 5,
    },
    kingsRansom: {
      vaultMinimum: 10,
      vaultFraction: 0.3,
    },
    theSplit: {
      basePot: 5,
      potIncrement: 5,
      revealDurationMs: 8_000,
      winnerBonus: 10,
    },
  },
} as const;
