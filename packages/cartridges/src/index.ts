// Voting
export { VOTE_REGISTRY } from './voting/_registry';
export { majorityMachine } from './voting/majority-machine';
export { executionerMachine } from './voting/executioner-machine';
export { bubbleMachine } from './voting/bubble-machine';
export { podiumSacrificeMachine } from './voting/podium-sacrifice-machine';
export { secondToLastMachine } from './voting/second-to-last-machine';
export { shieldMachine } from './voting/shield-machine';
export { trustPairsMachine } from './voting/trust-pairs-machine';
export { finalsMachine } from './voting/finals-machine';
export type { BaseVoteContext, VoteEvent } from './voting/_contract';
export { getAlivePlayerIds, getTop3SilverIds, getEliminatedPlayerIds, getSilverRanking } from './voting/_helpers';

// Prompts
export { PROMPT_REGISTRY } from './prompts/_registry';
export { playerPickMachine } from './prompts/player-pick-machine';
export { predictionMachine } from './prompts/prediction-machine';
export { wyrMachine } from './prompts/wyr-machine';
export { hotTakeMachine } from './prompts/hot-take-machine';
export { confessionMachine } from './prompts/confession-machine';
export { guessWhoMachine } from './prompts/guess-who-machine';
export type { BasePromptContext, PromptResult, PromptEvent, PromptOutput } from './prompts/_contract';

// Dilemmas
export { DILEMMA_REGISTRY } from './dilemmas/_registry';
export { silverGambitMachine } from './dilemmas/silver-gambit';
export { spotlightMachine } from './dilemmas/spotlight';
export { giftOrGriefMachine } from './dilemmas/gift-or-grief';
export type { BaseDilemmaContext, DilemmaResults, DilemmaEvent } from './dilemmas/_contract';

// Projections
export { projectPromptCartridge, projectDilemmaCartridge, projectFactForClient } from './projections';
