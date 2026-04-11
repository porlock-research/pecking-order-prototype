/**
 * Game (mini-game) type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain game mechanics to players.
 */
import type { GameType } from './index';

export interface GameTypeInfo {
  name: string;
  description: string;
}

export const GAME_TYPE_INFO: Record<Exclude<GameType, 'NONE'>, GameTypeInfo> = {
  TRIVIA:          { name: 'Trivia',          description: 'Answer questions fast to earn silver' },
  REALTIME_TRIVIA: { name: 'Live Trivia',     description: 'Speed-based trivia with live scoring' },
  GAP_RUN:         { name: 'Gap Run',         description: 'Navigate through the gaps to survive' },
  GRID_PUSH:       { name: 'Grid Push',       description: 'Push blocks on the grid strategically' },
  SEQUENCE:        { name: 'Sequence',        description: 'Repeat the pattern from memory' },
  REACTION_TIME:   { name: 'Reaction Time',   description: 'Test your reflexes — fastest wins' },
  COLOR_MATCH:     { name: 'Color Match',     description: 'Match the right colors fast' },
  STACKER:         { name: 'Stacker',         description: 'Stack blocks with precision' },
  QUICK_MATH:      { name: 'Quick Math',      description: 'Solve equations under pressure' },
  SIMON_SAYS:      { name: 'Simon Says',      description: 'Follow the pattern, don\'t miss a beat' },
  AIM_TRAINER:     { name: 'Aim Trainer',     description: 'Hit targets accurately and fast' },
  TOUCH_SCREEN:    { name: 'Touch Screen',    description: 'Tap your way to victory' },
  BET_BET_BET:     { name: 'Bet Bet Bet',     description: 'Place your bets wisely' },
  BLIND_AUCTION:   { name: 'Blind Auction',   description: 'Bid without seeing others\' bets' },
  KINGS_RANSOM:    { name: 'King\'s Ransom',  description: 'A royal risk-reward gamble' },
  THE_SPLIT:       { name: 'The Split',       description: 'Split or steal — trust is everything' },
  SHOCKWAVE:       { name: 'Shockwave',      description: 'Dodge contracting rings in a neon arena' },
  ORBIT:           { name: 'Orbit',           description: 'Slingshot between gravity wells — timing is everything' },
  BEAT_DROP:       { name: 'Beat Drop',       description: 'Hit notes on the beat, build combos, don\'t miss' },
  RIPPLE:          { name: 'Ripple',          description: 'Drop stones, ride the waves' },
  BOUNCE:          { name: 'Bounce',          description: 'Draw platforms, nail the target' },
  INFLATE:         { name: 'Inflate',         description: 'Push your luck, don\'t pop' },
  SWITCHBOARD:     { name: 'Switchboard',     description: 'Flip, slide, dial — fast' },
  FLOCK:           { name: 'Flock',           description: 'Herd your swarm through gates' },
  SCULPTOR:        { name: 'Sculptor',        description: 'Carve the shape, match the target' },
  CODEBREAKER:     { name: 'Codebreaker',     description: 'Crack the code before time runs out' },
};
