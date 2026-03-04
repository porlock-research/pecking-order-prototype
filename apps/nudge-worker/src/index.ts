/**
 * Nudge Worker — standalone email nudge system for Pecking Order.
 *
 * Runs on a cron schedule (every 15 min). Scans active CONFIGURABLE_CYCLE games,
 * classifies players by funnel stage, and sends nudge emails at the right time.
 * Only targets players WITHOUT push subscriptions.
 *
 * Funnel stages:
 *   1. NEVER_CLICKED  — invite token exists, used=0 (never clicked link)
 *   2. CLICKED_NO_JOIN — invite token used=1, but no slot accepted (dropped at character selection)
 *   3. JOINED_NO_APP   — slot accepted, in DO roster, but no push subscription (never entered client)
 *
 * Nudge timing (relative to Day 1 start):
 *   - 30 min before Day 1: nudge NEVER_CLICKED and CLICKED_NO_JOIN
 *   - At Day 1 start: nudge JOINED_NO_APP with direct game link
 *
 * Dedup: NudgeLog table tracks sent nudges (game_id + email + nudge_type).
 */

import { Resend } from 'resend';

interface Env {
  LOBBY_DB: D1Database;
  GAME_DB: D1Database;
  RESEND_API_KEY: string;
  AUTH_SECRET: string;
  LOBBY_HOST: string;
  CLIENT_HOST: string;
  ASSETS_HOST: string;
  ENVIRONMENT: string;
}

// --- Types ---

interface ActiveGame {
  id: string;
  invite_code: string;
  player_count: number;
  day_count: number;
  config_json: string;
  status: string;
}

interface InviteState {
  email: string;
  token: string;
  token_used: number;
  slot_index: number | null;
  accepted_by: string | null;
  persona_name: string | null;
}

type FunnelStage = 'NEVER_CLICKED' | 'CLICKED_NO_JOIN' | 'JOINED_NO_APP';

interface NudgeTarget {
  email: string;
  stage: FunnelStage;
  inviteCode: string;
  gameId: string;
  inviteToken: string | null;
  personaName: string | null;
}

// --- Nudge Logic ---

function getDay1Start(configJson: string): Date | null {
  try {
    const config = JSON.parse(configJson);
    const days = config.days;
    if (!days || !days[0]?.events) return null;

    // Find earliest event time on Day 1
    let earliest: string | null = null;
    for (const evt of Object.values(days[0].events) as any[]) {
      if (evt.enabled && evt.time) {
        if (!earliest || evt.time < earliest) earliest = evt.time;
      }
    }
    return earliest ? new Date(earliest) : null;
  } catch {
    return null;
  }
}

function classifyPlayer(
  tokenUsed: number,
  slotAccepted: boolean,
  hasPushSub: boolean,
): FunnelStage | null {
  // Players with active push subscriptions are reachable via push — never email them
  if (hasPushSub) return null;

  if (!tokenUsed) return 'NEVER_CLICKED';
  if (!slotAccepted) return 'CLICKED_NO_JOIN';
  return 'JOINED_NO_APP';
}

// --- Brand Email Template (matches lobby/lib/email-templates.ts) ---

const FROM_ADDRESS = 'Pecking Order <noreply@peckingorder.ca>';

const DEEP = '#2c003e';
const PANEL = '#4c1d95';
const GOLD = '#fbbf24';
const PINK = '#ec4899';
const DIM = '#d8b4fe';
const BASE = '#ffffff';

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${DEEP};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        ${inner}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function logo(assetsUrl: string, lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:32px;">
    <a href="${lobbyUrl}" target="_blank" style="text-decoration:none;">
      <img src="${assetsUrl}/branding/email-logo.png" alt="PECKING ORDER" width="320" style="display:block;max-width:100%;height:auto;border:0;" />
    </a>
  </td></tr>`;
}

function card(inner: string): string {
  return `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PANEL};border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
      <tr><td style="padding:32px 28px;">
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:12px;background-color:${PINK};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${BASE};text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

