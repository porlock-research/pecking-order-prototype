import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { ChannelTypes, PlayerStatuses, GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { Coins, Trophy, Skull } from 'lucide-react';

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
        return {
          channelId: ch.id,
          memberNames,
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

  const sortedPlayers = useMemo(() => {
    return Object.values(roster)
      .filter(p => p.id !== GAME_MASTER_ID)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === PlayerStatuses.ALIVE ? -1 : 1;
        return a.personaName.localeCompare(b.personaName);
      });
  }, [roster]);

  const groupsUsed = dmStats?.groupsUsed ?? 0;
  const groupsLimit = dmStats?.groupsLimit ?? 3;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
        <span className="text-base font-bold text-skin-base uppercase tracking-wider font-display">People</span>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onNewGroup}
            className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1.5 text-skin-pink uppercase tracking-widest"
            whileTap={{ scale: 0.95 }}
          >
            + Group <span className="text-skin-dim">{Math.max(0, groupsLimit - groupsUsed)}/{groupsLimit}</span>
          </motion.button>
          <motion.button
            onClick={onNewDm}
            className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1.5 text-skin-pink uppercase tracking-widest"
            whileTap={{ scale: 0.95 }}
          >
            + DM
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {/* Group DM threads */}
        {groupThreads.length > 0 && (
          <>
            <div className="px-1 pt-1 pb-2">
              <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Groups</span>
            </div>
            {groupThreads.map((thread, i) => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isFromMe = lastMsg?.senderId === playerId;
              const lastSenderName = lastMsg ? (roster[lastMsg.senderId]?.personaName || 'Unknown') : '';
              const initials = thread.memberNames.slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('');

              return (
                <motion.button
                  key={thread.channelId}
                  onClick={() => onSelectGroup(thread.channelId)}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all text-left"
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="w-12 h-12 rounded-full bg-skin-panel flex items-center justify-center text-[12px] font-bold font-mono text-skin-pink avatar-ring shrink-0">
                    {initials}
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
            <div className="h-px bg-white/[0.06] my-2" />
          </>
        )}

        {/* Player list */}
        <div className="px-1 pt-1 pb-2">
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Players</span>
        </div>
        {sortedPlayers.map((player, i) => {
          const isMe = player.id === playerId;
          const isOnline = onlinePlayers.includes(player.id);
          const isEliminated = player.status === PlayerStatuses.ELIMINATED;
          const lastDm = lastDmByPlayer.get(player.id);

          return (
            <motion.button
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border transition-all text-left
                ${isMe ? 'bg-skin-gold/10 border-skin-gold/30' : 'bg-glass border-white/[0.06]'}
                ${isEliminated ? 'opacity-50' : ''}
              `}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isEliminated ? 0.5 : 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-skin-panel flex items-center justify-center text-base font-bold font-mono text-skin-gold avatar-ring">
                  {isEliminated ? (
                    <Skull size={18} className="text-skin-danger" />
                  ) : (
                    player.personaName?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-skin-fill ${isOnline ? 'bg-skin-green' : 'bg-skin-dim/40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-base truncate">{player.personaName}</span>
                    {isMe && <span className="badge-skew text-[9px] shrink-0">YOU</span>}
                    {isEliminated && <span className="text-[9px] font-mono text-skin-danger uppercase">eliminated</span>}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-sm font-bold shrink-0 ml-2">
                    {player.gold > 0 && (
                      <div className="flex items-center gap-0.5 text-amber-400">
                        <Trophy size={11} />
                        {player.gold}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 text-skin-gold">
                      <Coins size={12} className="text-skin-dim" />
                      {player.silver}
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
      </div>
    </div>
  );
}
