import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus } from '../../icons';
import { PULSE_TAP } from '../../springs';

const LOBBY_HOST = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

interface Props {
  /** Invite code for the current game (e.g. "X7K2MP"). Read from URL by parent. */
  gameCode: string;
}

/**
 * Cast-strip chip that lets a player invite more friends to the game during
 * pregame. Renders only while phase === pregame (parent-gated). Shape and
 * footprint match CastChip so the strip's rhythm stays intact; the dashed
 * border + muted background signal "empty seat / add someone" rather than
 * a real player.
 *
 * Tap → navigator.share with the canonical /j/CODE URL. Falls back to
 * clipboard.writeText + a toast confirmation when Web Share is unavailable
 * (desktop browsers, older mobiles). The /j/CODE URL is the post-Phase-4
 * frictionless welcome route — strangers who tap it land on the welcome
 * form, returning players land on the right destination via the
 * session-aware redirect.
 *
 * Tap feedback comes from `whileTap` (immediate scale-down) plus the
 * native share sheet / toast — no keyframe-array animation needed
 * (and would be unsafe here per the framer-motion keyframe-restart rule:
 * cast strip re-renders constantly with store ticks).
 */
function ShareChipInner({ gameCode }: Props) {
  const shareUrl = `${LOBBY_HOST}/j/${gameCode.toUpperCase()}`;

  const handleTap = useCallback(async () => {
    const shareData = {
      title: 'Pecking Order',
      text: `Join my game on Pecking Order — code ${gameCode.toUpperCase()}`,
      url: shareUrl,
    };

    // Web Share API — preferred on mobile (opens native share sheet).
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // AbortError when user dismisses the share sheet — silent.
        if ((err as DOMException)?.name === 'AbortError') return;
        // Fall through to clipboard fallback on other failures.
      }
    }

    // Clipboard fallback — desktop browsers, older mobiles, share sheet
    // unavailable in standalone PWA on some platforms.
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link — long-press the URL in the address bar');
    }
  }, [shareUrl, gameCode]);

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      whileTap={PULSE_TAP}
      aria-label="Share game with more friends"
      data-chip-share="true"
      style={{
        flex: '0 0 auto',
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: '50%',
        // Dashed ring + transparent fill signals "open seat" without
        // competing with real cast portraits visually.
        border: '1.5px dashed color-mix(in oklch, var(--pulse-text-3) 55%, transparent)',
        background: 'color-mix(in oklch, var(--pulse-surface) 60%, transparent)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        scrollSnapAlign: 'start',
      }}
      // Accessibility: focus ring matches Pulse focus convention.
      onFocus={e => { e.currentTarget.style.outline = '2px solid var(--pulse-accent)'; e.currentTarget.style.outlineOffset = '2px'; }}
      onBlur={e => { e.currentTarget.style.outline = 'none'; }}
    >
      <UserPlus
        size={26}
        weight="fill"
        color="color-mix(in oklch, var(--pulse-text-2) 80%, transparent)"
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in oklch, var(--pulse-text-3) 70%, transparent)',
          whiteSpace: 'nowrap',
        }}
      >
        Invite
      </span>
    </motion.button>
  );
}

export const ShareChip = memo(ShareChipInner);
