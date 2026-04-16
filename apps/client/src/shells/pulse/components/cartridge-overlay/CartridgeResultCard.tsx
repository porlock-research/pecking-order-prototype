import type { CartridgeKind } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { PulseResultContent } from './PulseResultContent';

interface Props {
  cartridgeId: string;
  kind: CartridgeKind;
}

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

const KIND_TITLES: Record<CartridgeKind, string> = {
  voting: 'Vote Resolved',
  game: 'Game Over',
  prompt: 'Activity Resolved',
  dilemma: 'Dilemma Revealed',
};

/**
 * Pulse-native result summary for a completed cartridge. Renders a kind-themed
 * header (Completed chip, title) then hands off to PulseResultContent for the
 * per-kind rich body — tallies, voter attribution, leaderboards, stance bars,
 * dilemma outcome banners.
 *
 * Per spec §3 "Routing constraint": this component MUST be the only path
 * for completed cartridges. Do NOT fall through to PlayableCartridgeMount.
 *
 * Source priority: completedCartridges entry (written at nightSummary) wins
 * when present. During the window between the cartridge finalizing and L2
 * writing the entry, the active cartridge slot is still alive in REVEAL/WINNER
 * phase (per ADR-126 result-hold) with results populated — fall back to that
 * so the card renders immediately.
 */
export function CartridgeResultCard({ cartridgeId, kind }: Props) {
  const entry = useGameStore(s => s.completedCartridges.find(c => c.key === cartridgeId));
  const activeForKind = useGameStore(s =>
    kind === 'voting'  ? s.activeVotingCartridge
    : kind === 'game'  ? s.activeGameCartridge
    : kind === 'prompt'? s.activePromptCartridge
    : s.activeDilemma
  );
  const dotColor = KIND_COLORS[kind];
  const title = KIND_TITLES[kind];

  // Fallback chain: completed entry wins. When missing (REVEAL-gap window
  // before L2 writes completedPhases), merge the active cartridge context
  // with its `results` — dilemmas and prompts expose their type field on
  // context, not inside results, so a naive `?? results ?? active` would
  // drop `dilemmaType`/`promptType` when results is truthy.
  //
  // Only use the active-slot fallback when its decorated cartridgeId matches
  // the requested one. Without this check, a stale push intent targeting
  // Day N-1's cartridge could surface Day N's active-slot data under the
  // wrong cartridgeId header.
  const useActiveFallback =
    !entry
    && activeForKind
    && (activeForKind as any).cartridgeId === cartridgeId;

  const snap: any = entry?.snapshot
    ?? (useActiveFallback ? { ...activeForKind, ...(activeForKind!.results ?? {}) } : null);

  if (!snap) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>Result unavailable.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 20px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        color: 'var(--pulse-text-1)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: dotColor,
        }}
      >
        Completed
      </span>

      <h1
        style={{
          fontSize: 24, fontWeight: 900, margin: 0,
          textAlign: 'center', fontFamily: 'var(--po-font-display)',
        }}
      >
        {title}
      </h1>

      <div style={{ width: '100%', maxWidth: 440 }}>
        <PulseResultContent kind={kind} snapshot={snap} />
      </div>
    </div>
  );
}
