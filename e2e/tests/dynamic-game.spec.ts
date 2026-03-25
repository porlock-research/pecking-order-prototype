import { test, expect } from '@playwright/test';
import { signGameToken } from '@pecking-order/auth';

/**
 * Dynamic Days E2E — Full 3-day tournament with real alarm pipeline.
 *
 * Creates a DYNAMIC game with SMOKE_TEST preset (5min days, 1min gap),
 * joins 4 players via /player-joined, then lets the alarm pipeline drive
 * the entire tournament to completion. No manual intervention — alarms
 * fire timeline events, voting closes with 0 votes (fallback to lowest
 * silver), elimination happens automatically.
 *
 * Expected flow:
 *   Day 1: 4 alive → MAJORITY → p4 eliminated (silver: 40) → 3 alive
 *   Day 2: 3 alive → MAJORITY → p3 eliminated (silver: 60) → 2 alive
 *   Day 3: 2 alive → FINALS → fallback winner → gameSummary
 *
 * Total expected runtime: ~18 minutes (3 × 5min days + 2 × 1min gaps + 90s startup).
 */

const GAME_SERVER = 'http://localhost:8787';
const AUTH_SECRET = 'dev-secret-change-me';

const PLAYERS = [
  { id: 'p1', name: 'Alice', silver: 100 },
  { id: 'p2', name: 'Bob', silver: 80 },
  { id: 'p3', name: 'Carol', silver: 60 },
  { id: 'p4', name: 'Dave', silver: 40 },
];

async function createDynamicGame() {
  const gameId = `e2e-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const startTime = new Date(Date.now() + 90_000).toISOString();

  const manifest = {
    kind: 'DYNAMIC' as const,
    id: `manifest-${gameId}`,
    gameMode: 'CONFIGURABLE_CYCLE' as const,
    scheduling: 'PRE_SCHEDULED' as const,
    startTime,
    ruleset: {
      kind: 'PECKING_ORDER' as const,
      voting: { allowed: ['MAJORITY'] },
      games: { mode: 'NONE' as const, avoidRepeat: false },
      activities: { mode: 'NONE' as const, avoidRepeat: false },
      social: {
        dmChars: { mode: 'FIXED' as const, base: 1200 },
        dmPartners: { mode: 'FIXED' as const, base: 3 },
        dmCost: 1,
        groupDmEnabled: true,
        requireDmInvite: false,
        dmSlotsPerPlayer: 5,
      },
      inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' as const },
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' as const },
    },
    schedulePreset: 'SMOKE_TEST' as const,
    minPlayers: 3,
    days: [],
  };

  const initRes = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_SECRET}` },
    body: JSON.stringify({ roster: {}, manifest, inviteCode }),
  });
  if (!initRes.ok) throw new Error(`Init failed: ${initRes.status} ${await initRes.text()}`);

  for (const p of PLAYERS) {
    const joinRes = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/player-joined`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_SECRET}` },
      body: JSON.stringify({
        playerId: p.id,
        realUserId: `e2e-user-${p.id}`,
        personaName: p.name,
        avatarUrl: '',
        bio: `E2E test player ${p.name}`,
        silver: p.silver,
      }),
    });
    if (!joinRes.ok) throw new Error(`Player join failed for ${p.id}: ${joinRes.status}`);
  }

  return { gameId, inviteCode, startTime };
}

async function getGameState(gameId: string) {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/state`);
  if (!res.ok) throw new Error(`GET /state failed: ${res.status}`);
  return res.json();
}

async function waitForState(
  gameId: string,
  predicate: (state: any) => boolean,
  description: string,
  timeoutMs = 120_000,
  intervalMs = 5_000,
) {
  const start = Date.now();
  let lastState: any;
  while (Date.now() - start < timeoutMs) {
    lastState = await getGameState(gameId);
    if (predicate(lastState)) return lastState;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out (${Math.round(timeoutMs/1000)}s) waiting for: ${description}. Last state: ${JSON.stringify(lastState?.state)}, day: ${lastState?.day}`);
}

function countAlive(roster: Record<string, any>): number {
  return Object.values(roster).filter((p: any) => p.status === 'ALIVE').length;
}

// 20 min timeout — SMOKE_TEST: 3 days × 5min + 2 × 1min gap + 90s startup + buffer
test.describe.configure({ timeout: 1200_000 });

