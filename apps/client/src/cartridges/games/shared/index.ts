// Per-game presentation tokens
export { GAME_INFO, getGameInfo, pickStatusLine } from './game-tokens';
export type { GameInfoEntry } from './game-tokens';

// Chassis primitives — all read --po-* contract, work in any shell,
// adapt when wrapped in CartridgeStageContext { staged: true }.
export { GameShell } from './GameShell';
export { GameHeader } from './GameHeader';
export { GameStartCard } from './GameStartCard';
export { GameCountdown } from './GameCountdown';
export { GameTimerBar } from './GameTimerBar';
export { GameDeadBeat } from './GameDeadBeat';
export { GameRetryDecision } from './GameRetryDecision';
export { GameResultHero } from './GameResultHero';
export { GameLeaderboard } from './GameLeaderboard';
export { GameSubmissionStatus } from './GameSubmissionStatus';
export { GameReadyRoster } from './GameReadyRoster';

// Surviving primitives (used inside playfields, not chrome)
export { AnimatedCounter } from './AnimatedCounter';
export { DifficultyBadge } from './DifficultyBadge';
export { OptionGrid } from './OptionGrid';
export { ResultFeedback } from './ResultFeedback';
