import { useState, useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { Config } from '@pecking-order/shared-types';
import { useInFlight } from '../../hooks/useInFlight';

const MAX = Config.confession.maxConfessionLength;

interface ConfessionInputProps {
  myHandle: string | null;
  onSend: (text: string) => void;
  /** Phase is within 60s of ending. Swaps the red REC chrome for gold LAST CALL. */
  closingSoon?: boolean;
}

/**
 * Imperative handle so the parent (ConfessionBoothSheet) can orchestrate the
 * View Transitions morph that Polish E implements. The parent tags the source
 * textarea with `view-transition-name: flying-tape` before calling
 * `document.startViewTransition(...)`, clears both the name AND the textarea
 * value inside the transition callback (so the "new" snapshot has the name
 * only on the destination cassette), and relies on the parent's pending-insert
 * to complete the morph.
 */
export interface ConfessionInputHandle {
  tagSourceForMorph: () => void;
  clearSourceMorph: () => void;
  clearText: () => void;
}

/**
 * Confession Booth input. Replaces the default composer when a CONFESSION
 * channel is focused. Design contract: mockup 14 (docs/reports/pulse-mockups).
 *
 * Visual language: tape-label identity (pink skewed strip), masked silhouette
 * avatar, framed mic area with warm amber sidelight, red "GO ON AIR" CTA.
 * `myHandle === null` renders a minimal locked-out plate (non-members don't
 * see or post during a live phase).
 */
export const ConfessionInput = forwardRef<ConfessionInputHandle, ConfessionInputProps>(function ConfessionInput(
  { myHandle, onSend, closingSoon = false },
  ref,
) {
  const [text, setText] = useState('');
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { pending: sending, run: guard } = useInFlight();

  const trimmed = text.trim();
  const tooLong = text.length > MAX;
  const empty = trimmed.length === 0;
  const canSend = !tooLong && !empty && myHandle !== null && !sending;

  useImperativeHandle(ref, () => ({
    tagSourceForMorph: () => {
      if (textareaRef.current) textareaRef.current.style.viewTransitionName = 'flying-tape';
    },
    clearSourceMorph: () => {
      if (textareaRef.current) textareaRef.current.style.viewTransitionName = '';
    },
    clearText: () => setText(''),
  }), []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    guard(() => {
      // Parent typically calls clearText() via the imperative handle inside
      // `flushSync` within a View Transitions callback (Polish E). The
      // redundant internal setText('') here covers the non-VT path and is a
      // no-op when the parent already cleared — both settle to empty.
      onSend(trimmed);
      setText('');
      // Ignition beat: inner pink flash on the mic frame. ~420ms total.
      setFlashing(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashing(false), 420);
    });
  }, [canSend, onSend, trimmed, guard]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  if (myHandle === null) {
    return (
      <div style={lockedOutStyle.wrap}>
        <div style={lockedOutStyle.icon} aria-hidden="true" />
        <div style={lockedOutStyle.title}>The booth isn&rsquo;t yours tonight.</div>
        <div style={lockedOutStyle.body}>You weren&rsquo;t here when the tape was cut. Come back when the tapes drop.</div>
        <div style={lockedOutStyle.eyebrow}>· off the record ·</div>
      </div>
    );
  }

  const handleLabel = formatHandleForLabel(myHandle);

  return (
    <div style={boothStyle.wrap}>
      <div style={boothStyle.chrome}>
        <div style={boothStyle.posting} data-testid="my-confessor-handle">
          <div style={boothStyle.mask} aria-hidden="true" />
          <TapeLabel text={handleLabel} size="md" />
        </div>
        <div style={closingSoon ? boothStyle.recLastCall : boothStyle.rec}>
          <span style={closingSoon ? boothStyle.recDotLastCall : boothStyle.recDot} />
          <span>{closingSoon ? 'LAST CALL' : 'REC'}</span>
        </div>
      </div>

      <div
        style={flashing ? { ...boothStyle.micFrame, ...boothStyle.micFrameFlashing } : boothStyle.micFrame}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak into the mic&hellip;"
          style={boothStyle.textarea}
          rows={3}
          maxLength={MAX * 2 /* soft maxLength; over-cap reveals the disabled CTA */}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>

      <div style={boothStyle.foot}>
        <span style={tooLong ? boothStyle.countOver : boothStyle.count}>
          {`${text.length} / ${MAX}`}
        </span>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={canSend ? boothStyle.sendBtn : boothStyle.sendBtnDisabled}
          aria-label="GO ON AIR"
        >
          <span style={boothStyle.sendDot} />
          GO ON AIR
        </button>
      </div>

      <div style={boothStyle.rules}>
        <strong style={{ color: 'var(--pulse-text-2)', fontWeight: 700 }}>
          Once submitted, cannot be edited or taken back.
        </strong>{' '}
        Everyone sees the tape; no one sees the name.
      </div>
    </div>
  );
});

/* ---------- Tape label component (exported for use on cassettes) ---------- */

export function TapeLabel({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const label = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    padding: size === 'sm' ? '5px 10px 5px 8px' : '7px 14px 7px 11px',
    background: 'var(--pulse-accent)',
    color: '#fff',
    borderRadius: 3,
    transform: 'skewX(-8deg)',
    boxShadow: '0 2px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(255,59,111,0.22)',
  } as const;
  const inner = { transform: 'skewX(8deg)' } as const;
  const hole = {
    ...inner,
    width: 6, height: 6,
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '50%',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
  } as const;
  const txt = {
    ...inner,
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: size === 'sm' ? 10 : 12,
    letterSpacing: '0.22em',
    lineHeight: 1,
  } as const;
  return (
    <span style={label}>
      <span style={hole} />
      <span style={txt}>{text}</span>
    </span>
  );
}

/**
 * Format "Confessor #3" → "CONFESSOR · 3" for display on a tape label.
 * Keep the raw form for system wiring; the label is purely presentational.
 */
export function formatHandleForLabel(handle: string): string {
  const match = handle.match(/^confessor\s*#?\s*(\d+)$/i);
  if (!match) return handle.toUpperCase();
  return `CONFESSOR · ${match[1]}`;
}

/**
 * Split a handle like "Confessor #3" into its word ("CONFESSOR") and
 * zero-padded number ("03") for the entry nameplate reveal. Two-digit
 * padding keeps the giant numeral visually balanced regardless of player
 * count (mockup 13 state 01).
 */
export function parseHandleParts(handle: string): { word: string; number: string } {
  const match = handle.match(/^([A-Za-z]+)\s*#?\s*(\d+)$/);
  if (!match) return { word: handle.toUpperCase(), number: '' };
  return { word: match[1].toUpperCase(), number: match[2].padStart(2, '0') };
}

/* ---------- Styles ---------- */

const boothStyle = {
  wrap: {
    flexShrink: 0,
    padding: '14px 16px 18px',
    position: 'relative',
    zIndex: 2,
    background:
      'radial-gradient(ellipse 140% 80% at 50% 110%, rgba(249,169,74,0.08), transparent 60%),' +
      'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)',
    borderTop: '1px solid var(--pulse-border-2)',
    boxShadow: 'inset 0 1px 0 rgba(249,169,74,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  chrome: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posting: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  mask: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background:
      'radial-gradient(circle at 35% 30%, var(--pulse-surface-3), var(--pulse-surface-2) 65%, #0a0810 100%)',
    position: 'relative',
    boxShadow: '0 0 0 1px var(--pulse-border-2), inset 0 2px 3px rgba(249,169,74,0.12)',
    /* two rotated bars across the mask evoke the pink "X" identity cover */
    backgroundImage:
      'linear-gradient(22deg, transparent 46%, var(--pulse-accent) 46%, var(--pulse-accent) 54%, transparent 54%),' +
      'linear-gradient(-22deg, transparent 46%, var(--pulse-accent) 46%, var(--pulse-accent) 54%, transparent 54%),' +
      'radial-gradient(circle at 35% 30%, var(--pulse-surface-3), var(--pulse-surface-2) 65%, #0a0810 100%)',
    backgroundSize: '60% 14%, 60% 14%, 100% 100%',
    backgroundPosition: 'center, center, center',
    backgroundRepeat: 'no-repeat',
  },
  rec: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: '#ff2a3d',
    letterSpacing: '0.08em',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ff2a3d',
    boxShadow: '0 0 10px rgba(255,42,61,0.4)',
    animation: 'pulse-breathe 1.4s ease-in-out infinite',
  },
  recLastCall: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: 'var(--pulse-gold)',
    letterSpacing: '0.08em',
  },
  recDotLastCall: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--pulse-gold)',
    boxShadow: '0 0 10px rgba(255,200,61,0.5)',
    animation: 'pulse-breathe 1.4s ease-in-out infinite',
  },
  micFrame: {
    background:
      'radial-gradient(ellipse 90% 75% at 50% 0%, rgba(249,169,74,0.08), transparent 70%),' +
      '#110d17',
    border: '1px solid var(--pulse-border-2)',
    borderRadius: 10,
    padding: '14px 16px 12px',
    position: 'relative',
    minHeight: 110,
    boxShadow: '0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(249,169,74,0.08)',
    transition: 'box-shadow 420ms ease-out, border-color 420ms ease-out',
  },
  micFrameFlashing: {
    borderColor: 'var(--pulse-accent)',
    boxShadow:
      '0 2px 0 rgba(0,0,0,0.3),' +
      'inset 0 0 0 1px var(--pulse-accent),' +
      'inset 0 0 48px rgba(255,59,111,0.55)',
  },
  textarea: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 500,
    fontSize: 18,
    lineHeight: 1.34,
    color: 'var(--pulse-text-1)',
    letterSpacing: '-0.005em',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    width: '100%',
    minHeight: 80,
    caretColor: 'var(--pulse-accent)',
    fontStyle: 'normal',
  },
  foot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: 'var(--pulse-text-3)',
    letterSpacing: '0.05em',
  },
  countOver: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: '#ff2a3d',
    letterSpacing: '0.05em',
    fontWeight: 700,
  },
  countUsed: {
    color: 'var(--pulse-text-1)',
    fontWeight: 700,
  },
  sendBtn: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: '0.22em',
    padding: '9px 16px',
    borderRadius: 6,
    border: '1px solid #ff2a3d',
    background: 'linear-gradient(180deg, #ff2a3d, #d01f2f)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(255,42,61,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
    textTransform: 'uppercase',
  },
  sendBtnDisabled: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: '0.22em',
    padding: '9px 16px',
    borderRadius: 6,
    border: '1px solid var(--pulse-border-2)',
    background: 'var(--pulse-surface-2)',
    color: 'var(--pulse-text-3)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'not-allowed',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  sendDot: {
    width: 7,
    height: 7,
    background: '#fff',
    borderRadius: '50%',
    boxShadow: '0 0 8px rgba(255,255,255,0.6)',
  },
  rules: {
    fontSize: 11,
    color: 'var(--pulse-text-3)',
    textAlign: 'center',
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
} as const;

const lockedOutStyle = {
  wrap: {
    flexShrink: 0,
    padding: '32px 28px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    textAlign: 'center',
    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)',
    borderTop: '1px solid var(--pulse-border)',
  },
  icon: {
    width: 64, height: 64,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 40%, var(--pulse-surface-3), var(--pulse-surface) 70%, #05040a 100%)',
    border: '1px solid var(--pulse-border)',
    opacity: 0.6,
    position: 'relative',
  },
  title: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '-0.01em',
    color: 'var(--pulse-text-2)',
    marginTop: 4,
  },
  body: {
    fontSize: 13,
    color: 'var(--pulse-text-3)',
    lineHeight: 1.5,
    maxWidth: 260,
  },
  eyebrow: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: '0.26em',
    color: 'var(--pulse-text-4)',
    textTransform: 'uppercase',
    marginTop: 4,
  },
} as const;