test.describe('Dynamic Days — Full tournament with alarm pipeline @dynamic', () => {
  test('4-player dynamic game runs 3 days to gameSummary via alarms', async () => {
    const game = await createDynamicGame();
    const { gameId } = game;

    console.log(`\n=== Dynamic Game E2E ===`);
    console.log(`Game ID: ${gameId}`);
    console.log(`Start time: ${game.startTime} (${Math.round((new Date(game.startTime).getTime() - Date.now()) / 1000)}s from now)`);
    console.log(`State: ${GAME_SERVER}/parties/game-server/${gameId}/state\n`);

    // ── Verify preGame ──
    const preState = await getGameState(gameId);
    expect(preState.state).toBe('preGame');
    expect(Object.keys(preState.roster || {})).toHaveLength(4);
    expect(preState.manifest.kind).toBe('DYNAMIC');
    expect(preState.manifest.days).toHaveLength(0);
    console.log(`PreGame OK: ${countAlive(preState.roster)} alive, 0 days resolved`);

    // ══════════════════════════════════════════════════════════════
    // DAY 1: 4 alive → MAJORITY → lowest silver (p4) eliminated
    // ══════════════════════════════════════════════════════════════
    console.log(`\nWaiting for startTime alarm (~90s)...`);
    const day1State = await waitForState(
      gameId,
      (s) => s.day === 1 && s.state !== 'preGame',
      'Day 1 to start (startTime alarm)',
      150_000,
    );

    console.log(`\n--- Day 1 ---`);
    console.log(`State: ${JSON.stringify(day1State.state)}`);
    expect(day1State.manifest.days).toHaveLength(1);
    const day1 = day1State.manifest.days[0];
    expect(day1.dayIndex).toBe(1);
    expect(day1.voteType).toBe('MAJORITY');
    expect(day1.timeline.length).toBeGreaterThan(0);
    expect(day1.nextDayStart).toBeDefined();
    console.log(`Day 1 resolved: ${day1.voteType}, ${day1.timeline.length} events, next: ${day1.nextDayStart}`);

    // Wait for Day 1 to complete → nightSummary (END_DAY fires after ~5min)
    console.log(`Waiting for Day 1 END_DAY (~5min)...`);
    const night1State = await waitForState(
      gameId,
      (s) => {
        const str = JSON.stringify(s.state);
        return str.includes('nightSummary') || s.day === 2;
      },
      'Day 1 nightSummary or Day 2 start',
      400_000, // 6.5 min
    );

    // p4 should be eliminated (lowest silver: 40)
    console.log(`After Day 1: state=${JSON.stringify(night1State.state)}, alive=${countAlive(night1State.roster)}`);
    expect(night1State.roster.p4.status).toBe('ELIMINATED');
    expect(countAlive(night1State.roster)).toBe(3);
    console.log(`p4 eliminated (silver: 40). 3 alive.`);

    // ══════════════════════════════════════════════════════════════
    // DAY 2: 3 alive → MAJORITY → lowest silver (p3) eliminated
    // ══════════════════════════════════════════════════════════════
    console.log(`\nWaiting for Day 2 to start (~1min gap)...`);
    const day2State = await waitForState(
      gameId,
      (s) => s.day === 2,
      'Day 2 to start (nextDayStart alarm)',
      180_000,
    );

    console.log(`\n--- Day 2 ---`);
    expect(day2State.manifest.days).toHaveLength(2);
    const day2 = day2State.manifest.days[1];
    expect(day2.dayIndex).toBe(2);
    expect(day2.voteType).toBe('MAJORITY');
    expect(day2.nextDayStart).toBeDefined();
    console.log(`Day 2 resolved: ${day2.voteType}, ${day2.timeline.length} events, next: ${day2.nextDayStart}`);

    // Wait for Day 2 to complete
    console.log(`Waiting for Day 2 END_DAY (~5min)...`);
    const night2State = await waitForState(
      gameId,
      (s) => {
        const str = JSON.stringify(s.state);
        return (str.includes('nightSummary') && s.day === 2) || s.day === 3;
      },
      'Day 2 nightSummary or Day 3 start',
      400_000,
    );

    console.log(`After Day 2: state=${JSON.stringify(night2State.state)}, alive=${countAlive(night2State.roster)}`);
    expect(night2State.roster.p3.status).toBe('ELIMINATED');
    expect(countAlive(night2State.roster)).toBe(2);
    console.log(`p3 eliminated (silver: 60). 2 alive.`);

    // ══════════════════════════════════════════════════════════════
    // DAY 3: 2 alive → FINALS → winner declared → gameSummary
    // ══════════════════════════════════════════════════════════════
    console.log(`\nWaiting for Day 3 to start (~1min gap)...`);
    const day3State = await waitForState(
      gameId,
      (s) => s.day === 3,
      'Day 3 to start (nextDayStart alarm)',
      180_000,
    );

    console.log(`\n--- Day 3 (FINALS) ---`);
    expect(day3State.manifest.days).toHaveLength(3);
    const day3 = day3State.manifest.days[2];
    expect(day3.dayIndex).toBe(3);
    expect(day3.voteType).toBe('FINALS');
    expect(day3.nextDayStart).toBeUndefined(); // last day
    console.log(`Day 3 resolved: ${day3.voteType}, ${day3.timeline.length} events, last day`);

    // Wait for game to reach gameSummary
    console.log(`Waiting for FINALS to complete and game to end (~5min)...`);
    const finalState = await waitForState(
      gameId,
      (s) => s.state === 'gameSummary' || s.state === 'gameOver',
      'gameSummary (tournament complete)',
      400_000,
    );

    console.log(`\n=== Tournament Complete ===`);
    console.log(`Final state: ${JSON.stringify(finalState.state)}`);
    console.log(`Manifest days: ${finalState.manifest.days.length}`);
    console.log(`Roster:`);
    for (const [id, p] of Object.entries(finalState.roster) as any) {
      console.log(`  ${id}: ${p.personaName} — ${p.status} (silver: ${p.silver})`);
    }

    // ── Final assertions ──
    expect(finalState.manifest.days).toHaveLength(3);
    expect(countAlive(finalState.roster)).toBeLessThanOrEqual(2);

    // Verify each day was resolved correctly
    expect(finalState.manifest.days[0].voteType).toBe('MAJORITY');
    expect(finalState.manifest.days[1].voteType).toBe('MAJORITY');
    expect(finalState.manifest.days[2].voteType).toBe('FINALS');

    console.log(`\nAll 3 days resolved. Dynamic days tournament completed successfully.`);
  });
});
