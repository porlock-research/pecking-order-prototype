'use server';

import { InitPayloadSchema, Roster } from '@pecking-order/shared-types';
import { signGameToken } from '@pecking-order/auth';
import { getDB } from '@/lib/db';
import { requireAuth, generateId, generateInviteCode } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────

export interface DebugDayConfig {
  voteType: string;
  gameType: string;
  activityType: string;
  events: {
    INJECT_PROMPT: boolean;
    START_ACTIVITY: boolean;
    END_ACTIVITY: boolean;
    OPEN_DMS: boolean;
    START_GAME: boolean;
    END_GAME: boolean;
    OPEN_VOTING: boolean;
    CLOSE_VOTING: boolean;
    CLOSE_DMS: boolean;
    END_DAY: boolean;
  };
}

export interface DebugManifestConfig {
  dayCount: number;
  days: DebugDayConfig[];
}

export interface Persona {
  id: string;
  name: string;
  avatar: string;
  bio: string;
}

export interface GameSlot {
  slotIndex: number;
  acceptedBy: string | null;
  personaId: string | null;
  personaName: string | null;
  personaAvatar: string | null;
  displayName: string | null;
}

export interface GameInfo {
  id: string;
  mode: string;
  status: string;
  playerCount: number;
  dayCount: number;
  inviteCode: string;
  hostUserId: string;
  slots: GameSlot[];
  availablePersonas: Persona[];
}

// ── D1 Row Types ─────────────────────────────────────────────────────────

interface InviteRow {
  slot_index: number;
  accepted_by: string | null;
  persona_id: string | null;
  display_name: string | null;
  email: string | null;
  persona_name: string | null;
  persona_avatar: string | null;
}

// ── Game Creation ────────────────────────────────────────────────────────

export async function createGame(
  mode: 'PECKING_ORDER' | 'BLITZ' | 'DEBUG_PECKING_ORDER',
  debugConfig?: DebugManifestConfig
): Promise<{ success: boolean; gameId?: string; inviteCode?: string; error?: string }> {
  const session = await requireAuth();
  const db = await getDB();
  const now = Date.now();

  const dayCount = debugConfig?.dayCount ?? (mode === 'BLITZ' ? 3 : 7);
  const playerCount = dayCount + 1;
  const gameId = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const inviteCode = generateInviteCode();

  // Insert game session
  await db
    .prepare(
      `INSERT INTO GameSessions (id, host_user_id, invite_code, mode, status, player_count, day_count, config_json, created_at)
       VALUES (?, ?, ?, ?, 'RECRUITING', ?, ?, ?, ?)`
    )
    .bind(
      gameId,
      session.userId,
      inviteCode,
      mode,
      playerCount,
      dayCount,
      debugConfig ? JSON.stringify(debugConfig) : null,
      now
    )
    .run();

  // Create invite slots
  const stmts = [];
  for (let i = 1; i <= playerCount; i++) {
    stmts.push(
      db
        .prepare('INSERT INTO Invites (game_id, slot_index, created_at) VALUES (?, ?, ?)')
        .bind(gameId, i, now)
    );
  }
  await db.batch(stmts);

  return { success: true, gameId, inviteCode };
}

// ── Invite Info ──────────────────────────────────────────────────────────

