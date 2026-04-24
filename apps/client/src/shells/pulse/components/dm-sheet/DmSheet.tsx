import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { supportsViewTransitions, prefersReducedMotion } from '../../viewTransitions';
import { ChannelTypes } from '@pecking-order/shared-types';
import { DmHero } from './DmHero';
import { DmGroupHero } from './DmGroupHero';
import { DmBioQuote } from './DmBioQuote';
import { DmMessages } from './DmMessages';
import { DmInput } from './DmInput';
import { DmEmptyState } from './DmEmptyState';
import { DmPendingState } from './DmPendingState';
import { DmWaitingBanner } from './DmWaitingBanner';
import { TypingIndicator } from '../chat/TypingIndicator';

interface Props {
  targetId: string;            // playerId (1:1) or channelId (group)
  isGroup: boolean;
  onClose: () => void;
}

export function DmSheet({ targetId, isGroup, onClose }: Props) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId) as string;
  const channels = useGameStore(s => s.channels);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const standings = useGameStore(useShallow(selectStandings));

  const channel = useMemo(() => {
    if (isGroup) return channels[targetId] ?? null;
    // Treat pendingMemberIds as valid membership when resolving: when someone
    // has sent me a DM invite, I'm in pendingMemberIds until I accept. Without
    // this, tapping the inviter's avatar would miss the existing channel,
    // render the first-message empty state, and the first send would then get
    // rejected server-side with INVITE_REQUIRED (LR8W3U playtest pattern, 4
    // rejects in 2 minutes). Mirrors Vivid's DMChat resolver.
    const inCh = (ch: any, pid: string) =>
      ch.memberIds.includes(pid) || (ch.pendingMemberIds || []).includes(pid);
    return Object.values(channels).find(ch =>
      ch.type === ChannelTypes.DM && inCh(ch, playerId) && inCh(ch, targetId)
    ) ?? null;
  }, [channels, targetId, isGroup, playerId]);

  const incomingPending = !!(channel && !isGroup && (channel.pendingMemberIds || []).includes(playerId));
  const outgoingPending = !!(channel && !isGroup
    && channel.createdBy === playerId
    && (channel.pendingMemberIds || []).some(id => id !== playerId));

  const targetPlayer = !isGroup ? roster[targetId] : null;
  const targetColorIdx = !isGroup ? Object.keys(roster).indexOf(targetId) : -1;
  const targetRank = !isGroup ? (standings.find(s => s.id === targetId)?.rank ?? null) : null;
  const targetIsLeader = !isGroup && standings.length > 0 && standings[0].id === targetId;
  const targetIsOnline = !isGroup && onlinePlayers.includes(targetId);

  const groupMembers = isGroup && channel
    ? channel.memberIds
        .filter(id => id !== playerId)
        .map(id => ({ id, player: roster[id], colorIdx: Object.keys(roster).indexOf(id) }))
        .filter((m): m is { id: string; player: typeof roster[string]; colorIdx: number } => !!m.player)
    : [];

  const groupPendingMembers = isGroup && channel
    ? (channel.pendingMemberIds ?? [])
        .filter(id => id !== playerId)
        .map(id => ({ id, player: roster[id], colorIdx: Object.keys(roster).indexOf(id) }))
        .filter((m): m is { id: string; player: typeof roster[string]; colorIdx: number } => !!m.player)
    : [];

  // When VTAPI drives the chip → hero morph, framer's slide-from-right
  // would race with the browser-owned geometry animation. Gate the sheet
  // animation off in that path. Groups don't morph (no single face) so
  // they keep the slide regardless.
  const vtActive = supportsViewTransitions() && !prefersReducedMotion() && !isGroup;

  return (
    <>
      <motion.div
        initial={vtActive ? false : { opacity: 0 }}
        animate={vtActive ? undefined : { opacity: 1 }}
        exit={vtActive ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0 }}
        transition={vtActive ? undefined : PULSE_SPRING.exit}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Direct message"
        initial={vtActive ? false : { x: '100%' }}
        animate={vtActive ? undefined : { x: 0 }}
        exit={vtActive ? { x: 0, transition: { duration: 0 } } : { x: '100%' }}
        transition={vtActive ? undefined : PULSE_SPRING.page}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border-2)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflow: 'hidden',
        }}
      >
        {isGroup && groupMembers.length > 0
          ? <DmGroupHero members={groupMembers} pendingMembers={groupPendingMembers} channelId={channel?.id ?? null} onClose={onClose} />
          : targetPlayer && (
              <DmHero
                player={targetPlayer}
                colorIdx={targetColorIdx}
                rank={targetRank}
                isLeader={targetIsLeader}
                isOnline={targetIsOnline}
                channelId={channel?.id ?? null}
                onClose={onClose}
              />
            )}

        {!isGroup && targetPlayer && <DmBioQuote bio={targetPlayer.bio} name={targetPlayer.personaName} />}

        <div style={{
          padding: '8px 16px', fontSize: 10, color: 'var(--pulse-text-3)',
          textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1,
          borderBottom: '1px solid var(--pulse-border)',
        }}>Private conversation</div>

        {incomingPending && channel ? (
          <DmPendingState
            channelId={channel.id}
            inviterName={targetPlayer?.personaName ?? 'Someone'}
            onClose={onClose}
          />
        ) : (
          <>
            {channel
              ? <DmMessages channelId={channel.id} isGroup={isGroup} />
              : <DmEmptyState
                  isGroup={isGroup}
                  targetName={targetPlayer?.personaName ?? ''}
                  groupNames={groupMembers.map(m => m.player.personaName.split(' ')[0]).join(', ')}
                />
            }

            {outgoingPending && targetPlayer && <DmWaitingBanner targetName={targetPlayer.personaName} />}

            {channel && <TypingIndicator channelId={channel.id} />}

            <DmInput
              channelId={channel?.id ?? null}
              recipientIds={isGroup ? (channel?.memberIds ?? []).filter(id => id !== playerId) : [targetId]}
              placeholderName={isGroup ? 'group' : (targetPlayer?.personaName ?? '')}
              disabled={outgoingPending}
            />
          </>
        )}
      </motion.div>
    </>
  );
}
