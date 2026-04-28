/**
 * Game (mini-game) type descriptions — shell-agnostic reference data.
 * Any shell can import and render these to explain game mechanics to players.
 *
 * Source of truth for the lobby's selectable game-type list. Adding a new
 * cartridge to GAME_REGISTRY requires a corresponding entry here (per
 * packages/game-cartridges/CLAUDE.md 10-point checklist) — once present,
 * the lobby chip is derived automatically.
 */
import type { GameType } from './index';

export type GameCategory = 'arcade' | 'knowledge' | 'social';

export interface GameTypeInfo {
  name: string;
  description: string;
  category: GameCategory;
}

export const GAME_TYPE_INFO: Record<Exclude<GameType, 'NONE'>, GameTypeInfo> = {
  TRIVIA:          { name: 'Trivia',          description: 'Answer questions fast to earn silver',                            category: 'knowledge' },
  REALTIME_TRIVIA: { name: 'Live Trivia',     description: 'Speed-based trivia with live scoring',                            category: 'knowledge' },
  GAP_RUN:         { name: 'Gap Run',         description: 'Navigate through the gaps to survive',                            category: 'arcade'    },
  GRID_PUSH:       { name: 'Grid Push',       description: 'Push blocks on the grid strategically',                           category: 'arcade'    },
  SEQUENCE:        { name: 'Sequence',        description: 'Repeat the pattern from memory',                                  category: 'arcade'    },
  REACTION_TIME:   { name: 'Reaction Time',   description: 'Test your reflexes — fastest wins',                               category: 'arcade'    },
  COLOR_MATCH:     { name: 'Color Match',     description: 'Match the right colors fast',                                     category: 'arcade'    },
  STACKER:         { name: 'Stacker',         description: 'Stack blocks with precision',                                     category: 'arcade'    },
  QUICK_MATH:      { name: 'Quick Math',      description: 'Solve equations under pressure',                                  category: 'arcade'    },
  SIMON_SAYS:      { name: 'Simon Says',      description: 'Follow the pattern, don\'t miss a beat',                          category: 'arcade'    },
  AIM_TRAINER:     { name: 'Aim Trainer',     description: 'Hit targets accurately and fast',                                 category: 'arcade'    },
  TOUCH_SCREEN:    { name: 'Touch Screen',    description: 'Tap your way to victory',                                         category: 'social'    },
  BET_BET_BET:     { name: 'Bet Bet Bet',     description: 'Place your bets wisely',                                          category: 'social'    },
  BLIND_AUCTION:   { name: 'Blind Auction',   description: 'Bid without seeing others\' bets',                                category: 'social'    },
  KINGS_RANSOM:    { name: 'King\'s Ransom',  description: 'A royal risk-reward gamble',                                      category: 'social'    },
  THE_SPLIT:       { name: 'The Split',       description: 'Split or steal — trust is everything',                            category: 'social'    },
  SHOCKWAVE:       { name: 'Shockwave',       description: 'Dodge contracting rings in a neon arena',                         category: 'arcade'    },
  ORBIT:           { name: 'Orbit',           description: 'Slingshot between gravity wells — timing is everything',          category: 'arcade'    },
  BEAT_DROP:       { name: 'Beat Drop',       description: 'Hit notes on the beat, build combos, don\'t miss',                category: 'arcade'    },
  INFLATE:         { name: 'Inflate',         description: 'Push your luck, don\'t pop',                                      category: 'arcade'    },
  SNAKE:           { name: 'Snake',           description: 'Eat pellets, grow your snake, don\'t crash',                      category: 'arcade'    },
  FLAPPY:          { name: 'Flappy',          description: 'Tap to flap, thread the gaps, grab coins',                        category: 'arcade'    },
  COLOR_SORT:      { name: 'Color Sort',      description: 'Sort balls into matching tubes',                                  category: 'arcade'    },
  BLINK:           { name: 'Blink',           description: 'Tap on black, freeze on white — the flash is a trap',             category: 'arcade'    },
  RECALL:          { name: 'Recall',          description: 'Memorize the grid. Tap the numbers in order from memory',         category: 'arcade'    },
};
