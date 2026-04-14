import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { PULSE_Z, backdropFor } from '../../zIndex';
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
    return Object.values(channels).find(ch =>
      ch.type === ChannelTypes.DM && ch.memberIds.includes(playerId) && ch.memberIds.includes(targetId)
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
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
              ? <DmMessages channelId={channel.id} />
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
