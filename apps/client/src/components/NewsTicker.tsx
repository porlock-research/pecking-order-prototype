import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Zap, Bug } from 'lucide-react';

/**
 * Continuous-loop marquee using the duplicate-content CSS trick.
 * Two identical copies sit side by side; we translate the wrapper
 * from 0 to -50% (one copy's width). When the animation loops,
 * copy 2 is exactly where copy 1 started — seamless.
 *
 * Speed is adaptive: longer content = proportionally longer duration,
 * so scroll velocity stays constant regardless of content length.
 */
const Marquee: React.FC<{
  children: React.ReactNode;
  speed?: number; // pixels per second
  className?: string;
}> = ({ children, speed = 50, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    if (contentRef.current) {
      const width = contentRef.current.scrollWidth;
      setDuration(Math.max(5, width / speed));
    }
  }, [children, speed]);

  return (
    <div className={`overflow-hidden ${className || ''}`}>
      <div
        className="flex whitespace-nowrap"
        style={{ animation: `marquee-scroll ${duration}s linear infinite` }}
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
      {/* Debug strip — green continuous marquee */}
      {debugTicker && (
        <div className="bg-black/60 border-t border-skin-green/20 py-0.5">
          <Marquee speed={40}>
            <Bug size={9} className="shrink-0 mr-1.5 text-skin-green opacity-70" />
            <span className="text-[9px] font-mono text-skin-green/80 uppercase tracking-widest">
              {debugTicker}
            </span>
            <span className="mx-10 text-skin-green/30 text-[9px]">◆</span>
          </Marquee>
        </div>
      )}

      {/* Main ticker — continuous marquee */}
      <div className="bg-skin-deep/90 backdrop-blur-sm border-t border-white/[0.06] px-0 py-2 flex items-center gap-3 overflow-hidden">
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
