/**
 * Multi-player simulation script for integration testing.
 *
 * Creates a SMOKE_TEST game, connects all players via WebSocket,
 * and drives real interactions through each phase as alarms fire.
 *
 * Usage: node e2e/scripts/simulate-players.mjs [--visual]
 *   --visual: also output a URL for Playwright/browser visual inspection (player 1)
 *
 * Env vars:
 *   GAME_SERVER (default: http://localhost:8787)
 *   CLIENT_URL  (default: http://localhost:5173)
 *   AUTH_SECRET  (default: dev-secret-change-me)
 */

import { signGameToken } from '@pecking-order/auth';
import { WebSocket } from 'ws';
import fs from 'fs';

const GS = process.env.GAME_SERVER || 'http://localhost:8787';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` };
const VISUAL = process.argv.includes('--visual');
const PLAYER_COUNT = 3;

// ── Logging ──────────────────────────────────────────────────────────
const log = (tag, msg, data) => {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] [${tag}] ${msg}${extra}`);
};

// ── API helpers ──────────────────────────────────────────────────────
async function post(gameId, path, body) {
  const url = `${GS}/parties/game-server/${gameId}${path}`;
  const r = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} failed: ${r.status} ${await r.text()}`);
  return r;
}

async function getState(gameId) {
  const r = await fetch(`${GS}/parties/game-server/${gameId}/state`, { headers: { Authorization: `Bearer ${SECRET}` } });
  return r.json();
}

// ── Game creation ────────────────────────────────────────────────────
async function createGame() {
  const gameId = `sim-${Date.now()}`;
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const names = ['Silas Vane', 'Bella Rossi', 'Skyler Blue'];
  const pids = ['persona-04', 'persona-01', 'persona-19'];

  const roster = {};
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    roster[`p${i}`] = {
      realUserId: `u${i}`, personaName: names[i - 1],
      avatarUrl: `https://staging-assets.peckingorder.ca/personas/${pids[i - 1]}/headshot.png`,
      bio: 'Sim player', isAlive: true, isSpectator: false, silver: 50, gold: 0, destinyId: '',
    };
  }

  const manifest = {
    kind: 'DYNAMIC', id: gameId, gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED', startTime: new Date(Date.now() + 20_000).toISOString(),
    schedulePreset: 'SMOKE_TEST', maxPlayers: PLAYER_COUNT, days: [],
    ruleset: {
      kind: 'PECKING_ORDER',
      voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'FINALS'] },
      games: { mode: 'POOL', pool: ['TRIVIA'], avoidRepeat: true },
      activities: { mode: 'POOL', pool: ['HOT_TAKE'], avoidRepeat: true },
      social: { dmChars: { mode: 'FIXED', base: 1200 }, dmPartners: { mode: 'FIXED', base: 3 }, dmCost: 1, groupDmEnabled: true, requireDmInvite: false, dmSlotsPerPlayer: 5 },
      inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
      dayCount: { mode: 'FIXED', value: 2 },
    },
  };

  await post(gameId, '/init', { roster, manifest, inviteCode });
  await post(gameId, '/admin', { type: 'NEXT_STAGE' });

  const players = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const token = await signGameToken({ sub: `u${i}`, gameId, playerId: `p${i}`, personaName: names[i - 1] }, SECRET);
    players.push({ id: `p${i}`, name: names[i - 1], token, url: `${CLIENT}/game/${inviteCode}?_t=${token}&shell=vivid` });
  }

  return { gameId, inviteCode, players, names };
}

