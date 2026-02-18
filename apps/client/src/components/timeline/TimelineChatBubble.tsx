import React from 'react';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';

interface TimelineChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  sender: SocialPlayer | undefined;
  showSender: boolean;
  isOptimistic?: boolean;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const TimelineChatBubble: React.FC<TimelineChatBubbleProps> = ({
  message,
  isMe,
  sender,
  showSender,
  isOptimistic,
}) => {
  const isGameMaster = message.senderId === GAME_MASTER_ID;

  // Game Master messages — full-width banner style
  if (isGameMaster) {
    return (
      <div className="w-full slide-up-in">
        <div className="border-l-2 border-skin-gold bg-skin-gold/10 px-4 py-3 rounded-r-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-skin-gold uppercase tracking-wider font-display">
              Game Master
            </span>
            <span className="text-[9px] font-mono text-skin-dim/50">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <p className="text-sm text-skin-base leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} ${isOptimistic ? 'shimmer' : ''} slide-up-in`}
    >
      {/* Sender Name (Only for others, only on first in group) */}
      {!isMe && showSender && (
        <div className="flex items-center gap-2 mb-1 ml-1">
          <span className="text-[11px] font-bold text-skin-dim uppercase tracking-wider">
            {sender?.personaName || 'Unknown'}
          </span>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative
          ${isMe
            ? 'bg-skin-pink text-white rounded-tr-sm'
            : 'bg-white/10 border border-white/[0.08] text-skin-base rounded-tl-sm'
          }`}
      >
        {message.content}
      </div>

      {/* Timestamp — always visible inline */}
      <span className={`text-[9px] font-mono text-skin-dim/50 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
};
