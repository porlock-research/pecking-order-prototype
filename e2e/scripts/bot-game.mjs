/**
 * Creates a DYNAMIC/PRE_SCHEDULED/SMOKE_TEST game with bot players.
 * You play as p1, bots handle p2-p4.
 *
 * Usage: GAME_SERVER=http://localhost:8788 CLIENT_URL=http://localhost:5176 node e2e/scripts/bot-game.mjs
 */

import { signGameToken } from '@pecking-order/auth';
import { WebSocket } from 'ws';

const GS = process.env.GAME_SERVER || 'http://localhost:8787';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` };

const names = ['Silas Vane', 'Bella Rossi', 'Skyler Blue', 'Ember Stone'];
const pids = ['persona-04', 'persona-01', 'persona-19', 'persona-09'];
const PLAYER_COUNT = 4;

async function post(gameId, path, body) {
  const r = await fetch(`${GS}/parties/game-server/${gameId}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

async function main() {
  const gid = `smoketest-${Date.now()}`;
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const roster = {};
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    roster[`p${i}`] = {
      realUserId: `u${i}`, personaName: names[i - 1],
      avatarUrl: `https://staging-assets.peckingorder.ca/personas/${pids[i - 1]}/headshot.png`,
      bio: 'A mysterious player.', isAlive: true, isSpectator: false, silver: 50, gold: 0, destinyId: '',
    };
  }

  const startTime = new Date(Date.now() + 20_000).toISOString();
  const manifest = {
    kind: 'DYNAMIC', id: gid, gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED', startTime, schedulePreset: 'SMOKE_TEST',
    maxPlayers: PLAYER_COUNT, days: [],
    ruleset: {
      kind: 'PECKING_ORDER',
      voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'MAJORITY', 'FINALS'] },
      games: { mode: 'POOL', pool: ['TRIVIA', 'SEQUENCE'], avoidRepeat: true },
      activities: { mode: 'POOL', pool: ['HOT_TAKE', 'WOULD_YOU_RATHER'], avoidRepeat: true },
      social: { dmChars: { mode: 'FIXED', base: 1200 }, dmPartners: { mode: 'FIXED', base: 3 }, dmCost: 1, groupDmEnabled: true, requireDmInvite: false, dmSlotsPerPlayer: 5 },
      inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
      dayCount: { mode: 'FIXED', value: 3 },
    },
  };

  await post(gid, '/init', { roster, manifest, inviteCode: code });
  await post(gid, '/admin', { type: 'NEXT_STAGE' });

  // Sign tokens
  const tokens = {};
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    tokens[`p${i}`] = await signGameToken({ sub: `u${i}`, gameId: gid, playerId: `p${i}`, personaName: names[i - 1] }, SECRET);
  }

  console.log('');
  console.log('DYNAMIC / PRE_SCHEDULED / SMOKE_TEST');
  console.log(`Game ID: ${gid} | Invite: ${code}`);
  console.log('Day 1 starts in ~20s. 5min/day, 1min gap, 3 days.');
  console.log('');
  console.log('Your link (Silas Vane / p1) — open in incognito:');
  console.log(`${CLIENT}/game/${code}?_t=${tokens.p1}&shell=vivid`);
  console.log('');

  // --- Bot players (p2, p3, p4) ---
  const wsBase = GS.replace('http', 'ws');
  const voteTargets = { p2: 'p3', p3: 'p4', p4: 'p3' }; // p3 gets 2 votes on Day 1

  for (const pid of ['p2', 'p3', 'p4']) {
    const ws = new WebSocket(`${wsBase}/parties/game-server/${gid}?token=${tokens[pid]}`);
    let voted = false;
    let responded = false;
    let lastPhase = null;
    let dayIndex = 0;

    ws.on('open', () => console.log(`[BOT ${pid}] Connected as ${names[parseInt(pid[1]) - 1]}`));
    ws.on('close', (c) => console.log(`[BOT ${pid}] Disconnected: ${c}`));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'SYSTEM.SYNC') return;
        const ctx = msg.context || {};
        const phase = msg.phase;

        // Track day changes
        if (ctx.dayIndex && ctx.dayIndex !== dayIndex) {
          dayIndex = ctx.dayIndex;
          voted = false;
          responded = false;
          console.log(`[BOT ${pid}] === Day ${dayIndex} ===`);
        }

        if (phase !== lastPhase) {
          console.log(`[BOT ${pid}] Phase: ${lastPhase || '?'} -> ${phase}`);
          lastPhase = phase;
        }

        // Vote
        if (ctx.activeVotingCartridge && !voted) {
          const vc = ctx.activeVotingCartridge;
          if (vc.phase === 'VOTING' || vc.phase === 'ACTIVE') {
            const eligible = vc.eligibleVoters || [];
            if (eligible.includes(pid)) {
              const vt = vc.voteType || 'MAJORITY';
              const target = voteTargets[pid] || 'p1';
              console.log(`[BOT ${pid}] Voting for ${target} (${vt})`);
              ws.send(JSON.stringify({ type: `VOTE.${vt}.CAST`, targetId: target }));
              voted = true;
            }
          }
        }

        // Respond to prompts
        if (ctx.activePromptCartridge && !responded) {
          const pc = ctx.activePromptCartridge;
          if (pc.phase === 'ACTIVE') {
            if (pc.promptType === 'HOT_TAKE') {
              const stance = Math.random() > 0.5 ? 'AGREE' : 'DISAGREE';
              console.log(`[BOT ${pid}] Hot Take: ${stance}`);
              ws.send(JSON.stringify({ type: 'ACTIVITY.HOTTAKE.RESPOND', stance }));
              responded = true;
            } else if (pc.promptType === 'WOULD_YOU_RATHER') {
              const choice = Math.random() > 0.5 ? 'A' : 'B';
              console.log(`[BOT ${pid}] Would You Rather: ${choice}`);
              ws.send(JSON.stringify({ type: 'ACTIVITY.WYR.RESPOND', choice }));
              responded = true;
            }
          }
        }
      } catch { /* ignore parse errors */ }
    });
  }

  console.log('Bots running — they vote and respond automatically.');
  console.log('You play as Silas Vane. Open the link now!');
  console.log('');

  // Keep alive for 20 minutes
  await new Promise(r => setTimeout(r, 20 * 60 * 1000));
}

main().catch(e => { console.error(e); process.exit(1); });
