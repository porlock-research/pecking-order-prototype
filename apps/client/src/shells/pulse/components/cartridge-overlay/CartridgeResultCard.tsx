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
        // Kind-tinted ambient backdrop anchors the finale. Radial fade at top
        // so the chip + title sit in a pool of kind-color, body stays calm.
        background: `radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in oklch, ${dotColor} 12%, transparent) 0%, transparent 70%)`,
        paddingTop: 'var(--pulse-space-xl)',
        paddingLeft: 'var(--pulse-space-lg)',
        paddingRight: 'var(--pulse-space-lg)',
        paddingBottom: 'var(--pulse-space-3xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'var(--pulse-text-1)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--pulse-space-sm)',
          padding: 'var(--pulse-space-2xs) var(--pulse-space-md)',
          marginBottom: 'var(--pulse-space-sm)',
          borderRadius: 'var(--pulse-radius-pill)',
          background: `color-mix(in oklch, ${dotColor} 10%, transparent)`,
          border: `1px solid color-mix(in oklch, ${dotColor} 25%, transparent)`,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: dotColor,
          fontFamily: 'var(--po-font-body)',
        }}
      >
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
        Completed
      </span>

      <h1
        style={{
          fontSize: 'clamp(28px, 6vw, 36px)',
          fontWeight: 700,
          letterSpacing: -0.8,
          lineHeight: 1.05,
          margin: 0,
          marginBottom: 'var(--pulse-space-xl)',
          textAlign: 'center',
          fontFamily: 'var(--po-font-display)',
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
