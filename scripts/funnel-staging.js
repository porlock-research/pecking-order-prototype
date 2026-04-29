// Per-slot funnel report for a staging DYNAMIC + frictionless game.
//   node scripts/funnel-staging.js <INVITE_CODE>  (defaults SBCSJT)
//
// Joins lobby D1 (Invites + Users) with journal D1 (PREGAME_PLAYER_JOINED,
// PREGAME_REVEAL_ANSWER) to compute each claimed slot's funnel state.
// Layers Axiom HTTP-access counts for /j/CODE, /play/CODE, refresh-token,
// and game-server WS-reject signals (4001/4003/4008).
//
// Output: structured markdown to stdout. Pipe to a file if you want to keep
// a series.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INVITE_CODE = (process.argv[2] || 'SBCSJT').toUpperCase();
const STAGING_HOST = 'staging-api.peckingorder.ca';
const SECRET = fs.readFileSync(
  path.resolve(__dirname, '..', 'apps', 'game-server', '.env.staging-secret'),
  'utf8',
).trim();
const LOBBY_DIR = path.resolve(__dirname, '..', 'apps', 'lobby');
const GAME_SERVER_DIR = path.resolve(__dirname, '..', 'apps', 'game-server');
const AXIOM_QUERY = path.resolve(GAME_SERVER_DIR, '.agents', 'skills', 'axiom-sre', 'scripts', 'axiom-query');