function inviteCode(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(255,255,255,0.08);">
    <tr><td style="padding-top:20px;" align="center">
      <span style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${DIM};opacity:0.6;">Invite Code</span>
      <br>
      <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:bold;letter-spacing:4px;color:${GOLD};">${code}</span>
    </td></tr>
  </table>`;
}

function footer(text: string): string {
  return `<tr><td align="center" style="padding-top:24px;">
    <span style="font-family:'Courier New',Courier,monospace;font-size:11px;color:${DIM};opacity:0.5;">${text}</span>
  </td></tr>`;
}

function buildNudgeEmail(target: NudgeTarget, day1Start: Date, lobbyHost: string, _clientHost: string, assetsUrl: string): { subject: string; html: string } {
  const joinUrl = target.inviteToken
    ? `${lobbyHost}/invite/${target.inviteToken}`
    : `${lobbyHost}/join/${target.inviteCode}`;

  const day1Time = day1Start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
  });

  switch (target.stage) {
    case 'NEVER_CLICKED':
      return {
        subject: "Pecking Order starts soon — don't miss Day 1!",
        html: wrap(`
          ${logo(assetsUrl, lobbyHost)}
          ${card(`
            <p style="margin:0 0 6px;font-size:15px;color:${DIM};text-align:center;">
              You've been summoned.
            </p>
            <p style="margin:0 0 28px;font-size:16px;color:${BASE};text-align:center;">
              Day 1 begins at <strong style="color:${GOLD};">${day1Time} today</strong>. Pick your character and jump in before it's too late.
            </p>
            ${button('Join the Game', joinUrl)}
            ${inviteCode(target.inviteCode)}
          `)}
          ${footer('Choose wisely. Trust no one.')}
        `),
      };

    case 'CLICKED_NO_JOIN':
      return {
        subject: "You're almost in — finish joining Pecking Order!",
        html: wrap(`
          ${logo(assetsUrl, lobbyHost)}
          ${card(`
            <p style="margin:0 0 6px;font-size:15px;color:${DIM};text-align:center;">
              You're almost in.
            </p>
            <p style="margin:0 0 28px;font-size:16px;color:${BASE};text-align:center;">
              Day 1 begins at <strong style="color:${GOLD};">${day1Time} today</strong>. Pick a persona, write your bio, and get in the game.
            </p>
            ${button('Pick Your Character', joinUrl)}
            ${inviteCode(target.inviteCode)}
          `)}
          ${footer('Choose wisely. Trust no one.')}
        `),
      };

    case 'JOINED_NO_APP':
      return {
        subject: `Day 1 has begun — ${target.personaName || 'your character'} is waiting!`,
        html: wrap(`
          ${logo(assetsUrl, lobbyHost)}
          ${card(`
            <p style="margin:0 0 6px;font-size:15px;color:${DIM};text-align:center;">
              Day 1 is live!
            </p>
            <p style="margin:0 0 28px;font-size:16px;color:${BASE};text-align:center;">
              You've picked your character${target.personaName ? ` <strong style="color:${GOLD};">${target.personaName}</strong>` : ''} — now enter the game to start playing.
            </p>
            ${button('Enter the Game', `${lobbyHost}/play/${target.inviteCode}`)}
            ${inviteCode(target.inviteCode)}
          `)}
          ${footer('Choose wisely. Trust no one.')}
        `),
      };
  }
}

// --- Main Handler ---

async function processGame(game: ActiveGame, env: Env, now: Date, force = false, dryRun = false): Promise<string[]> {
  const logs: string[] = [];
  const day1Start = getDay1Start(game.config_json);
  if (!day1Start) {
    logs.push(`[${game.invite_code}] No Day 1 start time found, skipping`);
    return logs;
  }

  const msUntilDay1 = day1Start.getTime() - now.getTime();
  const minUntilDay1 = msUntilDay1 / 60_000;

  // Only nudge within the window: 45 min before Day 1 through 2 hours after
  if (!force && (minUntilDay1 > 45 || minUntilDay1 < -120)) {
    logs.push(`[${game.invite_code}] Outside nudge window (${Math.round(minUntilDay1)} min until Day 1)`);
    return logs;
  }

  // Fetch invite states from lobby DB
  const { results: invites } = await env.LOBBY_DB
    .prepare(`
      SELECT it.email, it.token, it.used as token_used,
             i.slot_index, i.accepted_by,
             pp.name as persona_name
      FROM InviteTokens it
      LEFT JOIN Users u ON u.email = it.email
      LEFT JOIN Invites i ON i.game_id = it.game_id AND i.accepted_by = u.id
      LEFT JOIN PersonaPool pp ON pp.id = i.persona_id
      WHERE it.game_id = ?
      ORDER BY it.created_at
    `)
    .bind(game.id)
    .all<InviteState>();

  if (!invites.length) {
    logs.push(`[${game.invite_code}] No invites found`);
    return logs;
  }

  // Fetch push subscriptions from game server DB
  const { results: pushSubs } = await env.GAME_DB
    .prepare('SELECT user_id FROM PushSubscriptions')
    .all<{ user_id: string }>();
  const pushSubUserIds = new Set(pushSubs.map(s => s.user_id));

  // Fetch already-sent nudges for dedup
  const { results: sentNudges } = await env.LOBBY_DB
    .prepare('SELECT email, nudge_type FROM NudgeLog WHERE game_id = ?')
    .bind(game.id)
    .all<{ email: string; nudge_type: string }>();
  const sentKey = (email: string, type: string) => `${email}:${type}`;
  const alreadySent = new Set(sentNudges.map(n => sentKey(n.email, n.nudge_type)));

  // Classify players and build nudge targets
  const targets: NudgeTarget[] = [];
  for (const inv of invites) {
    // Check if this player has a push subscription
    let hasPushSub = false;
    if (inv.accepted_by) {
      hasPushSub = pushSubUserIds.has(inv.accepted_by);
    }

    const stage = classifyPlayer(inv.token_used, !!inv.accepted_by, hasPushSub);
    if (!stage) {
      logs.push(`[${game.invite_code}] ${inv.email}: fully onboarded, skipping`);
      continue;
    }

    // Timing gates per stage (skipped in force mode)
    if (!force) {
      if (stage === 'NEVER_CLICKED' && minUntilDay1 > 35) continue; // nudge at ~30 min before
      if (stage === 'CLICKED_NO_JOIN' && minUntilDay1 > 35) continue; // nudge at ~30 min before
      if (stage === 'JOINED_NO_APP' && minUntilDay1 > 5) continue; // nudge around Day 1 start
    }

    // Dedup check
    if (alreadySent.has(sentKey(inv.email, stage))) {
      logs.push(`[${game.invite_code}] ${inv.email}: ${stage} already sent, skipping`);
      continue;
    }

    targets.push({
      email: inv.email,
      stage,
      inviteCode: game.invite_code,
      gameId: game.id,
      inviteToken: stage === 'NEVER_CLICKED' ? inv.token : null,
      personaName: inv.persona_name,
    });
  }

  if (!targets.length) {
    logs.push(`[${game.invite_code}] No nudges to send`);
    return logs;
  }

  // Send emails (or log what would be sent in dry-run mode)
  const resend = new Resend(env.RESEND_API_KEY);
  for (const target of targets) {
    const { subject, html } = buildNudgeEmail(target, day1Start, env.LOBBY_HOST, env.CLIENT_HOST, env.ASSETS_HOST);

    if (dryRun) {
      logs.push(`[${game.invite_code}] DRY-RUN ${target.email} (${target.stage}): ${subject}`);
      continue;
    }

    try {
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to: target.email, subject, html });
      if (error) {
        logs.push(`[${game.invite_code}] FAILED ${target.email} (${target.stage}): ${error.message}`);
        continue;
      }

      // Record in NudgeLog for dedup
      await env.LOBBY_DB
        .prepare('INSERT INTO NudgeLog (game_id, email, nudge_type, sent_at) VALUES (?, ?, ?, ?)')
        .bind(game.id, target.email, target.stage, now.getTime())
        .run();

      logs.push(`[${game.invite_code}] SENT ${target.email} (${target.stage}): ${subject}`);
    } catch (err: any) {
      logs.push(`[${game.invite_code}] ERROR ${target.email} (${target.stage}): ${err.message}`);
    }
  }

  return logs;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date();
    console.log(`[Nudge] Cron fired at ${now.toISOString()}`);

    // Find all active CC games that are still recruiting or recently started
    const { results: games } = await env.LOBBY_DB
      .prepare(`
        SELECT id, invite_code, player_count, day_count, mode, config_json, status
        FROM GameSessions
        WHERE mode = 'CONFIGURABLE_CYCLE'
          AND status IN ('RECRUITING', 'READY', 'STARTED')
          AND config_json IS NOT NULL
      `)
      .all<ActiveGame>();

    if (!games.length) {
      console.log('[Nudge] No active CC games found');
      return;
    }

    for (const game of games) {
      try {
        const logs = await processGame(game, env, now);
        for (const log of logs) console.log(`[Nudge] ${log}`);
      } catch (err: any) {
        console.error(`[Nudge] Error processing ${game.invite_code}:`, err.message);
      }
    }
  },

  // HTTP endpoint for manual triggering
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/trigger' && request.method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${env.AUTH_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }

      const force = url.searchParams.get('force') === 'true';
      const gameFilter = url.searchParams.get('game'); // optional: filter to a single game code
      const dryRun = url.searchParams.get('dry') === 'true';

      const now = new Date();
      const { results: games } = await env.LOBBY_DB
        .prepare(`
          SELECT id, invite_code, player_count, day_count, mode, config_json, status
          FROM GameSessions
          WHERE mode = 'CONFIGURABLE_CYCLE'
            AND status IN ('RECRUITING', 'READY', 'STARTED')
            AND config_json IS NOT NULL
        `)
        .all<ActiveGame>();

      const filtered = gameFilter ? games.filter(g => g.invite_code === gameFilter) : games;

      const allLogs: string[] = [];
      for (const game of filtered) {
        try {
          const logs = await processGame(game, env, now, force, dryRun);
          allLogs.push(...logs);
        } catch (err: any) {
          allLogs.push(`Error processing ${game.invite_code}: ${err.message}`);
        }
      }

      return Response.json({ force, dryRun, logs: allLogs, timestamp: now.toISOString() });
    }

    if (url.pathname === '/status') {
      const { results: games } = await env.LOBBY_DB
        .prepare(`
          SELECT invite_code, status, config_json
          FROM GameSessions
          WHERE mode = 'CONFIGURABLE_CYCLE'
            AND status IN ('RECRUITING', 'READY', 'STARTED')
        `)
        .all<{ invite_code: string; status: string; config_json: string }>();

      const status = games.map(g => {
        const day1 = getDay1Start(g.config_json);
        return {
          code: g.invite_code,
          status: g.status,
          day1Start: day1?.toISOString() || null,
          minUntilDay1: day1 ? Math.round((day1.getTime() - Date.now()) / 60_000) : null,
        };
      });

      return Response.json({ games: status });
    }

    return new Response('Nudge Worker\n\nGET /status — check active games\nPOST /trigger — manually fire nudges (requires auth)', { status: 200 });
  },
};
