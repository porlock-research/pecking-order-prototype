import { chromium } from 'playwright';
import { signGameToken } from '@pecking-order/auth';
import fs from 'fs';

const LOBBY = 'https://staging-lobby.peckingorder.ca';
const CLIENT = 'https://staging-play.peckingorder.ca';
const GS = 'https://staging-api.peckingorder.ca';
const SECRET = fs.readFileSync('apps/game-server/.env.staging-secret', 'utf8').trim();
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRET };
const SCREENSHOT_DIR = '/tmp/staging-hybrid-sim';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getState(gameId) {
  const res = await fetch(GS + '/parties/game-server/' + gameId + '/state');
  return res.json();
}
async function post(gameId, path, body) {
  const res = await fetch(GS + '/parties/game-server/' + gameId + path, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  if (!res.ok) console.error(path + ' failed:', res.status, await res.text());
  return res;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── Auth via magic link token from D1 ──
  console.log('\n=== Auth via magic link token ===');
  await page.goto(LOBBY + '/login/verify?token=5e52bb25c5ae9bc211acca36e10796ccb86b1d2661aeaa0c7226edc875ad4587');
  await page.waitForURL(url => !url.pathname.includes('/login/verify'), { timeout: 15000 });
  console.log('Authenticated: ' + page.url());
  await page.screenshot({ path: SCREENSHOT_DIR + '/00-authed.png' });

  // ── Create dynamic game ──
  console.log('\n=== Creating dynamic game ===');
  await page.goto(LOBBY + '/');
  await sleep(1000);

  // Toggle Dynamic
  const toggle = page.locator('[data-testid="manifest-kind-toggle"] input[type="checkbox"]');
  if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (!(await toggle.isChecked())) {
      await page.locator('[data-testid="manifest-kind-toggle"]').click();
    }
  }
  await sleep(500);

  // Speed Run preset
  const preset = page.locator('[data-testid="preset-SPEED_RUN"]');
  if (await preset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await preset.locator('..').click();
  }
  await sleep(300);

  // Start time now+2min
  const nowBtn = page.locator('[data-testid="start-time-now-btn"]');
  if (await nowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nowBtn.click();
  }

  // Create
  await page.locator('[data-testid="create-game-btn"]').click();
  const inviteEl = page.locator('[data-testid="invite-code"]');
  await inviteEl.waitFor({ timeout: 15000 });
  const inviteCode = (await inviteEl.textContent()).trim();
  const statusText = await page.locator('[data-testid="status-output"]').textContent();
  const gameIdMatch = statusText.match(/GAME_CREATED:\s*([A-Za-z0-9-]+)/);
  const gameId = gameIdMatch?.[1] || '';

  console.log('Game: ' + gameId);
  console.log('Invite: ' + inviteCode);
  await page.screenshot({ path: SCREENSHOT_DIR + '/01-created.png' });

  // ── Join 5 bots via /player-joined ──
  console.log('\n=== Joining 5 bots ===');
  const BOTS = [
    { id: 'p2', name: 'Bella Rossi', persona: 'persona-01', silver: 90 },
    { id: 'p3', name: 'Chad Brock', persona: 'persona-02', silver: 80 },
    { id: 'p4', name: 'Sheila Bear', persona: 'persona-03', silver: 70 },
    { id: 'p5', name: 'Silas Vane', persona: 'persona-04', silver: 60 },
    { id: 'p6', name: 'Brick Thompson', persona: 'persona-05', silver: 50 },
  ];
  for (const bot of BOTS) {
    await post(gameId, '/player-joined', {
      playerId: bot.id, realUserId: 'bot-' + bot.id, personaName: bot.name,
      avatarUrl: 'https://staging-assets.peckingorder.ca/personas/' + bot.persona + '/headshot.png',
      bio: 'Bot ' + bot.name, silver: bot.silver,
    });
    console.log('  ' + bot.id + ': ' + bot.name);
  }

  // Verify
  let state = await getState(gameId);
  console.log('\nRoster: ' + Object.keys(state.roster).length + ' | State: ' + state.state);
  console.log('Start: ' + state.manifest?.startTime);

  // ── Print join link ──
  console.log('\n=== JOIN LINK ===');
  console.log(LOBBY + '/join/' + inviteCode);

  // ── Observer token ──
  const obsToken = await signGameToken(
    { sub: 'bot-p2', gameId, playerId: 'p2', personaName: 'Bella Rossi' }, SECRET,
  );
  console.log('\nDirect observer link:');
  console.log(CLIENT + '/game/' + inviteCode + '?_t=' + obsToken + '&shell=vivid');

  // ── Wait for alarm ──
  console.log('\n=== Waiting for alarm (~2 min)... ===');
  let started = false;
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    state = await getState(gameId);
    const s = typeof state.state === 'string' ? state.state : JSON.stringify(state.state);
    if (i % 6 === 0) console.log('  ' + Math.floor(i*5) + 's | ' + s + ' | roster: ' + Object.keys(state.roster).length);
    if (state.state !== 'preGame' && state.state !== 'uninitialized') {
      started = true;
      console.log('\nGame started! Day: ' + state.day);
      if (state.manifest?.days?.length > 0) {
        const d = state.manifest.days[0];
        console.log('Day 1: ' + d.voteType + ' | game: ' + (d.gameType||'NONE') + ' | activity: ' + (d.activityType||'NONE') + ' | dilemma: ' + (d.dilemmaType||'NONE'));
        console.log('Timeline: ' + d.timeline.length + ' events');
      }
      break;
    }
  }

  if (!started) {
    console.log('\nTimeout. State: ' + JSON.stringify(state.state));
    await browser.close();
    return;
  }

  // ── Connect observer ──
  const obsPage = await ctx.newPage();
  await obsPage.addInitScript(() => { sessionStorage.setItem('po_gate_deferred', '1'); });
  await obsPage.goto(CLIENT + '/game/' + inviteCode + '?_t=' + obsToken + '&shell=vivid');
  await sleep(3000);
  await obsPage.screenshot({ path: SCREENSHOT_DIR + '/02-client-day1.png' });
  console.log('\nObserver connected. Monitoring...');

  // ── Monitor progression ──
  for (let i = 0; i < 30; i++) {
    await sleep(15000);
    state = await getState(gameId);
    const alive = Object.values(state.roster).filter(p => p.status === 'ALIVE').length;
    const s = typeof state.state === 'string' ? state.state : JSON.stringify(state.state);
    console.log('  ' + new Date().toISOString().slice(11,19) + ' | ' + s + ' | day ' + state.day + ' | alive: ' + alive);
    await obsPage.screenshot({ path: SCREENSHOT_DIR + '/monitor-' + String(i).padStart(2,'0') + '.png' });
    if (state.state === 'gameSummary' || state.state === 'gameOver') {
      console.log('\n=== GAME COMPLETE ===');
      for (const [id, p] of Object.entries(state.roster).sort()) {
        console.log('  ' + id + ': ' + p.personaName + ' — ' + p.status);
      }
      break;
    }
  }

  await obsPage.screenshot({ path: SCREENSHOT_DIR + '/final.png' });
  await browser.close();
  console.log('\nScreenshots: ' + SCREENSHOT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