function d1Json(db, sql) {
  const out = execFileSync(
    'npx', ['wrangler', 'd1', 'execute', db, '--remote', '--json', '--command', sql],
    { cwd: LOBBY_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  ).toString();
  try {
    const parsed = JSON.parse(out);
    return parsed?.[0]?.results ?? [];
  } catch (e) {
    return [];
  }
}

function axiomQuery(query, since = '6h') {
  try {
    const out = execFileSync(
      AXIOM_QUERY, ['staging', '--since', since, '--ndjson'],
      { input: query, stdio: ['pipe', 'pipe', 'pipe'] },
    ).toString();
    return out.split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    return { error: String(e.stderr || e.message || e).slice(0, 200) };
  }
}

async function fetchState(gameId) {
  const r = await fetch(`https://${STAGING_HOST}/parties/game-server/${gameId}/state`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  if (!r.ok) return null;
  return r.json();
}

function fmt(ts) {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function age(ts) {
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m ago`;
}

async function main() {
  console.log(`# Funnel report — ${INVITE_CODE} — ${new Date().toISOString()}\n`);

  // ── 1. Resolve gameId + manifest details ─────────────────────────────
  const gs = d1Json('pecking-order-lobby-db-staging',
    `SELECT id, status, player_count FROM GameSessions WHERE invite_code = '${INVITE_CODE}'`);
  if (gs.length === 0) {
    console.log(`No staging game for invite code ${INVITE_CODE}`);
    return;
  }
  const gameId = gs[0].id;
  console.log(`gameId: \`${gameId}\``);

  // We need the manifest to know DYNAMIC vs STATIC, min/max, and start time
  const liveState = await fetchState(gameId);
  const manifest = liveState?.manifest ?? {};
  const isDynamic = manifest.kind === 'DYNAMIC';
  const minPlayers = manifest.minPlayers ?? 3;
  const maxPlayers = manifest.maxPlayers; // undefined = no cap
  console.log(`status: ${gs[0].status} · ${isDynamic ? 'DYNAMIC (open-roster)' : 'STATIC'} · minPlayers ${minPlayers}${maxPlayers ? ` · maxPlayers ${maxPlayers}` : ' · no max cap'}`);
  if (manifest.startTime) console.log(`startTime: ${manifest.startTime} (${age(new Date(manifest.startTime).getTime())})`);
  console.log('');

  // ── 2. Invites + Users (lobby D1) ─────────────────────────────────────
  const invites = d1Json('pecking-order-lobby-db-staging',
    `SELECT i.slot_index, i.persona_id, i.accepted_by, i.accepted_at,
            i.qa_answers IS NOT NULL AS has_qa,
            u.email, u.contact_handle
     FROM Invites i
     LEFT JOIN Users u ON u.id = i.accepted_by
     WHERE i.game_id = '${gameId}'
     ORDER BY i.slot_index`);

  // ── 3. Journal facts ──────────────────────────────────────────────────
  const facts = d1Json('pecking-order-journal-db-staging',
    `SELECT actor_id, event_type, timestamp
     FROM GameJournal WHERE game_id = '${gameId}'
       AND event_type IN ('PREGAME_PLAYER_JOINED','PREGAME_REVEAL_ANSWER')`);

  const joinedAt = {};
  const revealedAt = {};
  for (const f of facts) {
    if (f.event_type === 'PREGAME_PLAYER_JOINED') joinedAt[f.actor_id] = f.timestamp;
    else if (f.event_type === 'PREGAME_REVEAL_ANSWER') revealedAt[f.actor_id] = f.timestamp;
  }

  // ── 4. L2 roster summary ──────────────────────────────────────────────
  const rosterIds = Object.keys(liveState?.roster ?? {});
  const aliveCount = Object.values(liveState?.roster ?? {}).filter((p) => p.status === 'ALIVE').length;
  const readyToStart = aliveCount >= minPlayers;
  console.log(`L2 state: \`${JSON.stringify(liveState?.state)}\` · day ${liveState?.day} · roster ${aliveCount}/${minPlayers}+ alive ${readyToStart ? '✓ ready' : '✗ below min'} · ids [${rosterIds.sort().join(', ')}]\n`);

  // ── 5. Per-slot funnel ────────────────────────────────────────────────
  console.log(`## Per-slot funnel\n`);
  console.log(`| slot | identity | claim | join | reveal | status |`);
  console.log(`|---|---|---|---|---|---|`);
  const anomalies = [];
  for (const i of invites) {
    const pid = `p${i.slot_index}`;
    const claimAge = i.accepted_at ? age(i.accepted_at) : '—';
    const joinAge = joinedAt[pid] ? age(joinedAt[pid]) : '—';
    const revealAge = revealedAt[pid] ? age(revealedAt[pid]) : '—';
    const inRoster = rosterIds.includes(pid);
    const claimedOk = !!i.accepted_by;
    const joinedOk = !!joinedAt[pid];
    const revealedOk = !!revealedAt[pid];

    let status;
    if (revealedOk) status = '✓ all green';
    else if (joinedOk) {
      status = '⚠ joined, awaiting first connect';
      anomalies.push({
        slot: i.slot_index, pid, severity: 'low',
        kind: 'joined-no-reveal',
        proposed: 'force-connect (proven safe — Mack pattern)',
        identity: i.email || i.contact_handle || '?',
      });
    }
    else if (claimedOk) {
      status = '✗ claimed but no /player-joined';
      anomalies.push({
        slot: i.slot_index, pid, severity: 'high',
        kind: 'claim-no-join',
        proposed: 'investigate /player-joined HTTP failure in Axiom; manual /player-joined re-fire',
        identity: i.email || i.contact_handle || '?',
      });
    }
    else status = '— unclaimed';

    if (claimedOk && !inRoster && !joinedOk) {
      // Stronger signal: claim but no L2 roster row AND no journal record
      // (already covered above)
    }

    const id = i.email || i.contact_handle || (i.accepted_by ? `(anon ${i.accepted_by.slice(0,8)})` : '—');
    console.log(`| ${i.slot_index} | ${id} | ${claimedOk ? '✓ '+claimAge : '—'} | ${joinedOk ? '✓ '+joinAge : '—'} | ${revealedOk ? '✓ '+revealAge : '—'} | ${status} |`);
  }
  if (!isDynamic) {
    // STATIC games pre-create Invites for every slot at game-create time —
    // unfilled slots are meaningful "no-show" signals. DYNAMIC games create
    // Invites on-the-fly at claim time, so any "missing slot" is just
    // "not claimed yet" and not a per-row anomaly.
    const filled = new Set(invites.map(i => i.slot_index));
    for (let s = 1; s <= (gs[0].player_count ?? 0); s++) {
      if (!filled.has(s)) console.log(`| ${s} | (no claim) | — | — | — | unclaimed |`);
    }
  } else if (invites.length === 0) {
    console.log(`| — | (no claims yet) | | | | |`);
  }
  console.log('');

  // ── 6. Axiom — wizard activity (last 30 min) ──────────────────────────
  console.log(`## Wizard funnel (last 30 min via Axiom)\n`);
  const since = '30m';

  // Visits to /j/CODE (lobby HTTP)
  const visits = axiomQuery(
    `['po-logs-staging']
     | where ['service.name'] == 'pecking-order-lobby-staging'
     | where ['attributes.url.path'] startswith '/j/${INVITE_CODE}'
     | summarize visits=count(), uniq=dcount(['attributes.cloudflare.ray_id'])`,
    since,
  );
  if (Array.isArray(visits) && visits[0]) {
    console.log(`- /j/${INVITE_CODE} visits: ${visits[0].visits ?? 0} (${visits[0].uniq ?? 0} unique rays)`);
  } else if (visits.error) {
    console.log(`- /j/${INVITE_CODE}: Axiom error — ${visits.error}`);
  }

  // /play/CODE GETs
  const plays = axiomQuery(
    `['po-logs-staging']
     | where ['service.name'] == 'pecking-order-lobby-staging'
     | where ['attributes.url.path'] startswith '/play/${INVITE_CODE}'
     | summarize visits=count()`,
    since,
  );
  if (Array.isArray(plays) && plays[0]) {
    console.log(`- /play/${INVITE_CODE} visits: ${plays[0].visits ?? 0}`);
  }

  // refresh-token errors
  const refreshErrors = axiomQuery(
    `['po-logs-staging']
     | where ['service.name'] == 'pecking-order-lobby-staging'
     | where ['attributes.url.path'] startswith '/api/refresh-token'
     | where ['severity'] in ('error','warn') or toint(['attributes.http.response.status_code']) >= 400
     | summarize errors=count()`,
    since,
  );
  if (Array.isArray(refreshErrors) && refreshErrors[0]) {
    console.log(`- refresh-token errors: ${refreshErrors[0].errors ?? 0}`);
  }

  // WS rejects (game-server)
  const wsRejects = axiomQuery(
    `['po-logs-staging']
     | where ['service.name'] == 'game-server-staging'
     | where body contains 'social.reject' or body contains 'WS reject' or body contains '4003' or body contains '4008'
     | summarize rejects=count()`,
    since,
  );
  if (Array.isArray(wsRejects) && wsRejects[0]) {
    console.log(`- WS rejects: ${wsRejects[0].rejects ?? 0}`);
  }
  console.log('');

  // ── 7. Anomalies ──────────────────────────────────────────────────────
  console.log(`## Anomalies\n`);
  if (anomalies.length === 0) console.log('(none)');
  else for (const a of anomalies) {
    console.log(`- **[${a.severity}]** slot ${a.slot} (${a.pid}, ${a.identity}): ${a.kind}`);
    console.log(`  - proposed: ${a.proposed}`);
  }
  console.log('');

  // ── 8. Pointers (Sentry needs MCP) ────────────────────────────────────
  console.log(`## Sentry layer (run separately)\n`);
  console.log(`Use Sentry MCP from main agent context to fetch:`);
  console.log(`- recent issues for organization, project=lobby (last 30 min)`);
  console.log(`- recent issues for organization, project=client filtered to gameId tag`);
}

main().catch((e) => { console.error(e); process.exit(1); });
