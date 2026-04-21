import type { VoteType } from '@pecking-order/shared-types';
import {
  Scales,
  HandFist,
  Drop,
  Trophy,
  HourglassLow,
  ShieldSlash,
  HeartBreak,
  Sword,
  Crown,
} from '../../icons';

export type PhosphorIconComponent = typeof Scales;

// Per-mechanism icon used in the chat event card kicker.
// Mirrors VOTE_TYPE_INFO.revealLabel semantically.
export const MECHANISM_ICON: Record<VoteType, PhosphorIconComponent> = {
  MAJORITY: Scales,
  EXECUTIONER: HandFist,
  BUBBLE: Drop,
  PODIUM_SACRIFICE: Trophy,
  SECOND_TO_LAST: HourglassLow,
  SHIELD: ShieldSlash,
  TRUST_PAIRS: HeartBreak,
  DUELS: Sword,
  FINALS: Crown,
};

// Per-mechanism accent token. Mirrors VOTE_ACCENT in cartridges/voting/shared/voting-tokens.ts;
// duplicated here to keep the shell decoupled from the cartridges area.
export const MECHANISM_ACCENT: Record<VoteType, string> = {
  MAJORITY: 'var(--po-orange)',
  SHIELD: 'var(--po-pink)',
  BUBBLE: 'var(--po-blue)',
  EXECUTIONER: 'var(--po-violet)',
  SECOND_TO_LAST: 'var(--po-text-dim)',
  PODIUM_SACRIFICE: 'var(--po-gold)',
  TRUST_PAIRS: 'var(--po-green)',
  DUELS: 'var(--po-orange)',
  FINALS: 'var(--po-gold)',
};

// Per-mechanism dramatic narrator line pool for the full-bleed elimination overlay.
// Lines end in a period (never exclamation) and are ≤ ~45 chars. {name} is replaced
// with the eliminated player's persona name.
export const MECHANISM_NARRATOR_LINES: Record<VoteType, readonly string[]> = {
  MAJORITY: [
    'Pack your bags, {name}.',
    'The house votes {name} off.',
    '{name} is out.',
    'The group turns on {name}.',
    '{name} takes the walk.',
  ],
  EXECUTIONER: [
    'The executioner picks {name}.',
    'One hand. One cut. {name}.',
    '{name} is cut.',
    'The blade finds {name}.',
  ],
  BUBBLE: [
    '{name} sinks.',
    'Not enough saves for {name}.',
    '{name} slips under.',
    'The bubble bursts for {name}.',
  ],
  PODIUM_SACRIFICE: [
    '{name} falls from the podium.',
    'The top bleeds. {name} first.',
    'No one saved {name}.',
    '{name} is sacrificed.',
  ],
  SECOND_TO_LAST: [
    'Fate takes {name}.',
    '{name} runs out of silver.',
    '{name} is out. No vote, no choice.',
    'The hourglass runs dry for {name}.',
  ],
  SHIELD: [
    '{name} stood unshielded.',
    'No shield for {name}.',
    '{name} is exposed.',
    'The group finds {name}.',
  ],
  TRUST_PAIRS: [
    '{name} trusted the wrong partner.',
    'Betrayed. {name} is out.',
    '{name} put faith in the wrong hand.',
    'The partner burns {name}.',
  ],
  DUELS: [
    '{name} loses the duel.',
    '{name} falls in the pair.',
    'Two entered. {name} did not leave.',
  ],
  FINALS: [],
};

// Winner (FINALS) narrator line pool for the full-bleed winner overlay.
export const WINNER_NARRATOR_LINES: readonly string[] = [
  '{name} takes the crown.',
  '{name} wins the game.',
  '{name} is your winner.',
  'The crown belongs to {name}.',
  '{name} outlasted everyone.',
  '{name} — champion.',
];

/**
 * Deterministic line selection. Same inputs always yield the same line, so catch-up
 * replay on reconnect shows the same line the original reveal did.
 *
 * seed composes gameId + dayIndex + playerId so any two of (same game, same day,
 * same player) don't collide.
 */
export function pickLine(pool: readonly string[], seed: string): string {
  if (pool.length === 0) return '';
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % pool.length;
  return pool[idx];
}

export function renderLine(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}
