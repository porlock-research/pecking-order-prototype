import type { StateValue } from 'xstate';

export function formatState(value: StateValue | null | undefined): string {
  if (!value) return 'Unknown';
  if (typeof value === 'string') return value;
  
  // Recursively unwrap nested states: { dayLoop: 'activeSession' } -> "dayLoop.activeSession"
  return Object.entries(value)
    .map(([key, val]) => `${key}.${formatState(val)}`)
    .join(' / ');
}
