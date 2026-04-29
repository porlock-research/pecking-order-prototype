import { useGameStore } from '../../../../store/useGameStore';
import { DayPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';
import { PULSE_Z } from '../../zIndex';
import { ComposeButton } from './ComposeButton';
import { PanelButton } from './PanelButton';
import { SilverPip } from '../common/SilverPip';

interface Props { onCompose: () => void; onOpenPanel: () => void; }

/**
 * Phase → (eyebrow color, border tint, border width). Only drama phases
 * get color; the rest stay calm per .impeccable.md principle 5
 * ("calm by default, loud on purpose").
 */
function phaseChrome(phase: DayPhase | undefined): {
  label: string;
  eyebrowColor: string;
  borderColor: string;
  borderWidth: number;
} {
  switch (phase) {
    case DayPhases.VOTING:
      return { label: 'Voting', eyebrowColor: 'var(--pulse-accent)', borderColor: 'var(--pulse-accent)', borderWidth: 2 };
    case DayPhases.ELIMINATION:
      return { label: 'Elimination', eyebrowColor: 'var(--pulse-accent)', borderColor: 'var(--pulse-accent)', borderWidth: 3 };
    case DayPhases.FINALE:
      return { label: 'Finale', eyebrowColor: 'var(--pulse-gold)', borderColor: 'var(--pulse-gold)', borderWidth: 2 };
    case DayPhases.GAME_OVER:
      return { label: 'Game over', eyebrowColor: 'var(--pulse-text-3)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
    case DayPhases.GAME:
      return { label: 'Game', eyebrowColor: 'var(--pulse-text-2)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
    case DayPhases.ACTIVITY:
      return { label: 'Activity', eyebrowColor: 'var(--pulse-text-2)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
    case DayPhases.SOCIAL:
      return { label: 'Social', eyebrowColor: 'var(--pulse-text-2)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
    case DayPhases.PREGAME:
      return { label: 'Pregame', eyebrowColor: 'var(--pulse-text-3)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
    case DayPhases.MORNING:
    default:
      return { label: 'Morning', eyebrowColor: 'var(--pulse-text-2)', borderColor: 'var(--pulse-border)', borderWidth: 1 };
  }
}

export function PulseHeader({ onCompose, onOpenPanel }: Props) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  const chrome = phaseChrome(phase);
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--pulse-space-sm) var(--pulse-space-md)',
      background: 'var(--pulse-surface)',
      borderBottom: `${chrome.borderWidth}px solid ${chrome.borderColor}`,
      // Only transition the color, not the width. Animating border-width
      // forces every layout below to shift mid-tween — janky on mid-tier
      // Android. Phase changes are infrequent dramatic beats; the 1–2px
      // width snap reads as punctuation, not glitch.
      transition: 'border-bottom-color 240ms ease',
      position: 'relative', zIndex: PULSE_Z.flow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--pulse-text-1)',
            lineHeight: 1,
          }}>
            Day {dayIndex || 1}
          </h1>
          <span style={{
            marginTop: 3,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: chrome.eyebrowColor,
            transition: 'color 240ms ease',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {chrome.label}
          </span>
        </div>
        <SilverPip variant="global" />
      </div>
      <div style={{ display: 'flex', gap: 'var(--pulse-space-sm)' }}>
        <ComposeButton onClick={onCompose} />
        <PanelButton onClick={onOpenPanel} />
      </div>
    </header>
  );
}
