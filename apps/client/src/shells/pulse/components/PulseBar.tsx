import { useRef } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { usePillStates, type PillState } from '../hooks/usePillStates';
import { usePillOrigin } from './cartridge-overlay/usePillOrigin';
import { Pill } from './Pill';

/**
 * PulseBar shows cartridge pills in chronological order.
 * When no cartridges are active, the bar renders nothing —
 * CastStrip owns presence now (Phase 1.5).
 */
export function PulseBar() {
  const pills = usePillStates();
  const focusCartridge = useGameStore(s => s.focusCartridge);
  const dayIndex = useGameStore(s => s.dayIndex);
  const { set: setPillOrigin } = usePillOrigin();
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (pills.length === 0) return null;

  const handleTap = (pill: PillState) => {
    const el = pillRefs.current[pill.id];
    if (el) setPillOrigin(el.getBoundingClientRect());
    const cartridgeId = pillToCartridgeId(pill, dayIndex);
    focusCartridge(cartridgeId, pill.kind, 'manual');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        height: 48,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map(pill => (
        <Pill
          key={pill.id}
          pill={pill}
          onTap={() => handleTap(pill)}
          buttonRef={(el) => { pillRefs.current[pill.id] = el; }}
        />
      ))}
    </div>
  );
}

/**
 * Build the stable cartridgeId matching the server scheme from Phase 4 §0.1:
 *   `${kind}-${dayIndex}-${typeKey}`
 *
 * typeKey resolution order per kind:
 *   voting   → cartridge.mechanism | cartridge.voteType
 *   game     → cartridge.gameType
 *   prompt   → cartridge.promptType
 *   dilemma  → cartridge.dilemmaType
 *
 * For upcoming/starting pills (no live cartridge data), typeKey falls back
 * to 'UNKNOWN'. The overlay handles that case — it can still render the info
 * splash using the pill's label.
 */
function pillToCartridgeId(pill: PillState, dayIndex: number): string {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  const typeKey =
    (c?.mechanism as string) ||
    (c?.voteType as string) ||
    (c?.gameType as string) ||
    (c?.promptType as string) ||
    (c?.dilemmaType as string) ||
    'UNKNOWN';
  return `${pill.kind}-${dayIndex}-${typeKey}`;
}
