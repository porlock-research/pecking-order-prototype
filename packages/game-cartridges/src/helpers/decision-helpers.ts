import type { SocialPlayer } from '@pecking-order/shared-types';

/** Count occurrences of each value in a decisions map */
export function tallyDecisions(decisions: Record<string, string>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const value of Object.values(decisions)) {
    tally[value] = (tally[value] || 0) + 1;
  }
  return tally;
}

/** Break a tie using lowest silver from roster (poorest player "wins" the tiebreak) */
export function breakTieByLowestSilver(
  tied: string[],
  roster: Record<string, SocialPlayer>,
): string {
  let lowest = Infinity;
  let winner = tied[0];
  for (const pid of tied) {
    const silver = roster[pid]?.silver ?? Infinity;
    if (silver < lowest) {
      lowest = silver;
      winner = pid;
    }
  }
  return winner;
}

/** Break a tie by random selection */
export function breakTieByRandom(tied: string[]): string {
  return tied[Math.floor(Math.random() * tied.length)];
}

/** Get the median of a set of numbers */
export function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
