import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Zap, Bug } from 'lucide-react';

/**
 * Continuous-loop marquee using the duplicate-content CSS trick.
 * Two identical copies sit side by side; we translate the wrapper
 * from 0 to -50% (one copy's width). When the animation loops,
 * copy 2 is exactly where copy 1 started — seamless.
 *
 * Performance: will-change: transform promotes to compositor layer.
 * pauseOnHover stops animation when the user hovers (saves CPU).
 */
const Marquee: React.FC<{
  children: React.ReactNode;
  speed?: number; // pixels per second
  className?: string;
}> = ({ children, speed = 50, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      const width = contentRef.current.scrollWidth;
      setDuration(Math.max(5, width / speed));
    }
  }, [children, speed]);

  return (
    <div
      className={`overflow-hidden ${className || ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `marquee-scroll ${duration}s linear infinite`,
          animationPlayState: paused ? 'paused' : 'running',
          willChange: 'transform',
        }}
      >
        <div ref={contentRef} className="flex shrink-0 items-center">
          {children}
        </div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
};

export const NewsTicker: React.FC = () => {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const debugTicker = useGameStore(s => s.debugTicker);

  return (
    <div className="shrink-0">
      {/* Debug strip — static single-line (no marquee) */}
      {debugTicker && (
        <div className="bg-black/60 border-t border-skin-green/20 py-0.5 px-4 flex items-center gap-1.5 overflow-hidden">
          <Bug size={9} className="shrink-0 text-skin-green opacity-70" />
          <span className="text-[9px] font-mono text-skin-green/80 uppercase tracking-widest truncate">
            {debugTicker}
          </span>
        </div>
      )}

      {/* Main ticker — continuous marquee */}
      <div className="bg-skin-deep/90 border-t border-white/[0.06] px-0 py-2 flex items-center gap-3 overflow-hidden">
        {/* LIVE badge */}
        <div className="shrink-0 ml-4 flex items-center gap-1.5 px-2 py-0.5 rounded bg-skin-danger/20 border border-skin-danger/30">
          <span className="w-1.5 h-1.5 rounded-full bg-skin-danger animate-pulse-live" />
          <span className="text-[9px] font-mono font-bold text-skin-danger uppercase tracking-widest">Live</span>
        </div>

        {/* Scrolling messages */}
        <div className="flex-1 overflow-hidden">
          {tickerMessages.length > 0 ? (
            <Marquee speed={50}>
              {tickerMessages.map((msg) => (
                <span key={msg.id} className="flex items-center">
                  <Zap size={10} className="shrink-0 mr-1.5 text-skin-gold opacity-60" />
                  <span className="text-xs font-mono text-skin-dim uppercase tracking-wider">
                    {msg.text}
                  </span>
                  <span className="mx-6 text-skin-dim/30 text-xs">◆</span>
                </span>
              ))}
            </Marquee>
          ) : (
            <p className="text-xs font-mono text-skin-dim/40 uppercase tracking-wider px-4">
              Awaiting updates...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
