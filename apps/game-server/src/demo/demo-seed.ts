/**
 * Demo Seed — generates a pre-seeded mid-game fixture for UI testing.
 *
 * Uses real PersonaPool personas, real manifest types, and pre-populated
 * history so the client can't distinguish demo from a real game.
 */
import type { VoteType, GameType } from '@pecking-order/shared-types';

// 6 real personas from PersonaPool (apps/lobby/migrations/0004_revamp_persona_pool.sql)
// Avatar URLs resolved at runtime from PERSONA_ASSETS_URL env var.
const STAGING_ASSETS = 'https://staging-assets.peckingorder.ca';

const PERSONA_DEFS = [
  { id: 'p0', personaId: 'persona-19', personaName: 'Skyler Blue', stereotype: 'The Party Animal' },
  { id: 'p1', personaId: 'persona-01', personaName: 'Bella Rossi', stereotype: 'The Influencer' },
  { id: 'p2', personaId: 'persona-02', personaName: 'Chad Brock', stereotype: 'The Showmance' },
  { id: 'p3', personaId: 'persona-09', personaName: 'Brenda Burns', stereotype: 'The Villain' },
  { id: 'p4', personaId: 'persona-13', personaName: 'Jax Cash', stereotype: 'The Tech Bro' },
  { id: 'p5', personaId: 'persona-22', personaName: 'Raven Thorne', stereotype: 'The Goth Rebel' },
] as const;

/**
 * Build avatar URL matching the lobby's personaImageUrl() pattern:
 * - CDN (staging/prod): {base}/personas/{id}/headshot.png
 * - Lobby API (local dev): {base}/{id}/headshot.png
 */
function buildPersonaAvatarUrl(personaId: string, assetsBase: string): string {
  if (assetsBase.includes('/api/persona-image')) {
    return `${assetsBase}/${personaId}/headshot.png`;
  }
  return `${assetsBase}/personas/${personaId}/headshot.png`;
}

export function getDemoPersonas(assetsBase: string = STAGING_ASSETS) {
  return PERSONA_DEFS.map(p => ({
    ...p,
    avatarUrl: buildPersonaAvatarUrl(p.personaId, assetsBase),
  }));
}

export interface DemoSeed {
  gameId: string;
  dayIndex: number;
  roster: Record<string, any>;
  manifest: any; // StaticManifest shape
  chatLog: any[];
  channels: Record<string, any>;
  completedPhases: any[];
  gameHistory: any[];
  goldPool: number;
  winner: null;
}