// ── Player bot ───────────────────────────────────────────────────────
class PlayerBot {
  constructor(gameId, player, voteTarget) {
    this.gameId = gameId;
    this.player = player;
    this.voteTarget = voteTarget;
    this.ws = null;
    this.lastPhase = null;
    this.lastSync = null;
    this.hasVoted = false;
    this.hasResponded = false;
    this.actions = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = GS.replace('http', 'ws') + `/parties/game-server/${this.gameId}?token=${this.player.token}`;
      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', () => {
        log(this.player.id, `Connected as ${this.player.name}`);
        resolve();
      });
      this.ws.on('error', (err) => {
        log(this.player.id, `WS error: ${err.message}`);
        reject(err);
      });
      this.ws.on('close', (code, reason) => {
        log(this.player.id, `WS closed: ${code} ${reason}`);
      });
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SYSTEM.SYNC') this.handleSync(msg);
        } catch { /* ignore non-JSON */ }
      });
    });
  }

  handleSync(msg) {
    this.lastSync = msg;
    const phase = msg.phase;
    const ctx = msg.context || {};

    if (phase !== this.lastPhase) {
      log(this.player.id, `Phase: ${this.lastPhase} → ${phase}`);
      this.lastPhase = phase;
    }

    // ── Vote when voting is active ──
    if (ctx.activeVotingCartridge && !this.hasVoted) {
      const vc = ctx.activeVotingCartridge;
      if (vc.phase === 'VOTING' || vc.phase === 'ACTIVE') {
        const eligible = vc.eligibleVoters || [];
        if (eligible.includes(this.player.id)) {
          this.castVote(vc.voteType);
        }
      }
    }

    // ── Respond to Hot Take when active ──
    if (ctx.activePromptCartridge && !this.hasResponded) {
      const pc = ctx.activePromptCartridge;
      if (pc.phase === 'ACTIVE' && pc.promptType === 'HOT_TAKE') {
        this.respondToHotTake();
      }
    }
  }

  castVote(voteType) {
    if (this.hasVoted) return;
    this.hasVoted = true;
    const event = { type: `VOTE.${voteType}.CAST`, targetId: this.voteTarget };
    log(this.player.id, `Voting for ${this.voteTarget}`, { voteType });
    this.ws.send(JSON.stringify(event));
    this.actions.push({ action: 'VOTE', target: this.voteTarget, voteType });
  }

  respondToHotTake() {
    if (this.hasResponded) return;
    this.hasResponded = true;
    const stances = ['AGREE', 'DISAGREE'];
    const stance = stances[Math.floor(Math.random() * 2)];
    const event = { type: 'ACTIVITY.HOTTAKE.RESPOND', stance };
    log(this.player.id, `Hot Take response: ${stance}`);
    this.ws.send(JSON.stringify(event));
    this.actions.push({ action: 'HOT_TAKE', stance });
  }

  resetForNewDay() {
    this.hasVoted = false;
    this.hasResponded = false;
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}