export async function getInviteInfo(code: string): Promise<{
  success: boolean;
  game?: GameInfo;
  currentUserId?: string;
  alreadyJoined?: boolean;
  error?: string;
}> {
  const session = await requireAuth(`/join/${code}`);
  const db = await getDB();

  // Find game by invite code
  const game = await db
    .prepare('SELECT * FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{
      id: string;
      host_user_id: string;
      invite_code: string;
      mode: string;
      status: string;
      player_count: number;
      day_count: number;
      config_json: string | null;
    }>();

  if (!game) {
    return { success: false, error: 'Game not found' };
  }

  if (game.status !== 'RECRUITING' && game.status !== 'READY') {
    return { success: false, error: 'This game is no longer accepting players' };
  }

  // Get all invite slots with user info
  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id,
              u.display_name, u.email,
              pp.name as persona_name, pp.avatar as persona_avatar
       FROM Invites i
       LEFT JOIN Users u ON u.id = i.accepted_by
       LEFT JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ?
       ORDER BY i.slot_index`
    )
    .bind(game.id)
    .all<InviteRow>();

  // Get taken persona IDs
  const takenPersonaIds = new Set(
    invites.filter((i) => i.persona_id).map((i) => i.persona_id!)
  );

  // Get all personas, filter out taken ones
  const { results: allPersonas } = await db
    .prepare('SELECT id, name, avatar, bio FROM PersonaPool ORDER BY name')
    .all<Persona>();

  const availablePersonas = allPersonas.filter((p) => !takenPersonaIds.has(p.id));

  const slots: GameSlot[] = invites.map((inv) => ({
    slotIndex: inv.slot_index,
    acceptedBy: inv.accepted_by,
    personaId: inv.persona_id,
    personaName: inv.persona_name,
    personaAvatar: inv.persona_avatar,
    displayName: inv.display_name || inv.email?.split('@')[0] || null,
  }));

  const alreadyJoined = invites.some((i) => i.accepted_by === session.userId);

  return {
    success: true,
    game: {
      id: game.id,
      mode: game.mode,
      status: game.status,
      playerCount: game.player_count,
      dayCount: game.day_count,
      inviteCode: game.invite_code,
      hostUserId: game.host_user_id,
      slots,
      availablePersonas,
    },
    currentUserId: session.userId,
    alreadyJoined,
  };
}

// ── Accept Invite ────────────────────────────────────────────────────────

export async function acceptInvite(
  code: string,
  personaId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth(`/join/${code}`);
  const db = await getDB();
  const now = Date.now();

  // Find game
  const game = await db
    .prepare('SELECT id, status, player_count FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; player_count: number }>();

  if (!game || game.status !== 'RECRUITING') {
    return { success: false, error: 'Game is not accepting players' };
  }

  // Check user not already in this game
  const existing = await db
    .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
    .bind(game.id, session.userId)
    .first();

  if (existing) {
    return { success: false, error: 'You have already joined this game' };
  }

  // Check persona not taken
  const personaTaken = await db
    .prepare('SELECT id FROM Invites WHERE game_id = ? AND persona_id = ?')
    .bind(game.id, personaId)
    .first();

  if (personaTaken) {
    return { success: false, error: 'This character has already been picked' };
  }

  // Find first unclaimed slot
  const slot = await db
    .prepare(
      'SELECT id, slot_index FROM Invites WHERE game_id = ? AND accepted_by IS NULL ORDER BY slot_index LIMIT 1'
    )
    .bind(game.id)
    .first<{ id: number; slot_index: number }>();

  if (!slot) {
    return { success: false, error: 'No available slots' };
  }

  // Claim slot
  await db
    .prepare('UPDATE Invites SET accepted_by = ?, persona_id = ?, accepted_at = ? WHERE id = ?')
    .bind(session.userId, personaId, now, slot.id)
    .run();

  // Check if all slots are filled
  const { count } = await db
    .prepare('SELECT COUNT(*) as count FROM Invites WHERE game_id = ? AND accepted_by IS NULL')
    .bind(game.id)
    .first<{ count: number }>() || { count: 1 };

  if (count === 0) {
    await db
      .prepare("UPDATE GameSessions SET status = 'READY' WHERE id = ?")
      .bind(game.id)
      .run();
  }

  return { success: true };
}

// ── Game Start ───────────────────────────────────────────────────────────

export async function startGame(
  inviteCode: string
): Promise<{ success: boolean; error?: string; tokens?: Record<string, string> }> {
  const session = await requireAuth();
  const db = await getDB();
  const GAME_SERVER_HOST = process.env.GAME_SERVER_HOST || 'http://localhost:8787';
  const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

  // Load game by invite code
  const game = await db
    .prepare('SELECT * FROM GameSessions WHERE invite_code = ? AND host_user_id = ?')
    .bind(inviteCode.toUpperCase(), session.userId)
    .first<{
      id: string;
      mode: string;
      status: string;
      player_count: number;
      day_count: number;
      config_json: string | null;
    }>();

  if (!game) {
    return { success: false, error: 'Game not found or not your game' };
  }

  if (game.status !== 'READY') {
    return { success: false, error: 'Game is not ready to start (not all players joined)' };
  }

  // Load accepted invites with persona data
  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id,
              pp.name as persona_name, pp.avatar as persona_avatar, pp.bio as persona_bio
       FROM Invites i
       JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ? AND i.accepted_by IS NOT NULL
       ORDER BY i.slot_index`
    )
    .bind(game.id)
    .all<{
      slot_index: number;
      accepted_by: string;
      persona_id: string;
      persona_name: string;
      persona_avatar: string;
      persona_bio: string;
    }>();

  // Build roster
  const roster: Roster = {};
  const tokens: Record<string, string> = {};

  for (let i = 0; i < invites.length; i++) {
    const inv = invites[i];
    const pid = `p${i + 1}`;

    roster[pid] = {
      realUserId: inv.accepted_by,
      personaName: inv.persona_name,
      avatarUrl: inv.persona_avatar,
      bio: inv.persona_bio,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: 'FLOAT',
    };

    // Mint JWT for each player
    tokens[pid] = await signGameToken(
      {
        sub: inv.accepted_by,
        gameId: game.id,
        playerId: pid,
        personaName: inv.persona_name,
      },
      AUTH_SECRET
    );
  }

  const now = Date.now();

  // Build manifest
  const debugConfigParsed: DebugManifestConfig | null = game.config_json
    ? JSON.parse(game.config_json)
    : null;

  const t = (offset: number) => new Date(now + offset).toISOString();
  const days = buildManifestDays(game.mode, game.day_count, debugConfigParsed, t);

  const payload = {
    lobbyId: `lobby-${Date.now()}`,
    roster,
    manifest: {
      id: `manifest-${game.id}`,
      gameMode: game.mode,
      days,
    },
  };

  // Validate payload
  const validated = InitPayloadSchema.parse(payload);

  // POST to game server with auth
  const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${game.id}/init`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify(validated),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_SECRET}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server responded ${res.status}: ${text}`);
    }

    // Update game status
    await db
      .prepare("UPDATE GameSessions SET status = 'STARTED' WHERE id = ?")
      .bind(game.id)
      .run();

    // Auto-advance to day 1 (in future this will be a worker alarm)
    await fetch(`${GAME_SERVER_HOST}/parties/game-server/${game.id}/admin`, {
      method: 'POST',
      body: JSON.stringify({ type: 'NEXT_STAGE' }),
      headers: { 'Content-Type': 'application/json' },
    }).catch((err: any) => console.error('[Lobby] Auto-advance failed:', err));

    return { success: true, tokens };
  } catch (err: any) {
    console.error('[Lobby] Game start failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Debug: Quick Start (replaces old startGameStub) ──────────────────────

export async function startDebugGame(
  mode: 'PECKING_ORDER' | 'BLITZ' | 'DEBUG_PECKING_ORDER' = 'PECKING_ORDER',
  debugConfig?: DebugManifestConfig
): Promise<{
  success: boolean;
  gameId?: string;
  clientHost?: string;
  tokens?: Record<string, string>;
  error?: string;
}> {
  const GAME_SERVER_HOST = process.env.GAME_SERVER_HOST || 'http://localhost:8787';
  const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
  const GAME_ID = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const dayCount = debugConfig?.dayCount ?? 7;
  const playerCount = dayCount + 1;

  const ALL_PERSONAS = [
    { name: 'Countess Snuffles', emoji: '🐱' },
    { name: 'Dr. Spatula', emoji: '🍔' },
    { name: 'Baron Von Bon Bon', emoji: '🍬' },
    { name: 'Captain Quack', emoji: '🦆' },
    { name: 'Lady Fingers', emoji: '💅' },
    { name: 'Sir Loin', emoji: '🥩' },
    { name: 'Madame Mist', emoji: '🌫️' },
    { name: 'Professor Puns', emoji: '🤡' },
  ];

  const roster: Roster = {};
  const tokens: Record<string, string> = {};
  const personas = ALL_PERSONAS.slice(0, playerCount);

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];
    const id = `p${i + 1}`;
    roster[id] = {
      realUserId: `debug-user-${i + 1}`,
      personaName: p.name,
      avatarUrl: p.emoji,
      bio: 'Ready to win.',
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: i === 0 ? 'FANATIC' : 'FLOAT',
    };

    tokens[id] = await signGameToken(
      {
        sub: `debug-user-${i + 1}`,
        gameId: GAME_ID,
        playerId: id,
        personaName: p.name,
      },
      AUTH_SECRET
    );
  }

  const now = Date.now();
  const t = (offset: number) => new Date(now + offset).toISOString();
  const days = buildManifestDays(mode, dayCount, debugConfig, t);

  const payload = {
    lobbyId: `lobby-${Date.now()}`,
    roster,
    manifest: { id: 'manifest-1', gameMode: mode, days },
  };

  const validated = InitPayloadSchema.parse(payload);
  const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${GAME_ID}/init`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify(validated),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_SECRET}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server responded ${res.status}: ${text}`);
    }

    const clientHost = process.env.GAME_CLIENT_HOST || 'http://localhost:5173';
    return { success: true, gameId: GAME_ID, clientHost, tokens };
  } catch (err: any) {
    console.error('[Lobby] Debug start failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Shared: Build manifest days ──────────────────────────────────────────

function buildManifestDays(
  mode: string,
  dayCount: number,
  debugConfig: DebugManifestConfig | null | undefined,
  t: (offset: number) => string
) {
  if ((mode === 'DEBUG_PECKING_ORDER') && debugConfig) {
    const EVENT_MESSAGES: Record<string, string> = {
      INJECT_PROMPT: 'Chat prompt injected.',
      START_ACTIVITY: 'Activity started!',
      END_ACTIVITY: 'Activity ended.',
      OPEN_DMS: 'DMs are now open.',
      START_GAME: 'Daily game started!',
      END_GAME: 'Daily game ended.',
      OPEN_VOTING: 'Voting is now open!',
      CLOSE_VOTING: 'Voting is now closed.',
      CLOSE_DMS: 'DMs are now closed.',
      END_DAY: 'Day has ended.',
    };

    const ACTIVITY_PROMPTS: Record<string, string> = {
      PLAYER_PICK: 'Pick your bestie',
      PREDICTION: 'Who do you think will be eliminated tonight?',
      WOULD_YOU_RATHER: 'Would you rather...',
      HOT_TAKE: 'Pineapple belongs on pizza',
      CONFESSION: 'Confess something about your game strategy',
      GUESS_WHO: 'What is your biggest fear in this game?',
      NONE: '',
    };

    const ACTIVITY_OPTIONS: Record<string, { optionA: string; optionB: string }> = {
      WOULD_YOU_RATHER: { optionA: 'Have immunity for one round', optionB: 'Get 50 bonus silver' },
    };

    return debugConfig.days.slice(0, debugConfig.dayCount).map((day, i) => {
      const baseOffset = i * 30000;
      const timeline: { time: string; action: string; payload: any }[] = [];

      let eventOffset = 0;
      for (const eventKey of [
        'INJECT_PROMPT', 'START_ACTIVITY', 'END_ACTIVITY', 'OPEN_DMS',
        'START_GAME', 'END_GAME', 'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'END_DAY',
      ] as const) {
        if ((eventKey === 'START_ACTIVITY' || eventKey === 'END_ACTIVITY') && day.activityType === 'NONE') continue;
        if (day.events[eventKey]) {
          const payload =
            eventKey === 'START_ACTIVITY'
              ? {
                  msg: EVENT_MESSAGES[eventKey],
                  promptType: day.activityType,
                  promptText: ACTIVITY_PROMPTS[day.activityType] || 'Pick a player',
                  ...(ACTIVITY_OPTIONS[day.activityType] || {}),
                }
              : { msg: EVENT_MESSAGES[eventKey] };
          timeline.push({ time: t(baseOffset + eventOffset), action: eventKey, payload });
          eventOffset += 5000;
        }
      }

      return {
        dayIndex: i + 1,
        theme: `Debug Day ${i + 1}`,
        voteType: day.voteType,
        gameType: day.gameType,
        timeline,
      };
    });
  }

  // Default hardcoded manifest
  const timelineDay1 = [
    { time: t(2000), action: 'INJECT_PROMPT', payload: { msg: 'Chat is open. Who is the imposter?' } },
    { time: t(10000), action: 'OPEN_VOTING', payload: { msg: 'Voting is now open!' } },
    { time: t(20000), action: 'END_DAY', payload: { msg: 'Day has ended.' } },
  ];

  const timelineDay2 = [
    { time: t(30000), action: 'INJECT_PROMPT', payload: { msg: 'Day 2 begins!' } },
    { time: t(35000), action: 'OPEN_VOTING', payload: { msg: 'Voting is now open!' } },
    { time: t(40000), action: 'END_DAY', payload: { msg: 'Day 2 ended.' } },
  ];

  return [
    { dayIndex: 1, theme: 'The Beginning', voteType: 'EXECUTIONER' as const, timeline: timelineDay1 },
    { dayIndex: 2, theme: 'Double Trouble', voteType: 'TRUST_PAIRS' as const, timeline: timelineDay2 },
  ];
}

// ── Existing Admin Actions ───────────────────────────────────────────────

export async function getGameState(gameId: string) {
  const GAME_SERVER_HOST = process.env.GAME_SERVER_HOST || 'http://localhost:8787';
  const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${gameId}/state`;

  try {
    const res = await fetch(targetUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: 'Failed to fetch state' };
  }
}

export async function sendAdminCommand(gameId: string, command: any) {
  const GAME_SERVER_HOST = process.env.GAME_SERVER_HOST || 'http://localhost:8787';
  const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${gameId}/admin`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify(command),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Game Status Polling ──────────────────────────────────────────────────

export async function getGameSessionStatus(inviteCode: string): Promise<{
  status: string;
  slots: GameSlot[];
  tokens?: Record<string, string>;
  inviteCode?: string;
  clientHost?: string;
}> {
  const session = await requireAuth();
  const db = await getDB();

  const game = await db
    .prepare('SELECT id, status, invite_code FROM GameSessions WHERE invite_code = ?')
    .bind(inviteCode.toUpperCase())
    .first<{ id: string; status: string; invite_code: string }>();

  if (!game) {
    return { status: 'NOT_FOUND', slots: [] };
  }

  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id,
              u.display_name, u.email,
              pp.name as persona_name, pp.avatar as persona_avatar
       FROM Invites i
       LEFT JOIN Users u ON u.id = i.accepted_by
       LEFT JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ?
       ORDER BY i.slot_index`
    )
    .bind(game.id)
    .all<InviteRow>();

  const slots: GameSlot[] = invites.map((inv) => ({
    slotIndex: inv.slot_index,
    acceptedBy: inv.accepted_by,
    personaId: inv.persona_id,
    personaName: inv.persona_name,
    personaAvatar: inv.persona_avatar,
    displayName: inv.display_name || inv.email?.split('@')[0] || null,
  }));

  // If game just started, get token for the current user
  let tokens: Record<string, string> | undefined;
  if (game.status === 'STARTED') {
    const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
    const myInvite = invites.find((i) => i.accepted_by === session.userId);
    if (myInvite) {
      const idx = invites.filter((i) => i.accepted_by).indexOf(myInvite);
      const pid = `p${idx + 1}`;
      tokens = {
        [pid]: await signGameToken(
          {
            sub: session.userId,
            gameId: game.id,
            playerId: pid,
            personaName: myInvite.persona_name!,
          },
          AUTH_SECRET
        ),
      };
    }
  }

  const clientHost = process.env.GAME_CLIENT_HOST || 'http://localhost:5173';
  return { status: game.status, slots, tokens, inviteCode: game.invite_code, clientHost };
}
