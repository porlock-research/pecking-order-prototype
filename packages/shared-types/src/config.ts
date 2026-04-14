import type { PerkType } from './index';

export const Config = {
  dm: {
    maxPartnersPerDay: 3,
    maxCharsPerDay: 1200,
    silverCost: 1,
    maxGroupsPerDay: 3,
  },
  chat: {
    maxLogSize: 500,
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
    shockwave: {
      timeLimitMs: 60_000,
      scorePerSilver: 3,
      nearMissBonus: 5,
      scorePerGold: 15,
    },
    orbit: {
      timeLimitMs: 60_000,
      transfersPerSilver: 2,
      perfectsPerBonusSilver: 3,
      transfersPerGold: 10,
    },
    beatDrop: {
      timeLimitMs: 90_000,
      scorePerSilver: 500,
      perfectAccuracyBonus: 3,
      scorePerGold: 2500,
      startBpm: 80,
      endBpm: 140,
      maxLives: 3,
    },
    inflate: {
      timeLimitMs: 45_000,
      maxLives: 3,
      scorePerSilver: 250,
      perfectBankBonus: 2,
      scorePerGold: 1200,
    },
    snake: {
      timeLimitMs: 45_000,
      gridSize: 15,
      scorePerSilver: 4,
      lengthBonus: 3,
      scorePerGold: 20,
    },
    flappy: {
      timeLimitMs: 60_000,
      scorePerSilver: 3,
      coinBonus: 5,
      scorePerGold: 15,
    },
    colorSort: {
      timeLimitMs: 120_000,
      tubeCapacity: 4,
      colorsCount: 5,
      emptyTubes: 2,
      scorePerSilver: 20,
      solvedBonus: 5,
      scorePerGold: 100,
    },
    blink: {
      timeLimitMs: 30_000,
      scorePerSilver: 10,
      scorePerGold: 50,
      whitePenalty: 3,
      minStateMs: 220,
    },
    recall: {
      timeLimitMs: 90_000,
      startSize: 3,
      maxSize: 6,
      // Silver awarded cumulatively: 3×3=1, 4×4=2, 5×5=4, 6×6=8 → 15 total if cleared
      silverBySize: [0, 0, 0, 1, 2, 4, 8] as readonly number[],
      fullClearGold: 1,
    },
  },
  dilemma: {
    silverParticipation: 5,
    silverGambit: {
      donationCost: 5,
      jackpotMultiplier: 3,
    },
    spotlight: {
      unanimousReward: 20,
      participationReward: 5,
    },
    giftOrGrief: {
      giftAmount: 10,
      griefAmount: 10,
    },
  },
} as const;