/** Build a mid-game fixture: Day 3 of 5, 2 players eliminated, rich history. */
export function buildDemoSeed(gameId: string = 'DEMO', assetsBase?: string): DemoSeed {
  const now = Date.now();
  const personas = getDemoPersonas(assetsBase);

  // Roster: p0-p3 alive, p4-p5 eliminated
  const roster: Record<string, any> = {};
  for (const p of personas) {
    const isEliminated = p.id === 'p4' || p.id === 'p5';
    roster[p.id] = {
      id: p.id,
      realUserId: `demo-${p.id}`,
      personaName: p.personaName,
      avatarUrl: p.avatarUrl,
      bio: p.stereotype,
      isAlive: !isEliminated,
      isSpectator: isEliminated,
      status: isEliminated ? 'ELIMINATED' : 'ALIVE',
      silver: isEliminated ? 12 : (30 + Math.floor(Math.random() * 40)),
      gold: 0,
      destinyId: null,
    };
  }

  // Manifest: 5 days, real vote/game types
  const manifest = {
    kind: 'STATIC' as const,
    id: `manifest-${gameId}`,
    gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED' as const,
    days: [
      { dayIndex: 1, theme: 'First Impressions', voteType: 'MAJORITY' as VoteType, gameType: 'TRIVIA' as GameType, timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 },
      { dayIndex: 2, theme: 'Alliances Form', voteType: 'BUBBLE' as VoteType, gameType: 'BLIND_AUCTION' as GameType, timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 },
      { dayIndex: 3, theme: 'Betrayal', voteType: 'EXECUTIONER' as VoteType, gameType: 'BET_BET_BET' as GameType, timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 },
      { dayIndex: 4, theme: 'Desperate Moves', voteType: 'PODIUM_SACRIFICE' as VoteType, gameType: 'THE_SPLIT' as GameType, timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 },
      { dayIndex: 5, theme: 'The Finale', voteType: 'FINALS' as VoteType, gameType: 'KINGS_RANSOM' as GameType, timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 },
    ],
    pushConfig: {},
  };

  // Completed phases for days 1-2
  const completedPhases = [
    {
      kind: 'voting', dayIndex: 1, mechanism: 'MAJORITY',
      eliminatedId: 'p4', completedAt: now - 86400000 * 2,
      results: { votes: { p0: 'p4', p1: 'p4', p2: 'p3', p3: 'p4', p4: 'p0', p5: 'p3' } },
    },
    {
      kind: 'game', dayIndex: 1, gameType: 'TRIVIA',
      completedAt: now - 86400000 * 2 + 3600000,
      results: { rankings: [{ playerId: 'p0', score: 8 }, { playerId: 'p1', score: 6 }, { playerId: 'p2', score: 5 }, { playerId: 'p3', score: 7 }] },
    },
    {
      kind: 'voting', dayIndex: 2, mechanism: 'BUBBLE',
      eliminatedId: 'p5', completedAt: now - 86400000,
      results: { votes: { p0: 'p5', p1: 'p3', p2: 'p5', p3: 'p5' } },
    },
    {
      kind: 'game', dayIndex: 2, gameType: 'BLIND_AUCTION',
      completedAt: now - 86400000 + 3600000,
      results: { rankings: [{ playerId: 'p1', score: 12 }, { playerId: 'p0', score: 9 }, { playerId: 'p3', score: 7 }, { playerId: 'p2', score: 4 }] },
    },
  ];

  // Game history
  const gameHistory = [
    { dayIndex: 1, theme: 'First Impressions', eliminatedId: 'p4', eliminatedName: 'Jax Cash', voteType: 'MAJORITY' },
    { dayIndex: 2, theme: 'Alliances Form', eliminatedId: 'p5', eliminatedName: 'Raven Thorne', voteType: 'BUBBLE' },
  ];

  // Pre-seeded chat messages (MAIN channel)
  const chatLog = [
    { id: crypto.randomUUID(), senderId: 'p0', content: 'Day 3 already... who\'s going home tonight?', channelId: 'MAIN', timestamp: now - 600000 },
    { id: crypto.randomUUID(), senderId: 'p3', content: 'Not me. I\'ve got plans.', channelId: 'MAIN', timestamp: now - 540000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'That\'s what Jax said before Day 1 voting', channelId: 'MAIN', timestamp: now - 480000 },
    { id: crypto.randomUUID(), senderId: 'p2', content: 'Can we just appreciate that Raven called the Bubble vote result?', channelId: 'MAIN', timestamp: now - 420000 },
    { id: crypto.randomUUID(), senderId: 'p0', content: 'The auction was wild. Bella came out of nowhere with that bid.', channelId: 'MAIN', timestamp: now - 360000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'Strategy', channelId: 'MAIN', timestamp: now - 300000 },
    // DM between p0 and p1
    { id: crypto.randomUUID(), senderId: 'p0', content: 'Hey, are we still aligned?', channelId: 'dm:p0:p1', timestamp: now - 240000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'Always. Target is Brenda tonight.', channelId: 'dm:p0:p1', timestamp: now - 180000 },
  ];

  // Channels: MAIN + one pre-existing DM
  const channels: Record<string, any> = {
    MAIN: {
      id: 'MAIN',
      type: 'MAIN',
      memberIds: personas.map(p => p.id),
      createdBy: 'system',
      createdAt: now - 86400000 * 3,
      capabilities: ['CHAT'],
      constraints: {},
    },
    'dm:p0:p1': {
      id: 'dm:p0:p1',
      type: 'DM',
      memberIds: ['p0', 'p1'],
      createdBy: 'p0',
      createdAt: now - 86400000,
      capabilities: ['CHAT', 'SILVER_TRANSFER'],
      constraints: { silverCost: 0 },
    },
  };

  return {
    gameId,
    dayIndex: 3,
    roster,
    manifest,
    chatLog,
    channels,
    completedPhases,
    gameHistory,
    goldPool: 50,
    winner: null,
  };
}
