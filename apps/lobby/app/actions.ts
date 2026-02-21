'use server';

import { InitPayloadSchema, Roster } from '@pecking-order/shared-types';
import { signGameToken } from '@pecking-order/auth';
import { getDB, getEnv } from '@/lib/db';
import { requireAuth, getSession, generateId, generateInviteCode } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────

export interface DebugDayConfig {
  voteType: string;
  gameType: string;
  gameMode?: string;
  activityType: string;
  events: {
    INJECT_PROMPT: boolean;
    OPEN_GROUP_CHAT: boolean;
    START_ACTIVITY: boolean;
    END_ACTIVITY: boolean;
    OPEN_DMS: boolean;
    START_GAME: boolean;
    END_GAME: boolean;
    OPEN_VOTING: boolean;
    CLOSE_VOTING: boolean;
    CLOSE_DMS: boolean;
    CLOSE_GROUP_CHAT: boolean;
    END_DAY: boolean;
  };
}

export interface DebugManifestConfig {
  dayCount: number;
  days: DebugDayConfig[];
  pushConfig: Record<string, boolean>;
}

export interface Persona {
  id: string;
  name: string;
  stereotype: string;
  description: string;
  theme: string;
}

function personaImageUrl(id: string, variant: 'headshot' | 'medium' | 'full'): string {
  // PERSONA_ASSETS_URL is resolved at runtime from env — empty string for local dev (R2 binding serves via miniflare)
  return `/api/persona-image/${id}/${variant}.png`;
}

export interface GameSlot {
  slotIndex: number;
  acceptedBy: string | null;
  personaId: string | null;
  personaName: string | null;
  personaStereotype: string | null;
  personaImageUrl: string | null;
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
}

// ── D1 Row Types ─────────────────────────────────────────────────────────

interface InviteRow {
  slot_index: number;
  accepted_by: string | null;
  persona_id: string | null;
  display_name: string | null;
  email: string | null;
  persona_name: string | null;
  persona_stereotype: string | null;
}

// ── Persona Draw Config ──────────────────────────────────────────────────

const DRAW_SIZE = 3;                  // How many personas to present per draw
const DRAW_TTL_MS = 15 * 60 * 1000;  // 15 min lock TTL

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
              pp.name as persona_name, pp.stereotype as persona_stereotype
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
    personaStereotype: inv.persona_stereotype,
    personaImageUrl: inv.persona_id ? personaImageUrl(inv.persona_id, 'headshot') : null,
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
    },
    currentUserId: session.userId,
    alreadyJoined,
  };
}

// ── Random Persona Draw (Idempotent + Locking) ─────────────────────────

