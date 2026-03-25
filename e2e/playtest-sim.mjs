import { chromium } from 'playwright';
import { signGameToken } from '@pecking-order/auth';

const GS = 'http://localhost:8787';
const CLIENT = 'http://localhost:5173';
const SECRET = 'dev-secret-change-me';
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` };
const SCREENSHOT_DIR = '/tmp/playtest-sim-screenshots';

const PLAYERS = [];
for (let i = 1; i <= 10; i++) {
  PLAYERS.push({ id: `p${i}`, name: `Player${i}`, silver: 110 - i * 10 });
}

async function post(gameId, path, body) {
  const res = await fetch(`${GS}/parties/game-server/${gameId}${path}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res;
}

async function getState(gameId) {
  const res = await fetch(`${GS}/parties/game-server/${gameId}/state`);
  return res.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const gameId = `sim-${Date.now()}`;
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

  console.log(`\n=== Playtest Simulator — 10 players, admin-driven ===`);
  console.log(`Game: ${gameId} | Invite: ${inviteCode}\n`);

  // ── Create game ──
  const manifest = {
    kind: 'DYNAMIC',
    id: gameId,
    gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED',
    startTime: new Date(Date.now() + 60_000).toISOString(),
    schedulePreset: 'SMOKE_TEST',
    minPlayers: 3,
    days: [],
    ruleset: {
      kind: 'PECKING_ORDER',
      voting: {
        allowed: ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'PODIUM_SACRIFICE', 'SHIELD'],
        constraints: [
          { voteType: 'BUBBLE', minPlayers: 6 },
          { voteType: 'PODIUM_SACRIFICE', minPlayers: 5 },
          { voteType: 'EXECUTIONER', minPlayers: 5 },
          { voteType: 'SHIELD', minPlayers: 4 },
        ],
      },
      games: { allowed: ['TRIVIA', 'GAP_RUN', 'SEQUENCE'], avoidRepeat: true },
      activities: { allowed: ['HOT_TAKE', 'CONFESSION', 'PLAYER_PICK'], avoidRepeat: true },
      dilemmas: { mode: 'POOL', allowed: ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'], avoidRepeat: true },
      social: { dmChars: { mode: 'FIXED', base: 1200 }, dmPartners: { mode: 'FIXED', base: 3 }, dmCost: 1, groupDmEnabled: true, requireDmInvite: false, dmSlotsPerPlayer: 5 },
      inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
    },
  };

  await post(gameId, '/init', { roster: {}, manifest, inviteCode });
  console.log('Game created.');

  // ── Join players ──
  for (const p of PLAYERS) {
    await post(gameId, '/player-joined', {
      playerId: p.id, realUserId: `sim-${p.id}`, personaName: p.name,
      avatarUrl: '', bio: `Sim player ${p.name}`, silver: p.silver,
    });
  }
  console.log(`${PLAYERS.length} players joined.\n`);

  // ── Sign tokens for 3 observer pages ──
  const tokens = {};
  for (const pid of ['p1', 'p2', 'p3']) {
    tokens[pid] = await signGameToken(
      { sub: `sim-${pid}`, gameId, playerId: pid, personaName: PLAYERS.find(p => p.id === pid).name },
      SECRET,
    );
  }

  // ── Launch browser with 3 tabs ──
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } }); // mobile viewport
  const pages = {};
  for (const pid of ['p1', 'p2', 'p3']) {
    const page = await context.newPage();
    // Suppress PWA gate
    await page.addInitScript(() => { sessionStorage.setItem('po_gate_deferred', '1'); });
    await page.goto(`${CLIENT}/game/${inviteCode}?_t=${tokens[pid]}&shell=vivid`);
    pages[pid] = page;
    console.log(`${pid} connected to client.`);
  }

  await sleep(3000);

  // ── Day loop ──
  let state = await getState(gameId);
  let dayNum = 0;
  const dayLog = [];

  while (state.state !== 'gameSummary' && state.state !== 'gameOver' && dayNum < 12) {
    dayNum++;

    // Start day
    await post(gameId, '/admin', { type: 'NEXT_STAGE' });
    await sleep(1500);
    state = await getState(gameId);

    if (state.state === 'gameSummary' || state.state === 'gameOver') break;

    const day = state.manifest?.days?.find(d => d.dayIndex === state.day);
    // Build alive list with IDs (roster keys are player IDs, values may not have .id)
    const alive = Object.entries(state.roster)
      .filter(([, p]) => p.status === 'ALIVE')
      .map(([id, p]) => ({ id, ...p }));
    console.log(`--- Day ${state.day}: ${day?.voteType || '?'} | ${alive.length} alive | game: ${day?.gameType || 'NONE'} | activity: ${day?.activityType || 'NONE'} | dilemma: ${day?.dilemmaType || 'NONE'} ---`);

    dayLog.push({
      day: state.day,
      alive: alive.length,
      voteType: day?.voteType,
      gameType: day?.gameType,
      activityType: day?.activityType || 'NONE',
      dilemmaType: day?.dilemmaType || 'NONE',
    });

    // Open chat + DMs
    await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_GROUP_CHAT' });
    await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_DMS' });
    await sleep(1000);

    // Screenshot after chat opens
    await pages.p1.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-chat.png` });

    // Start dilemma if present
    if (day?.dilemmaType && day.dilemmaType !== 'NONE') {
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'START_DILEMMA' });
      await sleep(1000);
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'END_DILEMMA' });
    }

    // Start game if present
    if (day?.gameType && day.gameType !== 'NONE') {
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'START_GAME' });
      await sleep(1500);
      await pages.p2.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-game.png` });
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'END_GAME' });
      await sleep(500);
    }

    // Start activity if present
    if (day?.activityType && day.activityType !== 'NONE') {
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'START_ACTIVITY' });
      await sleep(1500);
      await pages.p3.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-activity.png` });
      await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'END_ACTIVITY' });
      await sleep(500);
    }

    // Open voting
    await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_VOTING' });
    await sleep(1000);
    await pages.p1.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-voting.png` });

    // Cast bot votes — target lowest silver alive (deterministic)
    const aliveSorted = alive.sort((a, b) => a.silver - b.silver);
    const voteType = day?.voteType || 'MAJORITY';

    if (voteType === 'FINALS') {
      // Eliminated players vote for first alive player
      const eliminated = Object.entries(state.roster)
        .filter(([, p]) => p.status === 'ELIMINATED')
        .map(([id, p]) => ({ id, ...p }));
      for (const voter of eliminated) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.FINALS.CAST', targetId: alive[0].id },
        });
      }
    } else if (voteType === 'EXECUTIONER') {
      // All vote to elect first alive bot, then executioner picks lowest silver
      for (const voter of alive) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.EXECUTIONER.ELECT', targetId: alive[alive.length - 1].id },
        });
      }
    } else if (voteType === 'SHIELD') {
      for (const voter of alive) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.SHIELD.SAVE', targetId: voter.id },
        });
      }
    } else if (voteType === 'BUBBLE') {
      for (const voter of alive) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.BUBBLE.CAST', targetId: aliveSorted[0].id },
        });
      }
    } else if (voteType === 'PODIUM_SACRIFICE') {
      for (const voter of alive) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.PODIUM_SACRIFICE.CAST', targetId: aliveSorted[aliveSorted.length - 1].id },
        });
      }
    } else {
      // MAJORITY — all vote for lowest silver
      for (const voter of alive) {
        await post(gameId, '/admin', {
          type: 'SEND_PLAYER_EVENT', senderId: voter.id,
          event: { type: 'VOTE.MAJORITY.CAST', targetId: aliveSorted[0].id },
        });
      }
    }

    // Close voting
    await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'CLOSE_VOTING' });
    await sleep(1000);

    // Check who was eliminated
    state = await getState(gameId);
    await pages.p1.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-result.png` });

    // End day
    await post(gameId, '/admin', { type: 'INJECT_TIMELINE_EVENT', action: 'END_DAY' });
    await sleep(1500);
    state = await getState(gameId);

    const nowAlive = Object.entries(state.roster).filter(([, p]) => p.status === 'ALIVE').map(([id, p]) => ({ id, ...p }));
    const eliminated = Object.entries(state.roster).filter(([, p]) => p.status === 'ELIMINATED').map(([id, p]) => p.personaName);
    console.log(`  → ${nowAlive.length} alive. Eliminated so far: ${eliminated.join(', ')}`);

    await pages.p1.screenshot({ path: `${SCREENSHOT_DIR}/day${state.day}-night.png` });

    if (state.state === 'gameSummary' || state.state === 'gameOver') break;
  }

  // Final state
  state = await getState(gameId);
  console.log(`\n=== GAME OVER ===`);
  console.log(`Final state: ${JSON.stringify(state.state)}`);
  console.log(`Days played: ${dayLog.length}`);
  console.log('\nDay Log:');
  console.log('Day | Alive | Vote             | Game        | Activity     | Dilemma');
  console.log('----|-------|------------------|-------------|--------------|--------');
  for (const d of dayLog) {
    console.log(`  ${d.day} |   ${String(d.alive).padStart(2)} | ${(d.voteType||'?').padEnd(16)} | ${(d.gameType||'NONE').padEnd(11)} | ${d.activityType.padEnd(12)} | ${d.dilemmaType}`);
  }

  console.log('\nFinal roster:');
  for (const [id, p] of Object.entries(state.roster).sort()) {
    console.log(`  ${id}: ${p.personaName} — ${p.status} (silver: ${p.silver})`);
  }

  await pages.p1.screenshot({ path: `${SCREENSHOT_DIR}/final.png` });
  await browser.close();
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
