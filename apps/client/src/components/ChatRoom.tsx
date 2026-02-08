import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage } from '@pecking-order/shared-types';

interface ChatRoomProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
  };
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ engine }) => {
  const { chatLog, playerId, roster } = useGameStore();
  const [inputValue, setInputValue] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog, optimisticMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !playerId) return;

    // Create optimistic message
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: playerId,
      timestamp: Date.now(),
      content: inputValue,
      channel: 'MAIN',
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    engine.sendMessage(inputValue);
    setInputValue('');

    // Remove optimistic message after 5 seconds if server doesn't confirm (simple cleanup)
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }, 5000);
  };

  // Combine real and optimistic messages, filtering out duplicates if server confirms
  const displayedMessages = [...chatLog];
  optimisticMessages.forEach(opt => {
    // Very simple check: if a message with the same content and timestamp close enough exists, skip it
    const alreadyReceived = chatLog.some(m => 
      m.senderId === opt.senderId && 
      m.content === opt.content && 
      Math.abs(m.timestamp - opt.timestamp) < 2000
    );
    if (!alreadyReceived) {
      displayedMessages.push(opt);
    }
  });

  return (
    <div className="chat-room">
      <div className="messages" ref={scrollRef}>
        {displayedMessages.map((msg) => {
          const sender = roster[msg.senderId];
          const isMe = msg.senderId === playerId;
          const isOptimistic = msg.id.toString().startsWith('opt-');

          return (
            <div key={msg.id} className={`message ${isMe ? 'mine' : ''} ${isOptimistic ? 'optimistic' : ''}`}>
              <div className="msg-header">
                <span className="sender">{sender?.personaName || 'Unknown'}</span>
                <span className="time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="msg-content">{msg.content}</div>
            </div>
          );
        })}
      </div>

      <form className="chat-input" onSubmit={handleSend}>
        <input 
          type="text" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          maxLength={280}
        />
        <button type="submit">Send</button>
      </form>

      <style>{`
        .chat-room {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-bottom: 1rem;
        }
        .message {
          padding: 0.5rem;
          border-radius: 8px;
          background: #333;
          max-width: 80%;
          align-self: flex-start;
        }
        .message.mine {
          background: #007bff;
          align-self: flex-end;
        }
        .message.optimistic {
          opacity: 0.6;
        }
        .msg-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          margin-bottom: 0.2rem;
          opacity: 0.8;
        }
        .sender { font-weight: bold; }
        .chat-input {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
        }
        .chat-input input {
          flex: 1;
          padding: 0.5rem;
          border-radius: 4px;
          border: 1px solid #444;
          background: #222;
          color: white;
        }
        .chat-input button {
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: none;
          background: #007bff;
          color: white;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
