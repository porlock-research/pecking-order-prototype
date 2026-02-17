import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { LiveGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import LiveGameWrapper from '../wrappers/LiveGameWrapper';

interface TouchScreenProps {
  cartridge: LiveGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(2)}s`;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(1);
  return `${min}m ${sec}s`;
}

export default function TouchScreen({ cartridge, playerId, roster, engine, onDismiss }: TouchScreenProps) {
  const isSolo = cartridge.mode === 'SOLO';
  const results = cartridge.results;
  const rankings = (results?.summary?.rankings ?? []) as Array<{ playerId: string; duration: number }>;

  return (
    <LiveGameWrapper
      cartridge={cartridge}
      playerId={playerId}
      roster={roster}
      engine={engine}
      onDismiss={onDismiss}
      title="Touch Screen"
      description="Hold the button as long as you can. Longer = more silver."
      startEvent="GAME.TOUCH_SCREEN.START"
      readyEvent="GAME.TOUCH_SCREEN.READY"
      renderGame={() => (
        <ActiveGame
          cartridge={cartridge}
          playerId={playerId}
          roster={roster}
          engine={engine}
          isSolo={isSolo}
        />
      )}
      renderBreakdown={() => (
        <RankingsBreakdown
          rankings={rankings}
          roster={roster}
          playerId={playerId}
          silverRewards={results?.silverRewards ?? {}}
          isSolo={isSolo}
        />
      )}
    />
  );
}

// --- Active game phase (rendered by LiveGameWrapper during ACTIVE) ---

function ActiveGame({
  cartridge,
  playerId,
  roster,
  engine,
  isSolo,
}: {
  cartridge: LiveGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  isSolo: boolean;
}) {
  const holdStates = (cartridge.holdStates ?? {}) as Record<string, { holdStart: number; holdEnd: number | null; duration: number }>;
  const myHold = holdStates[playerId];
  const isHolding = !!myHold && myHold.holdEnd === null;
  const hasReleased = !!myHold && myHold.holdEnd !== null;
  const [elapsed, setElapsed] = useState(0);

  // Optimistic local state for press-and-hold (bridges latency gap)
  const [localHolding, setLocalHolding] = useState(false);
  const localHoldStart = useRef(0);
  const touchSent = useRef(false);
  const releaseSent = useRef(false);

  // Merged display state: local optimistic + server authoritative
  const showHolding = isHolding || (localHolding && !hasReleased);
  const showIdle = !myHold && !localHolding;
  const showReleased = hasReleased;

  // Timer: runs while holding (local or server-confirmed)
  useEffect(() => {
    if (!showHolding) return;
    const start = myHold?.holdStart ?? localHoldStart.current;
    if (!start) return;
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 33); // ~30fps
    return () => clearInterval(id);
  }, [showHolding, myHold?.holdStart]);

  const handlePointerDown = useCallback(() => {
    if (touchSent.current || myHold) return;
    touchSent.current = true;
    localHoldStart.current = Date.now();
    setLocalHolding(true);
    engine.sendGameAction('GAME.TOUCH_SCREEN.TOUCH');
  }, [myHold, engine]);

  const handlePointerUp = useCallback(() => {
    if (releaseSent.current || showIdle) return;
    releaseSent.current = true;
    setLocalHolding(false);
    engine.sendGameAction('GAME.TOUCH_SCREEN.RELEASE');
  }, [showIdle, engine]);

  // Other players (live mode only)
  const allPlayers = Object.entries(holdStates);
  const stillHolding = allPlayers.filter(([, hs]) => hs.holdEnd === null);

  return (
    <div className="p-4 space-y-4">
      {/* Timer (visible once holding) */}
      {!showIdle && (
        <div className="text-center">
          <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">Hold Time</p>
          <p className="text-3xl font-bold font-mono text-skin-gold tabular-nums">
            {showReleased
              ? formatDuration(myHold?.duration ?? 0)
              : formatDuration(elapsed)}
          </p>
        </div>
      )}

      {/* Idle: "Touch & Hold" prompt */}
      {showIdle && (
        <div className="text-center space-y-3">
          <p className="text-xs font-mono text-skin-dim uppercase tracking-widest">Press and hold!</p>
          <button
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="w-full py-12 rounded-xl bg-skin-gold/10 border-2 border-skin-gold/30 text-skin-gold font-bold font-mono text-lg uppercase tracking-wider hover:bg-skin-gold/20 hover:border-skin-gold/50 transition-all select-none touch-none"
          >
            Touch &amp; Hold
          </button>
        </div>
      )}

      {/* Holding: pulsing hold area */}
      {showHolding && (
        <button
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          className="w-full py-12 rounded-xl bg-skin-gold/10 border-2 border-skin-gold/40 text-skin-gold font-bold font-mono text-lg uppercase tracking-wider animate-pulse select-none touch-none active:bg-skin-gold/20 transition-colors"
        >
          Holding...
        </button>
      )}

      {/* Released */}
      {showReleased && (
        <div className="w-full py-8 rounded-xl bg-white/[0.02] border-2 border-white/[0.06] text-center">
          <p className="text-sm font-mono text-skin-dim">Released</p>
          <p className="text-lg font-bold font-mono text-skin-gold">{formatDuration(myHold?.duration ?? 0)}</p>
        </div>
      )}

      {/* Player pips (live mode only) */}
      {!isSolo && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-skin-dim/60 uppercase tracking-widest">
            Still holding: {stillHolding.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {allPlayers.map(([pid, hs]) => {
              const name = roster[pid]?.personaName ?? pid;
              const holding = hs.holdEnd === null;
              return (
                <div
                  key={pid}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-opacity ${
                    holding
                      ? 'bg-skin-gold/10 border-skin-gold/30 text-skin-gold'
                      : 'bg-white/[0.02] border-white/[0.06] text-skin-dim/40 opacity-50'
                  } ${pid === playerId ? 'ring-1 ring-skin-gold/30' : ''}`}
                >
                  {name.slice(0, 10)}
                  {!holding && hs.duration > 0 && (
                    <span className="ml-1 text-[10px] text-skin-dim/40">{formatDuration(hs.duration)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Rankings breakdown for CelebrationSequence ---

function RankingsBreakdown({
  rankings,
  roster,
  playerId,
  silverRewards,
  isSolo,
}: {
  rankings: Array<{ playerId: string; duration: number }>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
  silverRewards: Record<string, number>;
  isSolo: boolean;
}) {
  if (rankings.length === 0) return null;

  // Solo: just show the player's hold duration
  if (isSolo) {
    const myRanking = rankings.find((r) => r.playerId === playerId);
    if (!myRanking) return null;
    return (
      <div className="text-center">
        <p className="text-2xl font-bold font-mono text-skin-gold tabular-nums">
          {formatDuration(myRanking.duration)}
        </p>
      </div>
    );
  }

  // Live: full rankings table
  return (
    <div className="space-y-1.5 w-full">
      {rankings.map((entry, idx) => {
        const pid = entry.playerId;
        const name = roster[pid]?.personaName ?? pid;
        const silver = silverRewards[pid] ?? 0;
        const isMe = pid === playerId;
        const isWinner = idx === 0;

        return (
          <div
            key={pid}
            className={`flex items-center justify-between p-2.5 rounded-lg border text-sm font-mono ${
              isWinner
                ? 'bg-skin-gold/10 border-skin-gold/30'
                : 'bg-white/[0.02] border-white/[0.06]'
            } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs w-5 text-center ${isWinner ? 'text-skin-gold font-bold' : 'text-skin-dim/60'}`}>
                #{idx + 1}
              </span>
              <span className={`${isWinner ? 'text-skin-gold font-bold' : 'text-skin-base'}`}>
                {name.slice(0, 14)}
              </span>
              <span className="text-[10px] text-skin-dim/40 tabular-nums">
                {formatDuration(entry.duration)}
              </span>
            </div>
            <span className="font-bold text-skin-green">+{silver}</span>
          </div>
        );
      })}
    </div>
  );
}
