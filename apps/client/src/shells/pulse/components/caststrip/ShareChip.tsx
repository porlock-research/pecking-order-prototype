import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Plus } from '../../icons';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';

const LOBBY_HOST = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

/** Async clipboard via `navigator.clipboard.writeText`. Browser-restricted to
 *  secure contexts (HTTPS or localhost) — silently unavailable on plain-HTTP
 *  origins like Tailscale dev. */
async function tryAsyncClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Legacy clipboard via off-screen `<textarea>` + `document.execCommand`.
 *  Deprecated in spec but still works on plain HTTP, which the modern
 *  Clipboard API does not. */
function tryLegacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

interface Props {
  /** Invite code for the current game (e.g. "X7K2MP"). Read from URL by parent. */
  gameCode: string;
}

/**
 * Cast-strip "open seat" chip — invites more friends during pregame. Renders
 * only while phase === pregame (parent-gated). Footprint matches CastChip
 * (72×100, --pulse-radius-md) so the chip reads as a real cast slot waiting
 * to be filled, not a form control parachuted into a strip of portraits.
 *
 * Visual grammar (bolder pass):
 *   • Bespoke SVG dashed ring (custom dash rhythm, warm cream tint) — reads
 *     as an open seat "ribbon," not generic CSS dashed border.
 *   • Confident silhouette (56×56, 2.4px strokes, cream warmth) sits where
 *     a face would.
 *   • Hero gold "+" badge — promoted from corner accessory to anchor mark.
 *     Slow ambient breath (1800ms) signals "open invitation," calmer than
 *     the 1000ms pending-invite urgency tempo.
 *   • "INVITE" label tracked-caps in --pulse-gold (the project's signal
 *     color, reserved for premium moments) — claims the open seat as
 *     opportunity, not chore.
 *
 * Tap → navigator.share with the canonical /j/CODE URL. Falls back to
 * clipboard.writeText, then a legacy textarea copy, then a toast carrying
 * the URL. Success → ignition beat: ring snaps solid gold, surface flushes
 * gold, halo blooms, then settles back to calm.
 */
function ShareChipInner({ gameCode }: Props) {
  const shareUrl = `${LOBBY_HOST}/j/${gameCode.toUpperCase()}`;
  const [success, setSuccess] = useState(false);

  const handleTap = useCallback(async () => {
    const shareData = {
      title: 'Pecking Order',
      text: `I'm in a game on Pecking Order — you're cast. Code ${gameCode.toUpperCase()}`,
      url: shareUrl,
    };

    let landed = false;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        landed = true;
      } catch (err) {
        // AbortError = user dismissed the share sheet. Treat as deliberate
        // cancel (no fallback, no celebration).
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }

    if (!landed) {
      if ((await tryAsyncClipboard(shareUrl)) || tryLegacyCopy(shareUrl)) {
        toast.success('Link copied — go cast someone');
        landed = true;
      } else {
        toast.error(`Couldn't copy. Send this: ${shareUrl}`, { duration: 12_000 });
        return;
      }
    }

    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 700);
  }, [gameCode]);

  // Stroke colors swap on success but stay as static rgba (not color-mix) so
  // the SVG stroke transition can interpolate them.
  const ringStroke = success ? 'rgba(255, 200, 61, 0.95)' : 'rgba(220, 200, 175, 0.55)';
  const ringDash = success ? undefined : '7 5';

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      whileTap={PULSE_TAP.card}
      whileHover={{ scale: 1.02 }}
      // Bolder entry: starts smaller (0.86) so the arrival lands with more
      // presence. Delayed past the cast settle so it announces itself.
      initial={{ scale: 0.86, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, ...PULSE_SPRING.pop }}
      aria-label="Invite more friends to the game"
      data-chip-share="true"
      style={{
        flex: '0 0 auto',
        position: 'relative',
        width: 72,
        height: 100,
        padding: 0,
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--pulse-radius-md)',
        cursor: 'pointer',
        outline: 'none',
        scrollSnapAlign: 'start',
      }}
      onFocus={e => {
        if (e.currentTarget.matches(':focus-visible')) {
          e.currentTarget.style.outline = '2px solid var(--pulse-accent)';
          e.currentTarget.style.outlineOffset = '2px';
        }
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {/* Surface — warmer/more saturated than v1 so the slot has presence
          rather than receding. Success state flushes a soft gold wash. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--pulse-radius-md)',
          overflow: 'hidden',
          background: success
            ? 'rgba(255, 200, 61, 0.10)'
            : 'rgba(50, 35, 60, 0.55)',
          boxShadow: success ? '0 0 22px rgba(255, 200, 61, 0.45)' : 'none',
          transition: 'background 320ms ease, box-shadow 320ms ease',
        }}
      >
        {/* Bespoke dashed ring — SVG so we control the dash rhythm (7 5),
            stroke weight (2.5px), and color independently of CSS border
            limitations. Snaps solid on success. */}
        <svg
          width="72"
          height="100"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <rect
            x="1.25"
            y="1.25"
            width="69.5"
            height="97.5"
            rx="12"
            ry="12"
            fill="none"
            stroke={ringStroke}
            strokeWidth="2.5"
            strokeDasharray={ringDash}
            style={{ transition: 'stroke 320ms ease' }}
          />
        </svg>

        {/* Silhouette + hero gold "+". The badge anchors the composition;
            the silhouette is the supporting cast (literally — it's the
            face that hasn't arrived yet). */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            paddingBottom: 24,
          }}
        >
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              {/* Head — larger and warmer than v1; reads as "real face waiting" */}
              <circle
                cx="28"
                cy="20"
                r="9.5"
                fill="none"
                stroke="rgba(255, 215, 195, 0.78)"
                strokeWidth="2.4"
              />
              {/* Open shoulders arc — heavier stroke, warmer tint */}
              <path
                d="M11 49 C11 38, 18.5 33, 28 33 C37.5 33, 45 38, 45 49"
                fill="none"
                stroke="rgba(255, 215, 195, 0.78)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
            {/* Hero gold "+". 26px dish (was 20), 15px glyph (was 11),
                inset gold ring + outer halo. Slow ambient breath at 1800ms
                — calmer tempo than pending-invite (1000ms), reads as
                "open invitation" not "act now." Stops on success so the
                ignition beat owns the moment. */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(8, 6, 12, 0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  'inset 0 0 0 1.5px rgba(255, 200, 61, 0.85), 0 0 14px rgba(255, 200, 61, 0.5)',
                animation: success
                  ? undefined
                  : 'pulse-breathe 1800ms ease-in-out infinite',
              }}
            >
              <Plus size={15} weight="bold" color="#ffc83d" />
            </span>
          </div>
        </div>

        {/* "INVITE" — tracked-caps in --pulse-gold. The project's reveal-label
            grammar (uppercase, heavy weight, wide tracking) scaled down for
            chip context. Gold over the darker bottom gradient pops as a
            premium opportunity, not utility chrome. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '14px 6px 5px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.92), transparent)',
            color: 'var(--pulse-gold)',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.18em',
            textAlign: 'center',
            textTransform: 'uppercase',
            textShadow: '0 1px 2px rgba(0,0,0,0.85)',
          }}
        >
          Invite
        </div>
      </div>
    </motion.button>
  );
}

export const ShareChip = memo(ShareChipInner);
