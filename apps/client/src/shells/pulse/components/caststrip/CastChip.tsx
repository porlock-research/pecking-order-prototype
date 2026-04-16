import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CastStripEntry } from '../../../../store/useGameStore';
import { useGameStore, selectChipSlotStatus } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { HandWaving } from '../../icons';

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

  let edgeColor: string | null = null;
  let glowColor: string | null = null;
  let pulse = false;
  if (hasPendingInviteFromThem) {
    edgeColor = 'var(--pulse-pending)'; glowColor = 'rgba(255,140,66,0.55)'; pulse = true;
  } else if (hasUnseenNudgeFromThem) {
    edgeColor = 'var(--pulse-nudge)'; glowColor = 'rgba(255,160,77,0.55)'; pulse = true;
  } else if (unreadCount > 0) {
    edgeColor = 'var(--pulse-accent)'; glowColor = 'rgba(255,59,111,0.35)';
  } else if (isTypingToYou) {
    edgeColor = 'var(--pulse-accent)';
  } else if (isOnline) {
    edgeColor = 'rgba(46,204,113,0.6)';
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
    <button
      onClick={handleTap}
      disabled={disabledInPicking}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 72, height: 100,
        flexShrink: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        borderRadius: 14,
        cursor: disabledInPicking ? 'not-allowed' : 'pointer',
        opacity: dimmed ? 0.45 : (disabledInPicking ? 0.4 : 1),
        filter: dimmed ? 'saturate(0.6)' : 'none',
        scrollSnapAlign: 'start',
        transition: 'transform 0.12s ease, opacity 0.3s ease, filter 0.3s ease',
        animation: shaking ? 'pulse-chip-shake 350ms ease-in-out' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          overflow: 'hidden',
          background: '#222',
          boxShadow: glowColor ? `0 0 12px ${glowColor}` : 'none',
          border: edgeColor ? `2.5px solid ${edgeColor}` : '2px solid transparent',
          animation: pulse ? 'pulse-breathe 1.4s ease-in-out infinite' : undefined,
        }}
      >
        {avatar && <img src={avatar} alt="" loading="lazy" width={72} height={100} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '14px 6px 5px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          color, fontSize: 11, fontWeight: 700, textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {player?.personaName}
        </div>
      </div>

      {isSelf && (
        <>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            border: '2px solid var(--pulse-accent)', pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--pulse-accent)', color: '#fff',
            fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
            padding: '1px 5px', borderRadius: 6,
            textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>You</span>
        </>
      )}

      {isLeader && !isSelf && (
        <span style={{
          position: 'absolute', top: 4, left: 4,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(255,200,61,0.6)',
          border: '1.5px solid rgba(255,200,61,0.8)',
        }}>
          <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffc83d" />
          </svg>
        </span>
      )}

      {hasUnseenNudgeFromThem && !hasPendingInviteFromThem && (
        <span style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: 'var(--pulse-nudge)', color: '#1a1422',
          fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
          padding: '2px 6px', borderRadius: 8,
          textTransform: 'uppercase', animation: 'pulse-breathe 1.4s ease-in-out infinite',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <HandWaving size={10} weight="fill" />
          Nudge
        </span>
      )}

      {hasPendingInviteFromThem && (
        <span style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--pulse-pending)', color: 'var(--pulse-on-accent)',
          fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
          padding: '2px 6px', borderRadius: 8,
          textTransform: 'uppercase', animation: 'pulse-breathe 1.4s ease-in-out infinite',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>Invite</span>
      )}

      {hasUnseenSilver && !hasPendingInviteFromThem && !hasUnseenNudgeFromThem && (
        <span
          data-testid={`chip-silver-pip-${entry.id}`}
          style={{
            position: 'absolute', top: -2, left: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--pulse-gold)',
            boxShadow: '0 0 6px rgba(255,200,61,0.6)',
            border: '2px solid var(--pulse-bg)',
          }}
        />
      )}

      {unreadCount > 0 && !hasPendingInviteFromThem && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--pulse-accent)', color: '#fff',
          minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--pulse-bg)',
        }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}

      {isTypingToYou && (
        <span style={{
          position: 'absolute', bottom: -3, right: -3,
          background: 'var(--pulse-accent)', borderRadius: 10,
          padding: '2px 5px', display: 'flex', gap: 2,
          border: '2px solid var(--pulse-bg)',
        }}>
          {[0, 1, 2].map(d => (
            <span key={d} style={{
              width: 3, height: 3, borderRadius: '50%', background: '#fff',
              animation: `pulse-breathe 0.9s ease-in-out ${d * 0.15}s infinite`,
            }} />
          ))}
        </span>
      )}

      {pickingMode && picked && !locked && (
        <>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            border: '3px solid var(--pulse-accent)', pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: -6, right: -6,
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--pulse-accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid var(--pulse-bg)', fontSize: 12, fontWeight: 900,
          }}>✓</span>
        </>
      )}

      {locked && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          padding: '2px 6px', borderRadius: 9,
          background: 'rgba(20,20,26,0.85)', color: 'var(--pulse-text-2)',
          fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          border: '2px solid var(--pulse-bg)', pointerEvents: 'none',
        }}>In</span>
      )}
    </button>
  );
}

export const CastChip = memo(CastChipInner);
