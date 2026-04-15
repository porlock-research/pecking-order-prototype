import type { CartridgeKind } from './push';

export interface CartridgeInfoEntry {
  kind: CartridgeKind;
  displayName: string;
  tagline: string;
  description: string;
  mechanics: string[];
}

/**
 * Authored v1 copy for every cartridge type. Keyed by the enum string
 * (VoteType | GameType | PromptType | DilemmaType).
 *
 * Shell-agnostic presentation data — any shell can render these splashes.
 * Missing keys fall back to a terse splash (displayName from typeKey only).
 *
 * Tone guide: reality-TV confidence, active voice, no filler. Mechanics
 * bullets are imperative ("Pick one player", not "A player is picked").
 */
export const CARTRIDGE_INFO: Record<string, CartridgeInfoEntry> = {
  // --- Voting (9) ---
  EXECUTIONER: {
    kind: 'voting',
    displayName: 'Executioner Vote',
    tagline: 'One vote. One execution. No mercy.',
    description:
      'Everyone votes in secret. The player with the most votes is eliminated on the spot. Ties go to the executioner — one player chosen at random.',
    mechanics: [
      'Every alive player casts one vote',
      'Highest vote count is eliminated',
      'Ties resolved by the random executioner',
      'Votes stay secret until the reveal',
    ],
  },
  MAJORITY: {
    kind: 'voting',
    displayName: 'Majority Vote',
    tagline: 'Over half, or nobody goes home.',
    description:
      'You need a clear majority to eliminate. Fall short and the day ends with everyone still in the game — for now.',
    mechanics: [
      'Every alive player casts one vote',
      'A strict majority is required to eliminate',
      'No majority → no elimination today',
      'Alliances either hold or crack in public',
    ],
  },
  BUBBLE: {
    kind: 'voting',
    displayName: 'Bubble Vote',
    tagline: 'Save someone. Doom someone else.',
    description:
      'Each player names one person to protect. The player with the fewest shields is the bubble — and bubbles pop.',
    mechanics: [
      'Vote for the player you want to SAVE',
      'Fewest save-votes is eliminated',
      'You cannot save yourself',
      'Shields stay secret until the reveal',
    ],
  },
  SECOND_TO_LAST: {
    kind: 'voting',
    displayName: 'Second-to-Last',
    tagline: 'Not the top. Not the bottom. The trap.',
    description:
      'The player with the second-highest vote count is eliminated. Leading means nothing — hiding in plain sight is everything.',
    mechanics: [
      'Every alive player casts one vote',
      'Second-highest vote count is eliminated',
      'Top vote-getter survives',
      'Ties at second resolved by random pick',
    ],
  },
  PODIUM_SACRIFICE: {
    kind: 'voting',
    displayName: 'Podium Sacrifice',
    tagline: 'Rank three. The top one burns.',
    description:
      'Everyone picks their top three threats in order. Points are assigned — and the player with the most points leaves the game.',
    mechanics: [
      'Pick 1st, 2nd, and 3rd place',
      '1st = 3 points, 2nd = 2, 3rd = 1',
      'Highest total is eliminated',
      'Partial rankings still count',
    ],
  },
  SHIELD: {
    kind: 'voting',
    displayName: 'Shield Vote',
    tagline: 'Elimination is normal. Immunity is not.',
    description:
      'The majority vote eliminates someone — unless the target has a shield. Shields are earned, stolen, or bought. Play accordingly.',
    mechanics: [
      'Every alive player casts one vote',
      'Highest vote count is the target',
      'If the target holds a shield, they survive',
      'Shields burn after one use',
    ],
  },
  TRUST_PAIRS: {
    kind: 'voting',
    displayName: 'Trust Pairs',
    tagline: 'Pick your partner. Hope they pick you.',
    description:
      'Everyone names the player they trust most. Mutual picks form a pair and survive. Lone picks are sitting ducks.',
    mechanics: [
      'Name one player you trust',
      'Mutual picks form safe pairs',
      'Unpaired players face elimination',
      'Highest vote among the unpaired goes home',
    ],
  },
  DUELS: {
    kind: 'voting',
    displayName: 'Duels',
    tagline: 'Pick a fight. Win or leave.',
    description:
      'Challenge another player head-to-head. The room picks a winner for each duel. Losers are eliminated; winners walk on.',
    mechanics: [
      'Challenge any alive player',
      'Audience votes the winner',
      'Losers are eliminated',
      'Unchallenged players are safe this round',
    ],
  },
  FINALS: {
    kind: 'voting',
    displayName: 'Finals',
    tagline: 'Last vote. One winner.',
    description:
      'The remaining players face a final jury vote. The player with the most jury votes wins the game. No elimination — a coronation.',
    mechanics: [
      'Eliminated players form the jury',
      'Each juror casts one vote for the winner',
      'Highest vote count wins',
      'Ties resolved by most silver at showdown',
    ],
  },

  // --- Games (25) ---
  TRIVIA: {
    kind: 'game',
    displayName: 'Trivia Blitz',
    tagline: 'Fastest right answer wins.',
    description:
      'Rapid-fire questions pulled from the cast\'s pre-game interviews. Speed matters as much as accuracy. Silver to the top three.',
    mechanics: [
      'Five rounds, one question each',
      'Pick from four answers',
      'Fastest correct answer scores most',
      'Top 3 split the silver pot',
    ],
  },
  REALTIME_TRIVIA: {
    kind: 'game',
    displayName: 'Live Trivia',
    tagline: 'Everyone answers at once. Fastest gets paid.',
    description:
      'Live simultaneous rounds — you see the scoreboard shift in real time. Pressure cooks the lead.',
    mechanics: [
      'All players answer the same question at once',
      'Faster correct answers score higher',
      'Wrong answers cost you time on the next one',
      'Running leaderboard displays between rounds',
    ],
  },
  GAP_RUN: {
    kind: 'game',
    displayName: 'Gap Run',
    tagline: 'Find the opening. Keep moving.',
    description:
      'Navigate a scrolling field of obstacles. Time the gaps — brush a wall and you\'re out.',
    mechanics: [
      'Swipe or drag to steer',
      'Pass through gaps to score',
      'Contact with obstacles ends your run',
      'Longest distance wins the round',
    ],
  },
  GRID_PUSH: {
    kind: 'game',
    displayName: 'Grid Push',
    tagline: 'Every push changes everything.',
    description:
      'Shove blocks on a shared grid. Line up your color to score. Disrupt rivals when you can — subtly is optional.',
    mechanics: [
      'Tap a direction to push a row or column',
      'Align 3+ of your color to score',
      'Opponent moves shift the board too',
      'Highest score at timeout wins',
    ],
  },
  SEQUENCE: {
    kind: 'game',
    displayName: 'Sequence',
    tagline: 'Watch. Remember. Repeat.',
    description:
      'A pattern flashes. Repeat it back exactly. Each round adds one more step — and one more chance to crack.',
    mechanics: [
      'Watch the pattern light up',
      'Tap the tiles in the same order',
      'Each correct round adds one step',
      'One mistake and you\'re out',
    ],
  },
  REACTION_TIME: {
    kind: 'game',
    displayName: 'Reaction Time',
    tagline: 'Tap the instant the light goes green.',
    description:
      'Pure reflex. Wait for the signal — tap early and you\'re disqualified, tap late and you lose the round.',
    mechanics: [
      'Watch the light',
      'Tap the instant it turns green',
      'Early taps disqualify the round',
      'Fastest clean reaction wins',
    ],
  },
  COLOR_MATCH: {
    kind: 'game',
    displayName: 'Color Match',
    tagline: 'Trust your eyes. Not the words.',
    description:
      'The word says one color. The ink is a different color. Tap the ink color, not the word. Fast.',
    mechanics: [
      'Read the ink, not the word',
      'Tap the matching color button',
      'Correct taps score',
      'Wrong taps cost time',
    ],
  },
  STACKER: {
    kind: 'game',
    displayName: 'Stacker',
    tagline: 'Timing is everything. Height is a bonus.',
    description:
      'Stack blocks precisely on top of each other. Every miss trims your base. Keep it tight or watch the tower crumble.',
    mechanics: [
      'Tap to drop the moving block',
      'Misaligned blocks lose their overhang',
      'Tower collapses when the base runs out',
      'Highest stack wins',
    ],
  },
  QUICK_MATH: {
    kind: 'game',
    displayName: 'Quick Math',
    tagline: 'Numbers. Pressure. Go.',
    description:
      'Simple equations at speed. Tap the right answer before the timer catches you.',
    mechanics: [
      'Read the equation',
      'Tap the correct answer from four options',
      'Correct answers extend the round',
      'Most solved at timeout wins',
    ],
  },
  SIMON_SAYS: {
    kind: 'game',
    displayName: 'Simon Says',
    tagline: 'Follow the pattern. Don\'t miss a beat.',
    description:
      'A classic memory game with a reality-TV twist — the patterns tie to cast events. Miss a step and you\'re done.',
    mechanics: [
      'Watch the pattern',
      'Repeat it in order',
      'Each round grows by one',
      'Perfect runs compound silver',
    ],
  },
  AIM_TRAINER: {
    kind: 'game',
    displayName: 'Aim Trainer',
    tagline: 'Targets pop. You pop them faster.',
    description:
      'Tap as many targets as you can before the timer runs out. Small targets, big targets, moving targets — they all pay differently.',
    mechanics: [
      'Tap targets to score',
      'Smaller targets = more points',
      'Missed taps waste time',
      'Highest total at timeout wins',
    ],
  },
  BET_BET_BET: {
    kind: 'game',
    displayName: 'Bet Bet Bet',
    tagline: 'Three bets. One truth. Read the room.',
    description:
      'Place bets on cast claims — which are true, which are bluffs. Confidence pays off. Overconfidence bankrupts.',
    mechanics: [
      'Read each claim',
      'Bet silver on TRUE or BLUFF',
      'Higher bets = higher rewards',
      'Bad calls burn the pot',
    ],
  },
  BLIND_AUCTION: {
    kind: 'game',
    displayName: 'Blind Auction',
    tagline: 'Bid without seeing. Pay without regret.',
    description:
      'Mystery prizes up for bid. You write your number in secret. Highest bidder wins — and pays exactly what they wrote.',
    mechanics: [
      'Prize hints are revealed',
      'Submit your secret bid',
      'Highest bid wins and pays',
      'Ties resolved by earliest bid',
    ],
  },
  KINGS_RANSOM: {
    kind: 'game',
    displayName: 'King\'s Ransom',
    tagline: 'Hold the throne. Hope nobody notices.',
    description:
      'One player holds the ransom. Others pool silver to steal it. Every round the temptation grows — and the risk.',
    mechanics: [
      'One player starts as king',
      'Challengers contribute silver to a pot',
      'If the pot exceeds the throne\'s value, the king is toppled',
      'Survive three rounds to keep it all',
    ],
  },
  THE_SPLIT: {
    kind: 'game',
    displayName: 'The Split',
    tagline: 'Split or steal. Trust is everything.',
    description:
      'Two players. One pot. Both pick SPLIT and share. One picks STEAL and takes it all. Both pick STEAL and nobody wins.',
    mechanics: [
      'Two players are paired',
      'Each chooses SPLIT or STEAL',
      'SPLIT + SPLIT → share the pot',
      'STEAL + SPLIT → stealer takes all',
      'STEAL + STEAL → pot vanishes',
    ],
  },
  TOUCH_SCREEN: {
    kind: 'game',
    displayName: 'Touch Screen',
    tagline: 'Keep a finger on the glass. Don\'t let go.',
    description:
      'Last finger touching wins. Simple rules — until the distractions start. Pop-ups, wiggles, fake prompts. Hold fast.',
    mechanics: [
      'Press and hold the screen',
      'Release = you\'re out',
      'Distractions will test your grip',
      'Last player holding wins',
    ],
  },
  SHOCKWAVE: {
    kind: 'game',
    displayName: 'Shockwave',
    tagline: 'Dodge contracting rings in a neon arena.',
    description:
      'The arena shrinks. You don\'t. Weave between closing rings and outlast everyone else inside the shrinking circle.',
    mechanics: [
      'Drag to move your avatar',
      'Avoid the contracting rings',
      'Ring contact ends your run',
      'Last survivor wins the round',
    ],
  },
  ORBIT: {
    kind: 'game',
    displayName: 'Orbit',
    tagline: 'Slingshot between gravity wells.',
    description:
      'Use planetary pull to sling yourself between targets. Miss the pull and you drift into the void. Nail the curve and silver rains.',
    mechanics: [
      'Tap to release from the current orbit',
      'Gravity bends your trajectory',
      'Collect checkpoints in order',
      'Fastest clean orbit wins',
    ],
  },
  BEAT_DROP: {
    kind: 'game',
    displayName: 'Beat Drop',
    tagline: 'Tap on the beat. Miss and you\'re out.',
    description:
      'A rhythm game tied to the music. Hit the beats as they come — early or late, you lose the combo. Perfect runs pay the most.',
    mechanics: [
      'Tap on the beat',
      'Perfect, Good, or Miss',
      'Misses break your combo',
      'Highest combo score wins',
    ],
  },
  INFLATE: {
    kind: 'game',
    displayName: 'Inflate',
    tagline: 'Pump it up. Don\'t pop.',
    description:
      'Press and hold to inflate. Release to cash in. Every extra moment pays more — but push one pump too far and it bursts.',
    mechanics: [
      'Press and hold to inflate',
      'Release to bank your score',
      'Longer holds pay exponentially',
      'Burst = you lose the round',
    ],
  },
  SNAKE: {
    kind: 'game',
    displayName: 'Snake',
    tagline: 'Grow longer. Don\'t eat yourself.',
    description:
      'The classic. Eat the dots. Every bite makes you longer — and harder to maneuver. Run into your own tail and it\'s over.',
    mechanics: [
      'Swipe to change direction',
      'Eat dots to grow',
      'Don\'t hit walls or yourself',
      'Longest snake wins',
    ],
  },
  FLAPPY: {
    kind: 'game',
    displayName: 'Flappy',
    tagline: 'Tap to fly. Gravity is unforgiving.',
    description:
      'Tap to keep your bird aloft. Thread the gaps. Every pipe you clear is one more than the players who folded.',
    mechanics: [
      'Tap to flap upward',
      'Gravity pulls you down',
      'Pass between pipes to score',
      'Furthest distance wins',
    ],
  },
  COLOR_SORT: {
    kind: 'game',
    displayName: 'Color Sort',
    tagline: 'Pour the colors into neat stacks.',
    description:
      'Pour liquids between vials until each vial holds one color. Sounds simple. Spills are permanent.',
    mechanics: [
      'Tap a vial, then tap a target',
      'Pours only land if colors match',
      'Sort every vial to solve',
      'Fewest moves wins',
    ],
  },
  BLINK: {
    kind: 'game',
    displayName: 'Blink',
    tagline: 'Don\'t blink. Or do. Hard to say.',
    description:
      'Focus on the screen. Something flashes — a word, a face, a number. Did you see it? Tap what you saw before it\'s gone for good.',
    mechanics: [
      'Watch the screen closely',
      'Brief flashes reveal targets',
      'Tap what you saw from the options',
      'Accuracy and speed both score',
    ],
  },
  RECALL: {
    kind: 'game',
    displayName: 'Recall',
    tagline: 'Memorize everything. Then prove it.',
    description:
      'A scene fills the screen — faces, items, positions. It vanishes. Now answer questions about what you saw.',
    mechanics: [
      'Study the scene while it\'s visible',
      'Scene disappears after a beat',
      'Answer questions from memory',
      'Top scorers split the pot',
    ],
  },

  // --- Prompts (6) ---
  PLAYER_PICK: {
    kind: 'prompt',
    displayName: 'Player Pick',
    tagline: 'Name one. Everyone sees.',
    description:
      'Answer the question by naming a player. Your pick is public. Agreements form; grudges remember.',
    mechanics: [
      'Read the prompt',
      'Pick one player from the cast',
      'All picks are revealed together',
      'Most-picked player gets a spotlight moment',
    ],
  },
  PREDICTION: {
    kind: 'prompt',
    displayName: 'Prediction',
    tagline: 'Call the future. Cash in if you\'re right.',
    description:
      'Bet on what happens next in the game. Correct predictions pay silver when the moment arrives.',
    mechanics: [
      'Read the prediction prompt',
      'Submit your answer',
      'Answers stay hidden until payoff',
      'Correct predictions earn silver later',
    ],
  },
  WOULD_YOU_RATHER: {
    kind: 'prompt',
    displayName: 'Would You Rather',
    tagline: 'Pick your poison.',
    description:
      'An impossible choice. Your answer is public. Disagreements start fights — which is the point.',
    mechanics: [
      'Read the two options',
      'Pick one (you cannot abstain)',
      'Answers revealed to everyone',
      'Discuss in chat — silver for the loudest takes',
    ],
  },
  HOT_TAKE: {
    kind: 'prompt',
    displayName: 'Hot Take',
    tagline: 'Spicy opinions only.',
    description:
      'Write a one-liner opinion on the prompt. The cast votes on the spiciest take. Winner takes silver.',
    mechanics: [
      'Read the prompt',
      'Submit a one-line take',
      'Cast votes for the spiciest',
      'Top take wins the silver pot',
    ],
  },
  CONFESSION: {
    kind: 'prompt',
    displayName: 'Confession',
    tagline: 'Say it anonymous. We\'ll all guess.',
    description:
      'Submit an anonymous confession in response to the prompt. Then the cast guesses who said what.',
    mechanics: [
      'Submit an anonymous answer',
      'All answers revealed without names',
      'Vote on who wrote each one',
      'Correct guesses and hidden authors both score',
    ],
  },
  GUESS_WHO: {
    kind: 'prompt',
    displayName: 'Guess Who',
    tagline: 'Which cast member? Read the clues.',
    description:
      'Clues describe one player — from their bio, their history, their choices. Pick the match before time runs out.',
    mechanics: [
      'Read the clues as they appear',
      'Pick the cast member they describe',
      'Faster correct guesses score more',
      'Top guessers split the silver pot',
    ],
  },

  // --- Dilemmas (3) ---
  SILVER_GAMBIT: {
    kind: 'dilemma',
    displayName: 'Silver Gambit',
    tagline: 'Keep it all or split it all.',
    description:
      'You and one other player are offered a pot of silver. Both cooperate and split it evenly. One defects and takes it all. Both defect and nobody wins.',
    mechanics: [
      'Two players paired in secret',
      'Each chooses: SPLIT or STEAL',
      'SPLIT + SPLIT → even share',
      'STEAL + SPLIT → stealer takes all',
      'STEAL + STEAL → pot vanishes',
    ],
  },
  SPOTLIGHT: {
    kind: 'dilemma',
    displayName: 'Spotlight',
    tagline: 'Step into the light. Or push someone else.',
    description:
      'Nominate yourself for the spotlight — risk and reward scale with how many nominate. Push someone else to take the hit.',
    mechanics: [
      'Choose: step forward or push a rival',
      'Spotlight outcome depends on who chooses what',
      'Brave picks can win big or lose everything',
      'Push picks share the consequence',
    ],
  },
  GIFT_OR_GRIEF: {
    kind: 'dilemma',
    displayName: 'Gift or Grief',
    tagline: 'Send a blessing. Or a curse.',
    description:
      'Secretly hand the target a boost — or a setback. They find out what you sent, but not necessarily who.',
    mechanics: [
      'Pick one target player',
      'Choose GIFT (silver to them) or GRIEF (silver from them)',
      'The target sees the outcome, not the sender',
      'Multiple senders compound the effect',
    ],
  },
};
