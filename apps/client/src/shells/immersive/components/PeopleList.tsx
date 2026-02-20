import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { ChannelTypes, PlayerStatuses, GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { Coins, Trophy, ChevronDown } from 'lucide-react';
import { SPRING, TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PeopleListProps {
  onSelectPlayer: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
}

export function PeopleList({ onSelectPlayer, onSelectGroup, onNewDm, onNewGroup }: PeopleListProps) {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const dmStats = useGameStore(s => s.dmStats);

  const [eliminatedExpanded, setEliminatedExpanded] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(true);

  const groupThreads = useMemo(() => {
    if (!playerId) return [];
    return Object.values(channels)
      .filter(ch => ch.type === ChannelTypes.GROUP_DM && ch.memberIds.includes(playerId))
      .map(ch => {
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const memberNames = ch.memberIds
          .filter(id => id !== playerId)
          .map(id => roster[id]?.personaName || 'Unknown');
        const otherMemberIds = ch.memberIds.filter(id => id !== playerId);
        return {
          channelId: ch.id,
          memberNames,
          otherMemberIds,
          messages,
          lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : ch.createdAt,
        };
      })
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [channels, chatLog, playerId, roster]);

  const lastDmByPlayer = useMemo(() => {
    if (!playerId) return new Map<string, ChatMessage>();
    const map = new Map<string, ChatMessage>();
    const dmMessages = chatLog
      .filter((m: ChatMessage) => channels[m.channelId]?.type === ChannelTypes.DM)
      .sort((a, b) => b.timestamp - a.timestamp);
    for (const msg of dmMessages) {
      const partnerId = msg.senderId === playerId ? (msg.targetId || '') : msg.senderId;
      if (partnerId && !map.has(partnerId)) map.set(partnerId, msg);
    }
    return map;
  }, [chatLog, channels, playerId]);

  const { alivePlayers, eliminatedPlayers, mePlayer } = useMemo(() => {
    const all = Object.values(roster).filter(p => p.id !== GAME_MASTER_ID);
    const me = all.find(p => p.id === playerId);
    const alive = all
      .filter(p => p.status === PlayerStatuses.ALIVE && p.id !== playerId)
      .sort((a, b) => a.personaName.localeCompare(b.personaName));
    const eliminated = all
      .filter(p => p.status === PlayerStatuses.ELIMINATED)
      .sort((a, b) => a.personaName.localeCompare(b.personaName));
    return { alivePlayers: alive, eliminatedPlayers: eliminated, mePlayer: me };
  }, [roster, playerId]);

  const groupsUsed = dmStats?.groupsUsed ?? 0;
  const groupsLimit = dmStats?.groupsLimit ?? 3;

  const visibleGroups = groupsExpanded ? groupThreads : groupThreads.slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
        <span className="text-base font-bold text-skin-base uppercase tracking-wider font-display">People</span>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onNewGroup}
            className="text-[11px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1.5 text-skin-pink uppercase tracking-widest min-h-[32px]"
            whileTap={TAP.button}
            transition={SPRING.button}
          >
            + Group <span className="text-skin-dim">{Math.max(0, groupsLimit - groupsUsed)}/{groupsLimit}</span>
          </motion.button>
          <motion.button
            onClick={onNewDm}
            className="text-[11px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1.5 text-skin-pink uppercase tracking-widest min-h-[32px]"
            whileTap={TAP.button}
            transition={SPRING.button}
          >
            + DM
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
        {/* "You" card — pinned at top */}
        {mePlayer && (
          <motion.button
            onClick={() => onSelectPlayer(mePlayer.id)}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-skin-gold/10 border border-skin-gold/30 text-left"
            whileTap={TAP.card}
            transition={SPRING.button}
          >
            <div className="relative shrink-0">
              <PersonaAvatar avatarUrl={mePlayer.avatarUrl} personaName={mePlayer.personaName} size={48} layoutId={`avatar-${mePlayer.id}`} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-skin-fill bg-skin-green" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-base truncate">{mePlayer.personaName}</span>
                <span className="badge-skew text-[9px] shrink-0">YOU</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-skin-dim">
                {dmStats && <span>{dmStats.charsLimit - dmStats.charsUsed} chars left</span>}
                {dmStats && <span>{dmStats.partnersLimit - dmStats.partnersUsed} partners left</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-sm font-bold shrink-0">
              {(mePlayer.gold ?? 0) > 0 && (
                <div className="flex items-center gap-0.5 text-amber-400">
                  <Trophy size={11} />{mePlayer.gold}
                </div>
              )}
              <div className="flex items-center gap-0.5 text-skin-gold">
                <Coins size={12} className="text-skin-dim" />{mePlayer.silver}
              </div>
            </div>
          </motion.button>
        )}

        {/* Group DM threads */}
        {groupThreads.length > 0 && (
          <>
            <div className="px-1 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Groups</span>
              {groupThreads.length > 2 && (
                <button
                  onClick={() => setGroupsExpanded(!groupsExpanded)}
                  className="text-[10px] font-mono text-skin-dim flex items-center gap-1"
                >
                  {groupsExpanded ? 'Show less' : `Show ${groupThreads.length - 2} more`}
                  <motion.span animate={{ rotate: groupsExpanded ? 180 : 0 }} transition={SPRING.snappy}>
                    <ChevronDown size={12} />
                  </motion.span>
                </button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {visibleGroups.map((thread, i) => {
                const lastMsg = thread.messages[thread.messages.length - 1];
                const isFromMe = lastMsg?.senderId === playerId;
                const lastSenderName = lastMsg ? (roster[lastMsg.senderId]?.personaName || 'Unknown') : '';
                return (
                  <motion.button
                    key={thread.channelId}
                    onClick={() => onSelectGroup(thread.channelId)}
                    className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-skin-glass-elevated border border-white/[0.06] hover:border-skin-pink/30 transition-all text-left"
                    whileTap={TAP.card}
                    transition={SPRING.button}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
                      {thread.otherMemberIds.slice(0, 2).map((id, idx) => {
                        const p = roster[id];
                        return (
                          <div key={id} className="absolute" style={{ top: idx * 10, left: idx * 10, zIndex: 2 - idx }}>
                            <PersonaAvatar avatarUrl={p?.avatarUrl} personaName={p?.personaName} size={32} className="ring-2 ring-skin-deep" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-base truncate text-skin-base">{thread.memberNames.join(', ')}</span>
                        <span className="text-[9px] font-mono text-skin-dim shrink-0 ml-2">
                          {lastMsg ? new Date(thread.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New'}
                        </span>
                      </div>
                      <p className="text-sm text-skin-dim truncate">
                        {lastMsg ? `${isFromMe ? 'You' : lastSenderName}: ${lastMsg.content}` : 'No messages yet'}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            <div className="h-px bg-white/[0.06] my-1" />
          </>
        )}

        {/* Alive players */}
        <div className="px-1 pt-2 pb-1">
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">
            Alive <span className="text-skin-green">({alivePlayers.length})</span>
          </span>
        </div>
        {alivePlayers.map((player, i) => {
          const isOnline = onlinePlayers.includes(player.id);
          const lastDm = lastDmByPlayer.get(player.id);

          return (
            <motion.button
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-skin-glass-elevated border border-white/[0.06] text-left"
              whileTap={TAP.card}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING.button, delay: i * 0.02 }}
            >
              <div className="relative shrink-0">
                <PersonaAvatar avatarUrl={player.avatarUrl} personaName={player.personaName} size={48} layoutId={`avatar-${player.id}`} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-skin-fill ${isOnline ? 'bg-skin-green animate-pulse-live' : 'bg-skin-dim/40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-base truncate">{player.personaName}</span>
                  <div className="flex items-center gap-2 font-mono text-sm font-bold shrink-0 ml-2">
                    {(player.gold ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5 text-amber-400">
                        <Trophy size={11} />{player.gold}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 text-skin-gold">
                      <Coins size={12} className="text-skin-dim" />{player.silver}
                    </div>
                  </div>
                </div>
                {lastDm && (
                  <p className="text-sm text-skin-dim truncate">
                    {lastDm.senderId === playerId ? 'You: ' : ''}{lastDm.content}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}

        {/* Eliminated players — collapsible */}
        {eliminatedPlayers.length > 0 && (
          <>
            <button
              onClick={() => setEliminatedExpanded(!eliminatedExpanded)}
              className="w-full px-1 pt-3 pb-1 flex items-center justify-between"
            >
              <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">
                Eliminated <span className="text-skin-danger">({eliminatedPlayers.length})</span>
              </span>
              <motion.span animate={{ rotate: eliminatedExpanded ? 180 : 0 }} transition={SPRING.snappy}>
                <ChevronDown size={14} className="text-skin-dim" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {eliminatedExpanded && eliminatedPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING.snappy}
                >
                  <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-skin-glass border border-white/[0.04] opacity-50">
                    <div className="relative shrink-0">
                      <PersonaAvatar avatarUrl={player.avatarUrl} personaName={player.personaName} size={48} eliminated />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base truncate text-skin-dim">{player.personaName}</span>
                        <span className="text-[9px] font-mono text-skin-danger uppercase">eliminated</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 font-mono text-sm text-skin-dim shrink-0">
                      <Coins size={12} />{player.silver}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
