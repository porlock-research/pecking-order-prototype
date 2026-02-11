import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Zap } from 'lucide-react';

const CYCLE_INTERVAL = 4000;

export const NewsTicker: React.FC = () => {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const prevLengthRef = useRef(tickerMessages.length);

  // When a new message arrives, jump to it
  useEffect(() => {
    if (tickerMessages.length > prevLengthRef.current) {
      setIsExiting(false);
      setDisplayIndex(tickerMessages.length - 1);
    }
    prevLengthRef.current = tickerMessages.length;
  }, [tickerMessages.length]);

  // Auto-cycle through messages
  useEffect(() => {
    if (tickerMessages.length <= 1) return;

    const timer = setInterval(() => {
      setIsExiting(true);
      setTimeout(() => {
        setDisplayIndex(prev => (prev + 1) % tickerMessages.length);
        setIsExiting(false);
      }, 300);
    }, CYCLE_INTERVAL);

    return () => clearInterval(timer);
  }, [tickerMessages.length]);

  const currentMessage = tickerMessages[displayIndex];

  return (
    <div className="shrink-0 bg-skin-deep/90 backdrop-blur-sm border-t border-white/[0.06] px-4 py-2 flex items-center gap-3 overflow-hidden">
      {/* LIVE badge */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-skin-danger/20 border border-skin-danger/30">
        <span className="w-1.5 h-1.5 rounded-full bg-skin-danger animate-pulse-live" />
        <span className="text-[9px] font-mono font-bold text-skin-danger uppercase tracking-widest">Live</span>
      </div>

      {/* Message text */}
      <div className="flex-1 overflow-hidden">
        {currentMessage ? (
          <p
            key={currentMessage.id}
            className={`text-xs font-mono text-skin-dim uppercase tracking-wider truncate ${
              isExiting ? 'slide-out-left' : 'slide-in-right'
            }`}
          >
            <Zap size={10} className="inline-block mr-1.5 text-skin-gold opacity-60" />
            {currentMessage.text}
          </p>
        ) : (
          <p className="text-xs font-mono text-skin-dim/40 uppercase tracking-wider">
            Awaiting updates...
          </p>
        )}
      </div>
    </div>
  );
};
