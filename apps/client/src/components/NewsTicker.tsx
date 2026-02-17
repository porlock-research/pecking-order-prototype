import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Zap, Bug } from 'lucide-react';

export const NewsTicker: React.FC = () => {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const debugTicker = useGameStore(s => s.debugTicker);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cycle through messages every 4 seconds
  useEffect(() => {
    if (tickerMessages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % tickerMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [tickerMessages.length]);

  // Reset index when new messages arrive (show latest)
  useEffect(() => {
    if (tickerMessages.length > 0) {
      setCurrentIndex(tickerMessages.length - 1);
    }
  }, [tickerMessages.length]);

  const currentMessage = tickerMessages[currentIndex];

  return (
    <div className="shrink-0">
      {/* Debug strip — dev only */}
      {import.meta.env.DEV && debugTicker && (
        <div className="bg-black/60 border-t border-skin-green/20 py-0.5 px-4 flex items-center gap-1.5 overflow-hidden">
          <Bug size={9} className="shrink-0 text-skin-green opacity-70" />
          <span className="text-[9px] font-mono text-skin-green/80 uppercase tracking-widest truncate">
            {debugTicker}
          </span>
        </div>
      )}

      {/* Main ticker — static cycling display */}
      <div className="bg-skin-deep/90 border-t border-white/[0.06] px-0 py-2 flex items-center gap-3 overflow-hidden">
        {/* LIVE badge */}
        <div className="shrink-0 ml-4 flex items-center gap-1.5 px-2 py-0.5 rounded bg-skin-danger/20 border border-skin-danger/30">
          <span className="w-1.5 h-1.5 rounded-full bg-skin-danger animate-pulse-live" />
          <span className="text-[9px] font-mono font-bold text-skin-danger uppercase tracking-widest">Live</span>
        </div>

        {/* Current message */}
        <div className="flex-1 overflow-hidden">
          {currentMessage ? (
            <div key={currentMessage.id} className="flex items-center slide-in-right">
              <Zap size={10} className="shrink-0 mr-1.5 text-skin-gold opacity-60" />
              <span className="text-xs font-mono text-skin-dim uppercase tracking-wider truncate">
                {currentMessage.text}
              </span>
            </div>
          ) : (
            <p className="text-xs font-mono text-skin-dim/40 uppercase tracking-wider px-4">
              Awaiting updates...
            </p>
          )}
        </div>

        {/* Message counter */}
        {tickerMessages.length > 1 && (
          <span className="shrink-0 mr-4 text-[9px] font-mono text-skin-dim/30">
            {currentIndex + 1}/{tickerMessages.length}
          </span>
        )}
      </div>
    </div>
  );
};
