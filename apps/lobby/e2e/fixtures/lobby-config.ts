export interface LobbyTestConfig {
  mode: 'debug' | 'static' | 'dynamic';
  days: number;
  vote: string;
  game: string;
  activity: string;
  schedulePreset: 'DEFAULT' | 'COMPACT' | 'SPEED_RUN';
  startTime: string;
  votePool: string[];
  gamePool: string[];
  activityPool: string[];
  maxPlayers: number;
  maxDays: number;
  dmInvite: boolean;
  dmChars: number;
  dmSlots: number;
  dmCost: number;
  inactivityEnabled: boolean;
}

const ALL_VOTE_TYPES = ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'SECOND_TO_LAST', 'PODIUM_SACRIFICE', 'SHIELD', 'TRUST_PAIRS'];
const ALL_GAME_TYPES = ['TRIVIA', 'GAP_RUN', 'GRID_PUSH', 'SEQUENCE', 'REACTION_TIME', 'COLOR_MATCH', 'STACKER', 'QUICK_MATH', 'SIMON_SAYS', 'AIM_TRAINER', 'BET_BET_BET', 'BLIND_AUCTION', 'KINGS_RANSOM', 'THE_SPLIT', 'TOUCH_SCREEN', 'REALTIME_TRIVIA'];
const ALL_ACTIVITY_TYPES = ['PLAYER_PICK', 'PREDICTION', 'WOULD_YOU_RATHER', 'HOT_TAKE', 'CONFESSION', 'GUESS_WHO'];

function parseList(env: string | undefined, defaults: string[]): string[] {
  if (!env) return defaults;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

export function getTestConfig(): LobbyTestConfig {
  return {
    mode: (process.env.LOBBY_TEST_MODE as LobbyTestConfig['mode']) || 'debug',
    days: parseInt(process.env.LOBBY_TEST_DAYS || '2', 10),
    vote: process.env.LOBBY_TEST_VOTE || 'MAJORITY',
    game: process.env.LOBBY_TEST_GAME || '',
    activity: process.env.LOBBY_TEST_ACTIVITY || '',
    schedulePreset: (process.env.LOBBY_TEST_PRESET as LobbyTestConfig['schedulePreset']) || 'COMPACT',
    startTime: process.env.LOBBY_TEST_START_TIME || '',
    votePool: parseList(process.env.LOBBY_TEST_VOTE_POOL, ALL_VOTE_TYPES),
    gamePool: parseList(process.env.LOBBY_TEST_GAME_POOL, ALL_GAME_TYPES),
    activityPool: parseList(process.env.LOBBY_TEST_ACTIVITY_POOL, ALL_ACTIVITY_TYPES),
    maxPlayers: parseInt(process.env.LOBBY_TEST_MAX_PLAYERS || '8', 10),
    maxDays: parseInt(process.env.LOBBY_TEST_MAX_DAYS || '7', 10),
    dmInvite: process.env.LOBBY_TEST_DM_INVITE === '1',
    dmChars: parseInt(process.env.LOBBY_TEST_DM_CHARS || '300', 10),
    dmSlots: parseInt(process.env.LOBBY_TEST_DM_SLOTS || '3', 10),
    dmCost: parseInt(process.env.LOBBY_TEST_DM_COST || '1', 10),
    inactivityEnabled: process.env.LOBBY_TEST_INACTIVITY !== '0',
  };
}
