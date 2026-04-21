import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { CastStripEntry } from '../../../../store/useGameStore';
import { useGameStore, selectChipSlotStatus } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { HandWaving } from '../../icons';
import { PULSE_TAP } from '../../springs';

interface Props {
  entry: CastStripEntry;
  onTap: (entry: CastStripEntry) => void;
  pickingMode: boolean;
  picked: boolean;
  pickable: boolean;
  locked?: boolean;
}

function CastChipInner({ entry, onTap, pickingMode, picked, pickable, locked = false }: Props) {
  const { player, isOnline, isTypingToYou, hasPendingInviteFromThem, unreadCount, isLeader, lastNudgeFromThemTs, hasUnseenNudgeFromThem, hasUnseenSilver } = entry;
  const roster = useGameStore(s => s.roster);
  const slotStatus = useGameStore(s => selectChipSlotStatus(s, entry.id));
  const markNudgeSeen = useGameStore(s => s.markNudgeSeen);
  const markSilverSeen = useGameStore(s => s.markSilverSeen);
  const [shaking, setShaking] = useState(false);

  // Shake once when a newer nudge timestamp arrives for this chip. The ts comes
  // from selectCastStripEntries reading tickerMessages — so it works live AND
  // for offline→online replay (ticker history is sent on connect).
  const seenNudgeTs = useRef(lastNudgeFromThemTs);
  useEffect(() => {
    if (lastNudgeFromThemTs > seenNudgeTs.current) {
      seenNudgeTs.current = lastNudgeFromThemTs;
      setShaking(true);
      const id = window.setTimeout(() => setShaking(false), 500);
      return () => window.clearTimeout(id);
    }
  }, [lastNudgeFromThemTs]);

  const colorIdx = useMemo(() => Object.keys(roster).indexOf(entry.id), [roster, entry.id]);
  const color = getPlayerColor(colorIdx);
  const avatar = resolveAvatarUrl(player?.avatarUrl);

  const isSelf = entry.kind === 'self';
  // Offline chips stay mostly visible — faces are the visual interest
  // (.impeccable.md principle 1). Previously 0.45 + saturate(0.6) read
  // as "ghosted"; 0.82 with no filter reads as "quieter."
  const dimmed = !isOnline && !isSelf && !hasPendingInviteFromThem && !hasUnseenNudgeFromThem;
  const disabledInPicking = pickingMode && !pickable && !isSelf;

  const handleTap = () => {
    if (locked) return;
    if (!isSelf && !pickingMode && slotStatus === 'blocked') {
      setShaking(true);
      toast.error('Out of DM slots for today');
      window.setTimeout(() => setShaking(false), 350);
      return;
    }
    if (hasUnseenNudgeFromThem) markNudgeSeen(entry.id);
    if (hasUnseenSilver) markSilverSeen(entry.id);
    onTap(entry);
  };

  // Edge/glow grammar — each state gets a distinct hue. Pink is reserved
  // for UNREAD so it's not overloaded across typing/unread/self. Typing
  // used to share the pink border; now it's a neutral text-2 border and
  // the bottom-right dots badge carries the typing signal unambiguously.
  //
  // Pulse tempos are staggered by urgency:
  //   pending invite (1.0s) = "act on this now"
  //   unseen nudge    (1.4s) = "someone reached out"
  let edgeColor: string | null = null;
  let glowColor: string | null = null;
  let pulseDurationMs: number | null = null;
  if (hasPendingInviteFromThem) {
    edgeColor = 'var(--pulse-pending)';
    glowColor = 'color-mix(in oklch, var(--pulse-pending) 55%, transparent)';
    pulseDurationMs = 1000;
  } else if (hasUnseenNudgeFromThem) {
    edgeColor = 'var(--pulse-nudge)';
    glowColor = 'color-mix(in oklch, var(--pulse-nudge) 55%, transparent)';
    pulseDurationMs = 1400;
  } else if (unreadCount > 0) {
    edgeColor = 'var(--pulse-accent)';
    glowColor = 'color-mix(in oklch, var(--pulse-accent) 35%, transparent)';
  } else if (isTypingToYou) {
    // Typing no longer borrows the pink border — dots badge carries it.
    edgeColor = 'color-mix(in oklch, var(--pulse-text-2) 50%, transparent)';
  } else if (isOnline) {
    edgeColor = 'color-mix(in oklch, var(--pulse-online) 60%, transparent)';
  }

  const ariaStatusBits = [
    hasPendingInviteFromThem ? 'pending invite' : null,
    hasUnseenNudgeFromThem ? 'unread nudge' : null,
    hasUnseenSilver ? 'unread silver' : null,
    unreadCount > 0 ? `${unreadCount} unread` : null,
    isTypingToYou ? 'typing' : null,
  ].filter(Boolean).join(', ');
  const ariaLabel = isSelf
    ? `You (${player?.personaName ?? ''})`
    : `${player?.personaName ?? 'Player'}${ariaStatusBits ? `, ${ariaStatusBits}` : ''}`;

  return (
    <motion.button
      onClick={handleTap}
      disabled={disabledInPicking}
      aria-label={ariaLabel}
      data-chip-player-id={entry.id}
      whileTap={disabledInPicking ? undefined : PULSE_TAP.card}
      style={{
        position: 'relative',
        width: 72, height: 100,
        flexShrink: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        borderRadius: 14,
        cursor: disabledInPicking ? 'not-allowed' : 'pointer',
        opacity: dimmed ? 0.82 : (disabledInPicking ? 0.4 : 1),
        scrollSnapAlign: 'start',
        // Opacity-only fade; transform is driven by framer-motion whileTap.
        transition: 'opacity 0.3s ease',
        animation: shaking ? 'pulse-chip-shake 350ms ease-in-out' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--pulse-surface-3)',
          boxShadow: glowColor ? `0 0 12px ${glowColor}` : 'none',
          // Constant 2px border width — avoids the 0.5px layout shift that
          // the old 2.5px/2px toggle introduced between states.
          border: `2px solid ${edgeColor ?? 'transparent'}`,
          animation: pulseDurationMs
            ? `pulse-breathe ${pulseDurationMs}ms ease-in-out infinite`
            : undefined,
        }}
      >
        {avatar && <img src={avatar} alt="" loading="lazy" width={72} height={100} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: 'var(--pulse-space-md) var(--pulse-space-xs) var(--pulse-space-2xs)',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          color, fontSize: 12, fontWeight: 700, textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {player?.personaName}
        </div>
      </div>

      {isSelf && (
        <>
          <span aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            border: '2px solid var(--pulse-accent)', pointerEvents: 'none',
          }} />
          <span aria-hidden="true" style={{
            position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
            padding: '2px 7px', borderRadius: 7,
            textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>You</span>
        </>
      )}

      {isLeader && !isSelf && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 'var(--pulse-space-xs)', left: 'var(--pulse-space-xs)',
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px color-mix(in oklch, var(--pulse-gold) 60%, transparent)',
          border: '1.5px solid color-mix(in oklch, var(--pulse-gold) 80%, transparent)',
        }}>
          <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffc83d" />
          </svg>
        </span>
      )}

      {hasUnseenNudgeFromThem && !hasPendingInviteFromThem && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          display: 'inline-flex', alignItems: 'center', gap: 'var(--pulse-space-2xs)',
          background: 'var(--pulse-nudge)', color: 'var(--pulse-bg)',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
          padding: '2px 7px', borderRadius: 9,
          textTransform: 'uppercase', animation: 'pulse-breathe 1.4s ease-in-out infinite',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <HandWaving size={11} weight="fill" />
          Nudge
        </span>
      )}

      {hasPendingInviteFromThem && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--pulse-pending)', color: 'var(--pulse-bg)',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
          padding: '2px 7px', borderRadius: 9,
          textTransform: 'uppercase', animation: 'pulse-breathe 1.0s ease-in-out infinite',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>Invite</span>
      )}

      {hasUnseenSilver && !hasPendingInviteFromThem && !hasUnseenNudgeFromThem && (
        <span
          data-testid={`chip-silver-pip-${entry.id}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            // When leader crown occupies the top-left, silver pip moves to
            // bottom-left so the two signals don't overlap. Typing dots
            // live bottom-right, so bottom-left is free.
            ...(isLeader && !isSelf
              ? { bottom: -2, left: -2 }
              : { top: -2, left: -2 }),
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--pulse-gold)',
            border: '2px solid var(--pulse-bg)',
            // One-shot arrival — scales in with gold glow peak, settles to
            // a quiet static glow. Was infinite pulse-breathe which read
            // as urgent as a pending invite; silver is calmer than that.
            animation: 'pulse-silver-pip-arrive 700ms ease-out forwards',
          }}
        />
      )}

      {/* Unread count — suppressed in picking mode so it doesn't stack under
          the "picked" check badge in the top-right corner. */}
      {unreadCount > 0 && !hasPendingInviteFromThem && !pickingMode && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
          minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--pulse-bg)',
        }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}

      {isTypingToYou && (
        <span aria-hidden="true" style={{
          position: 'absolute', bottom: -3, right: -3,
          background: 'var(--pulse-accent)', borderRadius: 10,
          padding: '2px 5px', display: 'flex', gap: 2,
          border: '2px solid var(--pulse-bg)',
        }}>
          {[0, 1, 2].map(d => (
            <span key={d} style={{
              width: 3, height: 3, borderRadius: '50%', background: 'var(--pulse-on-accent)',
              animation: `pulse-breathe 0.9s ease-in-out ${d * 0.15}s infinite`,
            }} />
          ))}
        </span>
      )}

      {pickingMode && picked && !locked && (
        <>
          <span aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            border: '3px solid var(--pulse-accent)', pointerEvents: 'none',
          }} />
          <span aria-hidden="true" style={{
            position: 'absolute', top: -6, right: -6,
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid var(--pulse-bg)', fontSize: 12, fontWeight: 900,
          }}>✓</span>
        </>
      )}

      {locked && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -6, right: -6,
          padding: '2px 6px', borderRadius: 9,
          background: 'rgba(20,20,26,0.85)', color: 'var(--pulse-text-2)',
          fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          border: '2px solid var(--pulse-bg)', pointerEvents: 'none',
        }}>In</span>
      )}
    </motion.button>
  );
}

export const CastChip = memo(CastChipInner);
