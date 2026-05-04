import { useGameStore } from '../../../store/useGameStore';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { useNowTick } from '../hooks/useNowTick';
import { usePillStates, useDayPhase } from '../hooks/usePillStates';
import { computeNowLine } from './NowLine';
import { BellSlash } from '../icons';

/**
 * Layer 3 of the push-engagement defense (see project_desktop_brave_push_loop).
 * Layers 1 (lobby BrowserSupportGate) and 2 (PwaGate AbortError fallback) are
 * already shipped. Layer 3 = persistent visibility for users who DEFERRED or
 * DENIED push: a calm banner that says they're in a degraded state, surfaces
 * the next event so the silence isn't disorienting, and offers a Turn-on
 * route back into the canonical PwaGate flow.
 *
 * Triggered by the playtester (Ainge) feedback on game SBCSJT — points 4 + 5
 * of the 2026-05-04 feedback batch:
 *   "When notification is off, it's almost fully silent and I had no idea
 *    when what was happening next…"
 *   "When I don't add to home screen, that tab never went away so I couldn't
 *    even press any button…"
 *
 * Reuses computeNowLine() from NowLine.tsx for the next-event text so the
 * banner stays in sync with the existing NowLine readout — same "Next ·
 * VOTE in 12m" grammar, just amplified for push-off mode.
 *
 * Visibility rules (anything other than these and the banner stays out of
 * the way):
 *   - token present (authenticated, in a game)
 *   - usePushNotifications has finished its initial check (`ready`)
 *   - push is not subscribed (`!isSubscribed`)
 *   - push isn't unsupported on this browser (no PushManager → nothing to
 *     turn on; lobby BrowserSupportGate caught these earlier anyway)
 *
 * When PwaGate is up at a higher z-tier (drawer/modal), it visually covers
 * this banner. That's intentional — the gate's own UI is the canonical
 * push-prompt; the banner only matters once the gate has dismissed.
 */
const DEFER_KEY = 'po_gate_deferred';

interface Props {
  token: string | null;
}

export function PushOffBanner({ token }: Props) {
  // Hooks must run unconditionally; gating happens after the reads.
  const { ready, isSubscribed, permission } = usePushNotifications(token ?? undefined);
  const pills = usePillStates();
  const phase = useDayPhase();
  const dayIndex = useGameStore((s) => s.dayIndex);
  const now = useNowTick(1000, true);

  if (!token) return null;
  if (!ready) return null;
  if (isSubscribed) return null;
  if (permission === 'unsupported') return null;

  const computed = computeNowLine(pills, now, phase, dayIndex);
  const nextText =
    computed?.nextText && computed.nextText !== '—' ? computed.nextText : null;

  const handleTurnOn = () => {
    // Clear PwaGate's deferred-fresh check + signal PulseShell to remount
    // PwaGate so it re-reads the cleared key and re-renders the gate.
    try {
      localStorage.removeItem(DEFER_KEY);
    } catch {
      /* private mode / quota — fall through; remount still triggers re-eval */
    }
    window.dispatchEvent(new CustomEvent('pulse:request-push-gate'));
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pulse-push-off-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        background:
          'color-mix(in oklch, var(--pulse-gold) 8%, var(--pulse-surface))',
        borderBottom: '1px solid var(--pulse-border)',
        fontSize: 12,
        lineHeight: 1.3,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flex: 1,
        }}
      >
        <BellSlash
          size={18}
          weight="fill"
          color="var(--pulse-gold)"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <span style={{ color: 'var(--pulse-text-1)', fontWeight: 600 }}>
            Notifications off — you'll miss the next event
          </span>
          {nextText && (
            <span
              style={{
                color: 'var(--pulse-text-3)',
                fontSize: 10,
                fontFamily: 'var(--po-font-display, var(--po-font-body))',
                textTransform: 'uppercase',
                letterSpacing: 0.22 * 10,
                fontWeight: 800,
                marginTop: 2,
              }}
            >
              Next · {nextText}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleTurnOn}
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          borderRadius: 'var(--pulse-radius-md, 8px)',
          background: 'var(--pulse-accent)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          border: 'none',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Turn on
      </button>
    </div>
  );
}
