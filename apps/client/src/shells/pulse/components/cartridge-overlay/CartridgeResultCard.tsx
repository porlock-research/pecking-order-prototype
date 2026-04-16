import type { CartridgeKind } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';

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

/**
 * Pulse-native result summary for a completed cartridge. v1 renders a basic
 * kind-themed card pulling the most-obvious summary fields from the
 * CompletedCartridge.snapshot (typed `any` today — see spec §11 plan item
 * "CompletedCartridgeSnapshot schema enumeration").
 *
 * Per spec §3 "Routing constraint": this component MUST be the only path
 * for completed cartridges. Do NOT fall through to PlayableCartridgeMount.
 */
export function CartridgeResultCard({ cartridgeId, kind }: Props) {
  // There's a timing gap between a cartridge reaching its final state and L2
  // recording it in completedPhases — L2 writes the entry at nightSummary
  // (recordCompleted{Voting,Game,Prompt,Dilemma}), not the moment the child
  // finalizes. During that gap the cartridge actor is still alive in its
  // REVEAL/WINNER state (ADR-126 result-hold) and already carries the result
  // data on its context. Fall back to the matching active slot so the card
  // renders immediately when the pill flips to 'completed', without waiting
  // for the nightSummary writeback.
  const entry = useGameStore(s => s.completedCartridges.find(c => c.key === cartridgeId));
  const activeForKind = useGameStore(s =>
    kind === 'voting'  ? s.activeVotingCartridge
    : kind === 'game'  ? s.activeGameCartridge
    : kind === 'prompt'? s.activePromptCartridge
    : s.activeDilemma
  );
  const roster = useGameStore(s => s.roster);
  const dotColor = KIND_COLORS[kind];

  // Build the snapshot source: completed entry wins when present; otherwise
  // project the relevant fields out of the active cartridge context.
  const snap: any = entry?.snapshot ?? activeForKind?.results ?? activeForKind ?? null;

  if (!snap) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>Result unavailable.</p>
      </div>
    );
  }

  // Best-effort field resolution — see spec §11 plan item for typed schema work.
  const eliminated: string | undefined = snap.eliminatedPlayerId || snap.eliminatedId || snap.eliminated?.playerId;
  const winner: string | undefined = snap.winnerPlayerId || snap.winnerId || snap.winner?.playerId;
  const silverRewards: Record<string, number> = snap.silverRewards || {};
  const topScorers = Object.entries(silverRewards)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const title =
    kind === 'voting'  ? 'Vote Resolved'
    : kind === 'game'  ? 'Game Over'
    : kind === 'prompt'? 'Activity Resolved'
    : 'Dilemma Revealed';

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        color: 'var(--pulse-text-1)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: dotColor,
        }}
      >
        Completed
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, textAlign: 'center' }}>{title}</h1>

      {kind === 'voting' && eliminated && roster[eliminated] && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Eliminated
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--pulse-accent)', margin: '6px 0 0' }}>
            {roster[eliminated].personaName}
          </p>
        </div>
      )}

      {(kind === 'game' || kind === 'dilemma') && winner && roster[winner] && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Winner
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: dotColor, margin: '6px 0 0' }}>
            {roster[winner].personaName}
          </p>
        </div>
      )}

      {topScorers.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 16,
            borderRadius: 14,
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--pulse-text-3)',
              marginBottom: 10,
            }}
          >
            Top rewards
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topScorers.map(([pid, amt], i) => (
              <li
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: 'var(--pulse-text-1)',
                }}
              >
                <span>{i + 1}. {roster[pid]?.personaName ?? pid}</span>
                <span style={{ color: 'var(--pulse-gold, #ffd700)', fontWeight: 700 }}>+{amt} silver</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
        Full details in chat.
      </p>
    </div>
  );
}