// ── Main simulation ──────────────────────────────────────────────────
async function main() {
  log('SIM', 'Creating SMOKE_TEST game...');
  const game = await createGame();
  log('SIM', `Game: ${game.gameId} | Invite: ${game.inviteCode}`);
  log('SIM', `Players: ${game.names.join(', ')}`);

  if (VISUAL) {
    log('SIM', '');
    log('SIM', '=== VISUAL INSPECTION URL (Player 1) ===');
    log('SIM', game.players[0].url);
    log('SIM', '=========================================');
    log('SIM', '');
  }

  // Save game info for Playwright
  fs.writeFileSync('/tmp/pecking-order-sim-game.json', JSON.stringify({
    gameId: game.gameId, inviteCode: game.inviteCode,
    stateUrl: `${GS}/parties/game-server/${game.gameId}/state`,
    players: game.players,
  }, null, 2));

  // Vote targets: p1→p3, p2→p3, p3→p1 (p3 gets eliminated with 2 votes)
  const voteTargets = { p1: 'p3', p2: 'p3', p3: 'p1' };

  // Connect all bots
  const bots = game.players.map(p => new PlayerBot(game.gameId, p, voteTargets[p.id]));
  log('SIM', 'Connecting all players...');
  await Promise.all(bots.map(b => b.connect()));
  log('SIM', 'All players connected. Waiting for alarms...');

  // Monitor game state
  let lastDay = 0;
  let gameOver = false;
  const results = { phases: [], votes: {}, elimination: null };

  const monitor = setInterval(async () => {
    try {
      const state = await getState(game.gameId);
      const day = state.day || 0;

      if (day > lastDay) {
        lastDay = day;
        log('SIM', `=== DAY ${day} STARTED ===`);
        bots.forEach(b => b.resetForNewDay());
        // Update vote targets for day 2 (FINALS)
        if (day === 2) {
          // In FINALS, eliminated players vote for a winner
          // Alive players are candidates, not voters
          log('SIM', 'FINALS — eliminated players will vote');
        }
      }

      // Check for elimination
      if (state.roster) {
        for (const [pid, p] of Object.entries(state.roster)) {
          if (p.status === 'ELIMINATED' && !results.elimination) {
            results.elimination = { playerId: pid, personaName: p.personaName };
            log('SIM', `*** ELIMINATED: ${p.personaName} (${pid}) ***`);
          }
        }
      }

      // Check for game over
      const stateStr = JSON.stringify(state.state);
      if (stateStr.includes('gameOver') || stateStr.includes('gameSummary')) {
        if (!gameOver) {
          gameOver = true;
          log('SIM', '=== GAME OVER ===');
        }
      }
    } catch { /* ignore fetch errors during transitions */ }
  }, 2000);

  // Run for up to 12 minutes (2 days × 5min + gaps)
  const MAX_RUNTIME = 12 * 60 * 1000;
  const startTime = Date.now();

  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (gameOver || Date.now() - startTime > MAX_RUNTIME) {
        clearInterval(check);
        clearInterval(monitor);
        resolve();
      }
    }, 1000);
  });

  // ── Report ──
  log('SIM', '');
  log('SIM', '=== SIMULATION REPORT ===');
  for (const bot of bots) {
    log('SIM', `${bot.player.name} (${bot.player.id}): ${bot.actions.length} actions`);
    for (const a of bot.actions) {
      log('SIM', `  ${a.action}: ${a.target || a.stance || ''}`);
    }
  }
  if (results.elimination) {
    log('SIM', `Eliminated: ${results.elimination.personaName} (${results.elimination.playerId})`);
  }

  // Verify
  const finalState = await getState(game.gameId);
  const roster = finalState.roster || {};
  const eliminated = Object.entries(roster).filter(([, p]) => p.status === 'ELIMINATED');
  const alive = Object.entries(roster).filter(([, p]) => p.status === 'ALIVE');

  log('SIM', '');
  log('SIM', '=== FINAL STATE ===');
  log('SIM', `Alive: ${alive.map(([id, p]) => `${p.personaName} (${id})`).join(', ')}`);
  log('SIM', `Eliminated: ${eliminated.map(([id, p]) => `${p.personaName} (${id})`).join(', ')}`);

  // Assertions
  let pass = true;
  if (eliminated.length === 0) {
    log('FAIL', 'No player was eliminated — votes may not have been cast');
    pass = false;
  }
  if (eliminated.some(([id]) => id === 'p3') && eliminated.length >= 1) {
    log('PASS', 'p3 (Skyler Blue) was correctly eliminated (received 2 votes)');
  } else if (eliminated.length > 0) {
    log('WARN', `Expected p3 eliminated, got: ${eliminated.map(([id]) => id).join(',')}`);
  }

  const botActions = bots.reduce((sum, b) => sum + b.actions.length, 0);
  if (botActions >= PLAYER_COUNT) {
    log('PASS', `${botActions} player actions recorded across ${PLAYER_COUNT} players`);
  } else {
    log('FAIL', `Only ${botActions} actions — expected at least ${PLAYER_COUNT}`);
    pass = false;
  }

  // Cleanup
  bots.forEach(b => b.disconnect());

  log('SIM', '');
  log('SIM', pass ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ===');
  process.exit(pass ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
