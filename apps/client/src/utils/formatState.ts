import type { StateValue } from 'xstate';

export function formatState(value: StateValue | null | undefined): string {
  if (!value) return 'Unknown';
  if (typeof value === 'string') return value;

  // Recursively unwrap nested states: { dayLoop: 'activeSession' } -> "dayLoop.activeSession"
  return Object.entries(value)
    .map(([key, val]) => `${key}.${formatState(val)}`)
    .join(' / ');
}

/** Human-friendly phase label for the header badge */
export function formatPhase(value: StateValue | null | undefined): string {
  if (!value) return 'OFFLINE';

  const flat = formatState(value).toLowerCase();

  if (flat.includes('pregame') || flat.includes('idle')) return 'CASTING LOBBY';
  if (flat.includes('voting')) return 'VOTING';
  if (flat.includes('dailygame') || flat.includes('daily_game')) return 'GAME TIME';
  if (flat.includes('nightsummary') || flat.includes('night')) return 'NIGHT COUNCIL';
  if (flat.includes('morningbriefing') || flat.includes('morning')) return 'BRIEFING';
  if (flat.includes('groupchat') || flat.includes('activesession')) return 'LIVE SESSION';
  if (flat.includes('gameover') || flat.includes('game_over')) return 'FINALE';

  return 'IN PROGRESS';
}
