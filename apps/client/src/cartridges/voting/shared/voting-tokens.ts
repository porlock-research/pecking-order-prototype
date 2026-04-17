import type { VoteType } from '@pecking-order/shared-types';

/**
 * Per-mechanism accent tokens — mirrors PROMPT_ACCENT in cartridges/prompts/PromptShell.tsx.
 * All values are CSS custom properties from the --po-* contract; cartridges stay shell-agnostic.
 *
 * SECOND_TO_LAST uses --po-text-dim because the mechanism is cold/fate — no choice, no heat.
 * EXECUTIONER uses --po-violet to evoke judgment/power transfer.
 * SHIELD uses --po-pink because saving/community-love sits closest to the pink "intimate" pole.
 * TRUST_PAIRS uses --po-green because trust is the anchor; betrayal pulls against it.
 */
export const VOTE_ACCENT: Record<VoteType, string> = {
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

/**
 * Secondary accent for mechanisms that have a duality (TRUST_PAIRS = trust+betray).
 * The primary VOTE_ACCENT acts as the trust pole; this is the betrayal pole.
 */
export const VOTE_ACCENT_SECONDARY: Partial<Record<VoteType, string>> = {
  TRUST_PAIRS: 'var(--po-pink)',
};