export async function getRandomPersonas(
  code: string,
  theme?: string
): Promise<{ success: boolean; personas?: (Persona & { imageUrl: string; fullImageUrl: string })[]; error?: string }> {
  const session = await requireAuth(`/join/${code}`);
  const db = await getDB();
  const now = Date.now();

  // Find game
  const game = await db
    .prepare('SELECT id FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string }>();

  if (!game) {
    return { success: false, error: 'Game not found' };
  }

  // Check for existing non-expired draw for this user+game
  const existingDraw = await db
    .prepare('SELECT persona_ids, expires_at FROM PersonaDraws WHERE game_id = ? AND user_id = ?')
    .bind(game.id, session.userId)
    .first<{ persona_ids: string; expires_at: number }>();

  if (existingDraw && existingDraw.expires_at > now) {
    // Return the persisted draw (idempotent reload)
    const drawIds: string[] = JSON.parse(existingDraw.persona_ids);
    const { results: drawnPersonas } = await db
      .prepare(
        `SELECT id, name, stereotype, description, theme FROM PersonaPool WHERE id IN (${drawIds.map(() => '?').join(',')})`
      )
      .bind(...drawIds)
      .all<Persona>();

    // Maintain the original draw order
    const byId = new Map(drawnPersonas.map((p) => [p.id, p]));
    const ordered = drawIds.map((id) => byId.get(id)).filter(Boolean) as Persona[];

    return {
      success: true,
      personas: ordered.map((p) => ({
        ...p,
        imageUrl: personaImageUrl(p.id, 'medium'),
        fullImageUrl: personaImageUrl(p.id, 'full'),
      })),
    };
  }

  // Expired draw — clean it up
  if (existingDraw) {
    await db
      .prepare('DELETE FROM PersonaDraws WHERE game_id = ? AND user_id = ?')
      .bind(game.id, session.userId)
      .run();
  }

  // Get locked persona IDs = confirmed picks + active draws from OTHER users
  const { results: confirmedPicks } = await db
    .prepare('SELECT persona_id FROM Invites WHERE game_id = ? AND persona_id IS NOT NULL')
    .bind(game.id)
    .all<{ persona_id: string }>();

  const { results: activeDraws } = await db
    .prepare('SELECT persona_ids FROM PersonaDraws WHERE game_id = ? AND user_id != ? AND expires_at > ?')
    .bind(game.id, session.userId, now)
    .all<{ persona_ids: string }>();

  const lockedIds = new Set<string>();
  for (const row of confirmedPicks) lockedIds.add(row.persona_id);
  for (const row of activeDraws) {
    const ids: string[] = JSON.parse(row.persona_ids);
    for (const id of ids) lockedIds.add(id);
  }

  // Query available personas
  const themeFilter = theme ? ' AND theme = ?' : '';
  const query = `SELECT id, name, stereotype, description, theme FROM PersonaPool WHERE 1=1${themeFilter} ORDER BY id`;
  const stmt = theme ? db.prepare(query).bind(theme) : db.prepare(query);
  const { results: allPersonas } = await stmt.all<Persona>();

  const available = allPersonas.filter((p) => !lockedIds.has(p.id));

  if (available.length < DRAW_SIZE) {
    return { success: false, error: 'Not enough characters available' };
  }

  // Cryptographic shuffle, pick DRAW_SIZE
  const shuffled = [...available];
  const arr = new Uint32Array(shuffled.length);
  crypto.getRandomValues(arr);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const picked = shuffled.slice(0, DRAW_SIZE);
  const pickedIds = picked.map((p) => p.id);

  // Persist draw (INSERT OR REPLACE to handle race with expired cleanup)
  await db
    .prepare(
      'INSERT OR REPLACE INTO PersonaDraws (game_id, user_id, persona_ids, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(game.id, session.userId, JSON.stringify(pickedIds), now + DRAW_TTL_MS, now)
    .run();

  return {
    success: true,
    personas: picked.map((p) => ({
      ...p,
      imageUrl: personaImageUrl(p.id, 'medium'),
      fullImageUrl: personaImageUrl(p.id, 'full'),
    })),
  };
}

// ── Re-Draw Personas ────────────────────────────────────────────────────

export async function redrawPersonas(
  code: string,
  theme?: string
): Promise<{ success: boolean; personas?: (Persona & { imageUrl: string; fullImageUrl: string })[]; error?: string }> {
  const session = await requireAuth(`/join/${code}`);
  const db = await getDB();

  const game = await db
    .prepare('SELECT id FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string }>();

  if (!game) {
    return { success: false, error: 'Game not found' };
  }

  // Delete existing draw so getRandomPersonas generates a fresh one
  await db
    .prepare('DELETE FROM PersonaDraws WHERE game_id = ? AND user_id = ?')
    .bind(game.id, session.userId)
    .run();

  return getRandomPersonas(code, theme);
}

// ── Accept Invite ────────────────────────────────────────────────────────

export async function acceptInvite(
  code: string,
  personaId: string,
  customBio: string
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

  // Validate bio
  const bio = customBio.trim();
  if (!bio || bio.length > 280) {
    return { success: false, error: 'Bio must be between 1 and 280 characters' };
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
    .prepare('UPDATE Invites SET accepted_by = ?, persona_id = ?, custom_bio = ?, accepted_at = ? WHERE id = ?')
    .bind(session.userId, personaId, bio, now, slot.id)
    .run();

  // Release draw lock — unchosen personas go back to the pool
  await db
    .prepare('DELETE FROM PersonaDraws WHERE game_id = ? AND user_id = ?')
    .bind(game.id, session.userId)
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
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  // Load game by invite code
  const game = await db
    .prepare('SELECT * FROM GameSessions WHERE invite_code = ?')
    .bind(inviteCode.toUpperCase())
    .first<{
      id: string;
      mode: string;
      status: string;
      player_count: number;
      day_count: number;
      config_json: string | null;
    }>();

  if (!game) {
    return { success: false, error: 'Game not found' };
  }

  // Verify the caller is a participant in this game
  const isParticipant = await db
    .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
    .bind(game.id, session.userId)
    .first();

  if (!isParticipant) {
    return { success: false, error: 'You are not a player in this game' };
  }

  if (game.status !== 'READY') {
    return { success: false, error: 'Game is not ready to start (not all players joined)' };
  }

  // Load accepted invites with persona data
  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id, i.custom_bio,
              pp.name as persona_name, pp.description as persona_description
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
      custom_bio: string | null;
      persona_name: string;
      persona_description: string;
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
      avatarUrl: personaImageUrl(inv.persona_id, 'headshot'),
      bio: inv.custom_bio || inv.persona_description,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: 'FLOAT',
    };

    // Mint JWT for each player (expiry = 2× game length + 7 day buffer)
    const tokenExpiry = `${game.day_count * 2 + 7}d`;
    tokens[pid] = await signGameToken(
      {
        sub: inv.accepted_by,
        gameId: game.id,
        playerId: pid,
        personaName: inv.persona_name,
      },
      AUTH_SECRET,
      tokenExpiry
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
    inviteCode: inviteCode.toUpperCase(),
    roster,
    manifest: {
      id: `manifest-${game.id}`,
      gameMode: game.mode,
      days,
      pushConfig: debugConfigParsed?.pushConfig,
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_SECRET}`,
      },
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
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';
  const GAME_ID = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const dayCount = debugConfig?.dayCount ?? 7;
  const playerCount = dayCount + 1;

  // Query personas from D1
  const db = await getDB();
  const { results: dbPersonas } = await db
    .prepare('SELECT id, name, description FROM PersonaPool ORDER BY id LIMIT ?')
    .bind(playerCount)
    .all<{ id: string; name: string; description: string }>();

  const roster: Roster = {};
  const tokens: Record<string, string> = {};

  for (let i = 0; i < dbPersonas.length; i++) {
    const p = dbPersonas[i];
    const pid = `p${i + 1}`;
    roster[pid] = {
      realUserId: `debug-user-${i + 1}`,
      personaName: p.name,
      avatarUrl: personaImageUrl(p.id, 'headshot'),
      bio: p.description,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: i === 0 ? 'FANATIC' : 'FLOAT',
    };

    const tokenExpiry = `${dayCount * 2 + 7}d`;
    tokens[pid] = await signGameToken(
      {
        sub: `debug-user-${i + 1}`,
        gameId: GAME_ID,
        playerId: pid,
        personaName: p.name,
      },
      AUTH_SECRET,
      tokenExpiry
    );
  }

  const now = Date.now();
  const t = (offset: number) => new Date(now + offset).toISOString();
  const days = buildManifestDays(mode, dayCount, debugConfig, t);

  const payload = {
    lobbyId: `lobby-${Date.now()}`,
    inviteCode: 'DEBUG',
    roster,
    manifest: { id: 'manifest-1', gameMode: mode, days, pushConfig: debugConfig?.pushConfig },
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

    const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
    return { success: true, gameId: GAME_ID, clientHost, tokens };
  } catch (err: any) {
    console.error('[Lobby] Debug start failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Auth Status ─────────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<{ authed: boolean; email?: string }> {
  const session = await getSession();
  if (!session) return { authed: false };
  return { authed: true, email: session.email };
}

// ── Active Games for Current User ───────────────────────────────────────

export interface ActiveGame {
  id: string;
  inviteCode: string;
  mode: string;
  status: string;
  playerCount: number;
  createdAt: number;
}

export async function getActiveGames(): Promise<ActiveGame[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT gs.id, gs.invite_code, gs.mode, gs.status, gs.player_count, gs.created_at
       FROM Invites i
       JOIN GameSessions gs ON gs.id = i.game_id
       WHERE i.accepted_by = ?
         AND gs.status IN ('RECRUITING','READY','STARTED')
       ORDER BY gs.created_at DESC`
    )
    .bind(session.userId)
    .all<{
      id: string;
      invite_code: string;
      mode: string;
      status: string;
      player_count: number;
      created_at: number;
    }>();

  return results.map((r) => ({
    id: r.id,
    inviteCode: r.invite_code,
    mode: r.mode,
    status: r.status,
    playerCount: r.player_count,
    createdAt: r.created_at,
  }));
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
      OPEN_GROUP_CHAT: 'Group chat is now open!',
      START_ACTIVITY: 'Activity started!',
      END_ACTIVITY: 'Activity ended.',
      OPEN_DMS: 'DMs are now open.',
      START_GAME: 'Daily game started!',
      END_GAME: 'Daily game ended.',
      OPEN_VOTING: 'Voting is now open!',
      CLOSE_VOTING: 'Voting is now closed.',
      CLOSE_DMS: 'DMs are now closed.',
      CLOSE_GROUP_CHAT: 'Group chat is now closed.',
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
        'INJECT_PROMPT', 'OPEN_GROUP_CHAT', 'START_ACTIVITY', 'END_ACTIVITY', 'OPEN_DMS',
        'START_GAME', 'END_GAME', 'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'CLOSE_GROUP_CHAT', 'END_DAY',
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
        ...(day.gameMode ? { gameMode: day.gameMode } : {}),
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
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
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
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';
  const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${gameId}/admin`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify(command),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_SECRET}`,
      },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Admin: Database Reset ────────────────────────────────────────────────

// FK-safe order for lobby tables (children before parents)
const LOBBY_TABLES = ['PersonaDraws', 'Invites', 'GameSessions', 'Sessions', 'MagicLinks', 'Users'] as const;
const GAME_SERVER_TABLES = ['GameJournal', 'Players', 'Games', 'PushSubscriptions'] as const;

interface ResetTablesInput {
  lobbyTables: string[];
  gameServerTables: string[];
}

export async function resetSelectedTables(input: ResetTablesInput): Promise<{
  success: boolean;
  error?: string;
  details?: { lobby: string[]; gameServer: string[] };
}> {
  const env = await getEnv();
  const db = await getDB();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  const lobbyCleared: string[] = [];
  const gameServerCleared: string[] = [];

  // 1. Wipe selected lobby tables in FK-safe order
  if (input.lobbyTables.length > 0) {
    // Filter and sort by FK-safe order
    const ordered = (LOBBY_TABLES as readonly string[]).filter(t => input.lobbyTables.includes(t));
    try {
      for (const table of ordered) {
        await db.prepare(`DELETE FROM ${table}`).run();
        lobbyCleared.push(table);
      }
    } catch (err: any) {
      return { success: false, error: `Lobby DB reset failed at ${lobbyCleared.length ? lobbyCleared[lobbyCleared.length - 1] : '?'}: ${err.message}` };
    }
  }

  // 2. Wipe selected game-server tables via its admin endpoint
  if (input.gameServerTables.length > 0) {
    try {
      const res = await fetch(`${GAME_SERVER_HOST}/api/admin/reset-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tables: input.gameServerTables }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Game server ${res.status}: ${body}`);
      }
      const data = await res.json() as any;
      gameServerCleared.push(...(data.tablesCleared || []));
    } catch (err: any) {
      const partial = lobbyCleared.length ? `Lobby cleared (${lobbyCleared.join(', ')}), but g` : 'G';
      return { success: false, error: `${partial}ame server failed: ${err.message}` };
    }
  }

  if (lobbyCleared.length === 0 && gameServerCleared.length === 0) {
    return { success: false, error: 'No tables selected' };
  }

  return { success: true, details: { lobby: lobbyCleared, gameServer: gameServerCleared } };
}

// ── Game Status Polling ──────────────────────────────────────────────────

export async function getGameSessionStatus(inviteCode: string): Promise<{
  status: string;
  slots: GameSlot[];
  tokens?: Record<string, string>;
  inviteCode?: string;
  clientHost?: string;
  myPersonaId?: string;
}> {
  const session = await requireAuth();
  const db = await getDB();
  const env = await getEnv();

  const game = await db
    .prepare('SELECT id, status, invite_code, day_count FROM GameSessions WHERE invite_code = ?')
    .bind(inviteCode.toUpperCase())
    .first<{ id: string; status: string; invite_code: string; day_count: number }>();

  if (!game) {
    return { status: 'NOT_FOUND', slots: [] };
  }

  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id,
              u.display_name, u.email,
              pp.name as persona_name, pp.stereotype as persona_stereotype
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
    personaStereotype: inv.persona_stereotype,
    personaImageUrl: inv.persona_id ? personaImageUrl(inv.persona_id, 'headshot') : null,
    displayName: inv.display_name || inv.email?.split('@')[0] || null,
  }));

  // If game just started, get token for the current user
  let tokens: Record<string, string> | undefined;
  if (game.status === 'STARTED') {
    const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';
    const myInvite = invites.find((i) => i.accepted_by === session.userId);
    if (myInvite) {
      const idx = invites.filter((i) => i.accepted_by).indexOf(myInvite);
      const pid = `p${idx + 1}`;
      const tokenExpiry = `${(game.day_count || 7) * 2 + 7}d`;
      tokens = {
        [pid]: await signGameToken(
          {
            sub: session.userId,
            gameId: game.id,
            playerId: pid,
            personaName: myInvite.persona_name!,
          },
          AUTH_SECRET,
          tokenExpiry
        ),
      };
    }
  }

  // Find current user's persona for background image
  const myInviteForBg = invites.find((i) => i.accepted_by === session.userId);
  const myPersonaId = myInviteForBg?.persona_id ?? undefined;

  const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  return { status: game.status, slots, tokens, inviteCode: game.invite_code, clientHost, myPersonaId };
}
