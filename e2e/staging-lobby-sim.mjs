import { chromium } from 'playwright';
import { signGameToken } from '@pecking-order/auth';
import fs from 'fs';

const LOBBY = 'https://staging-lobby.peckingorder.ca';
const CLIENT = 'https://staging-play.peckingorder.ca';
const GS = 'https://staging-api.peckingorder.ca';
const SECRET = fs.readFileSync('apps/game-server/.env.staging-secret', 'utf8').trim();
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRET };
const SCREENSHOT_DIR = '/tmp/staging-lobby-sim';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getState(gameId) {
  const res = await fetch(`${GS}/parties/game-server/${gameId}/state`);
  return res.json();
}

async function adminPost(gameId, body) {
  const res = await fetch(`${GS}/parties/game-server/${gameId}/admin`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  if (!res.ok) console.error('Admin failed:', res.status, await res.text());
  return res;
}

async function main() {
  const browser = await chromium.launch({ headless: false }); // visible browser
  
  // ── Step 1: Auth as admin and create game via lobby ──
  console.log('\n=== Step 1: Create game via lobby ===');
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  
  await adminPage.goto(LOBBY + '/login');
  await adminPage.fill('#email', 'admin@peckingorder.ca');
  await adminPage.click('button[type="submit"]');
  await adminPage.getByText('Click to Sign In').click();
  await adminPage.waitForURL(LOBBY + '/');
  console.log('Admin authenticated.');

  // Toggle to Dynamic
  const toggle = adminPage.locator('[data-testid="manifest-kind-toggle"] input[type="checkbox"]');
  if (!(await toggle.isChecked())) {
    await adminPage.locator('[data-testid="manifest-kind-toggle"]').click();
  }
  await sleep(500);

  // Select Speed Run preset (fastest for testing)
  await adminPage.locator('[data-testid="preset-SPEED_RUN"]').locator('..').click();
  await sleep(300);

  // Start time: now + 5 min
  const nowBtn = adminPage.locator('[data-testid="start-time-now-btn"]');
  if (await nowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nowBtn.click();
  }
  
  // Create
  await adminPage.locator('[data-testid="create-game-btn"]').click();
  const inviteEl = adminPage.locator('[data-testid="invite-code"]');
  await inviteEl.waitFor({ timeout: 15000 });
  const inviteCode = (await inviteEl.textContent()).trim();
  
  const statusText = await adminPage.locator('[data-testid="status-output"]').textContent();
  const match = statusText.match(/GAME_CREATED:\s*([A-Za-z0-9-]+)/);
  const gameId = match?.[1] || '';
  
  console.log('Game created: ' + gameId + ' | Invite: ' + inviteCode);
  await adminPage.screenshot({ path: SCREENSHOT_DIR + '/01-game-created.png' });

  // ── Step 2: Join 5 bots via real lobby join wizard ──
  console.log('\n=== Step 2: Join 5 bots via lobby ===');
  
  for (let i = 2; i <= 6; i++) {
    const email = 'staging-bot' + i + '-' + Date.now() + '@test.peckingorder.ca';
    const botCtx = await browser.newContext();
    const botPage = await botCtx.newPage();
    
    // Auth
    await botPage.goto(LOBBY + '/login');
    await botPage.fill('#email', email);
    await botPage.click('button[type="submit"]');
    await botPage.getByText('Click to Sign In').click();
    await botPage.waitForURL(LOBBY + '/');
    
    // Join
    await botPage.goto(LOBBY + '/join/' + inviteCode);
    await botPage.waitForTimeout(2000);
    
    // Lock in persona
    await botPage.getByRole('button', { name: 'Lock In' }).click();
    await botPage.waitForTimeout(1500);
    
    // Continue past bio (pre-filled)
    await botPage.getByRole('button', { name: 'Continue' }).click();
    await botPage.waitForTimeout(1500);
    
    // Skip Q&A
    const skip = botPage.getByRole('button', { name: 'Skip' });
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skip.click();
      await botPage.waitForTimeout(1500);
    }
    
    // Confirm join
    for (const name of ['Join Game', 'Confirm', 'Enter']) {
      const btn = botPage.getByRole('button', { name, exact: false });
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }
    await botPage.waitForTimeout(2000);
    
    console.log('Bot p' + i + ': ' + botPage.url());
    if (i === 2) {
      await botPage.screenshot({ path: SCREENSHOT_DIR + '/02-bot-joined.png' });
    }
    await botCtx.close();
  }

  // ── Step 3: Check game state ──
  console.log('\n=== Step 3: Verify game state ===');
  const state = await getState(gameId);
  console.log('State: ' + state.state);
  console.log('Roster: ' + Object.keys(state.roster).length + ' players');
  for (const [pid, p] of Object.entries(state.roster).sort()) {
    console.log('  ' + pid + ': ' + p.personaName + ' (silver: ' + p.silver + ')');
  }
  console.log('Manifest kind: ' + state.manifest?.kind);
  console.log('Start time: ' + state.manifest?.startTime);
  console.log('Min players: ' + state.manifest?.minPlayers);

  // ── Step 4: Give human a join link ──
  console.log('\n=== YOUR JOIN LINK ===');
  console.log(LOBBY + '/join/' + inviteCode);
  console.log('\nJoin now! Game starts in ~2 min (Speed Run: now+2min).');
  console.log('Or wait for alarm, then observe via client.');

  // ── Step 5: Wait for game to start via alarm ──
  console.log('\n=== Step 5: Waiting for alarm to start game... ===');
  let started = false;
  for (let i = 0; i < 40; i++) { // 40 * 5s = 200s max wait
    await sleep(5000);
    const s = await getState(gameId);
    if (s.state !== 'preGame' && s.state !== 'uninitialized') {
      console.log('Game started! State: ' + JSON.stringify(s.state) + ' Day: ' + s.day);
      started = true;
      
      // Check Day 1 manifest
      if (s.manifest?.days?.length > 0) {
        const day1 = s.manifest.days[0];
        console.log('Day 1: ' + day1.voteType + ' | game: ' + (day1.gameType || 'NONE') + ' | activity: ' + (day1.activityType || 'NONE') + ' | dilemma: ' + (day1.dilemmaType || 'NONE'));
        console.log('Timeline events: ' + day1.timeline.length);
        const hasInjectPrompt = day1.timeline.some(e => e.action === 'INJECT_PROMPT');
        console.log('GM briefing: ' + (hasInjectPrompt ? 'YES' : 'MISSING'));
      }
      break;
    }
    process.stdout.write('.');
  }
  
  if (!started) {
    console.log('\nGame did not start within timeout. Checking state...');
    const s = await getState(gameId);
    console.log('State: ' + s.state + ' Roster: ' + Object.keys(s.roster).length);
  }

  // ── Step 6: Connect as observer via client ──
  if (started) {
    console.log('\n=== Step 6: Connecting observer to client ===');
    const p1Id = Object.keys((await getState(gameId)).roster).sort()[0];
    const token = await signGameToken(
      { sub: 'staging-observer', gameId, playerId: p1Id, personaName: 'Observer' },
      SECRET,
    );
    const observerPage = await adminCtx.newPage();
    await observerPage.addInitScript(() => { sessionStorage.setItem('po_gate_deferred', '1'); });
    await observerPage.goto(CLIENT + '/game/' + inviteCode + '?_t=' + token + '&shell=vivid');
    await sleep(3000);
    await observerPage.screenshot({ path: SCREENSHOT_DIR + '/03-client-day1.png' });
    console.log('Client screenshot saved.');
    
    // Monitor for a few minutes
    console.log('\nMonitoring game progression...');
    for (let i = 0; i < 12; i++) {
      await sleep(30000);
      const s = await getState(gameId);
      const alive = Object.values(s.roster).filter(p => p.status === 'ALIVE').length;
      console.log('  ' + new Date().toISOString().slice(11,19) + ' | state: ' + JSON.stringify(s.state) + ' | day: ' + s.day + ' | alive: ' + alive + ' | days resolved: ' + s.manifest?.days?.length);
      await observerPage.screenshot({ path: SCREENSHOT_DIR + '/monitor-' + i + '.png' });
      
      if (s.state === 'gameSummary' || s.state === 'gameOver') {
        console.log('Game finished!');
        break;
      }
    }
  }

  await browser.close();
  console.log('\nScreenshots: ' + SCREENSHOT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
