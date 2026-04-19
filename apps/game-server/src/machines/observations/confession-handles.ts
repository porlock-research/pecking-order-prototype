/**
 * Seeded RNG + handle assignment for confession phases.
 *
 * Spec C, Plan 1, T6. Used by L3 confessionLayer entry actions to deterministically
 * assign each alive player a stable "Confessor #N" handle for the duration of one
 * phase. Same (gameId, dayIndex, players) → same assignment. The handle map is
 * SERVER-ONLY (per-recipient projected to { myHandle, handleCount } in
 * buildSyncPayload — see Plan 1 T12).
 *
 * Co-located in observations/ for proximity to the inactivity module pattern;
 * future GM Intelligence work may share this seed/RNG pattern (Spec A).
 */

export interface SeededRng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  nextInt(n: number): number;
}

/**
 * Deterministic seeded RNG — xmur3 hash → mulberry32.
 * Same seed → same sequence. Pure JS, no crypto dependency, fast.
 */
export function createSeededRng(seed: string): SeededRng {
  // xmur3: string → 32-bit seed
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;

  // mulberry32: 32-bit seed → float in [0, 1)
  const next = (): number => {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (n) => Math.floor(next() * n),
  };
}

/**
 * Assign stable "Confessor #N" handles to each player, deterministic on seed.
 * Returns Record<playerId, handle>. Sequential numbers 1..N after Fisher-Yates
 * shuffle — the shuffle decides which playerId gets which number.
 *
 * Empty roster → empty map (caller's responsibility to enforce minimum-players gate).
 */
export function assignPhaseHandles(playerIds: string[], seed: string): Record<string, string> {
  if (playerIds.length === 0) return {};
  const rng = createSeededRng(seed);

  // Fisher-Yates shuffle of playerIds (in-place on local copy)
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const out: Record<string, string> = {};
  shuffled.forEach((pid, idx) => {
    out[pid] = `Confessor #${idx + 1}`;
  });
  return out;
}
