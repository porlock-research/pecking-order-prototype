import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Events } from '@pecking-order/shared-types';
import type { LiveGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import LiveGameWrapper from '../wrappers/LiveGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';

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
      startEvent={Events.Game.start('TOUCH_SCREEN')}
      readyEvent={Events.Game.event('TOUCH_SCREEN', 'READY')}
      renderGame={() => (
        <ActiveGame
          cartridge={cartridge}
          playerId={playerId}
          roster={roster}
          engine={engine}
          isSolo={isSolo}
        />
      )}
      renderHero={() => {
        const myRanking = rankings.find((r) => r.playerId === playerId);
        return <TouchScreenHero myDuration={myRanking?.duration ?? 0} totalRanked={rankings.length} />;
      }}
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
    engine.sendGameAction(Events.Game.event('TOUCH_SCREEN', 'TOUCH'));
  }, [myHold, engine]);

  const handlePointerUp = useCallback(() => {
    if (releaseSent.current || showIdle) return;
    releaseSent.current = true;
    setLocalHolding(false);
    engine.sendGameAction(Events.Game.event('TOUCH_SCREEN', 'RELEASE'));
  }, [showIdle, engine]);

  // Other players (live mode only)
  const allPlayers = Object.entries(holdStates);
  const stillHolding = allPlayers.filter(([, hs]) => hs.holdEnd === null);

  return (
    <div className="p-4 space-y-4">
      {/* Timer (visible once holding) */}
      {!showIdle && (
        <div className="text-center">
          <p className="text-xs  text-skin-dim uppercase tracking-widest mb-1">Hold Time</p>
          <p className="text-3xl font-bold  text-skin-gold tabular-nums">
            {showReleased
              ? formatDuration(myHold?.duration ?? 0)
              : formatDuration(elapsed)}
          </p>
        </div>
      )}

      {/* Idle: "Touch & Hold" prompt */}
      {showIdle && (
        <div className="text-center space-y-3">
          <p className="text-xs  text-skin-dim uppercase tracking-widest">Press and hold!</p>
          <button
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="w-full py-12 rounded-xl bg-skin-gold/10 border-2 border-skin-gold/30 text-skin-gold font-bold  text-lg uppercase tracking-wider hover:bg-skin-gold/20 hover:border-skin-gold/50 transition-all select-none touch-none"
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
          className="w-full py-12 rounded-xl bg-skin-gold/10 border-2 border-skin-gold/40 text-skin-gold font-bold  text-lg uppercase tracking-wider animate-pulse select-none touch-none active:bg-skin-gold/20 transition-colors"
        >
          Holding...
        </button>
      )}

      {/* Released */}
      {showReleased && (
        <div className="w-full py-8 rounded-xl bg-white/[0.02] border-2 border-white/[0.06] text-center">
          <p className="text-sm  text-skin-dim">Released</p>
          <p className="text-lg font-bold  text-skin-gold">{formatDuration(myHold?.duration ?? 0)}</p>
        </div>
      )}

      {/* Player pips (live mode only) */}
      {!isSolo && (
        <div className="space-y-1.5">
          <p className="text-[10px]  text-skin-dim/60 uppercase tracking-widest">
            Still holding: {stillHolding.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {allPlayers.map(([pid, hs]) => {
              const name = roster[pid]?.personaName ?? pid;
              const holding = hs.holdEnd === null;
              return (
                <div
                  key={pid}
                  className={`px-2.5 py-1 rounded-lg text-xs  border transition-opacity ${
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
        <p className="text-2xl font-bold  text-skin-gold tabular-nums">
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
            className={`flex items-center justify-between p-2.5 rounded-lg border text-sm  ${
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

/**
 * Bespoke peak frame for Touch Screen — a single fingertip glyph
 * on a glass surface, with a pulse ring showing the player's hold
 * duration. Reads as the moment of contact frozen in time.
 */
function TouchScreenHero({ myDuration, totalRanked }: { myDuration: number; totalRanked: number }) {
  const accent = 'var(--po-pink)';
  const seconds = myDuration / 1000;
  // Ring radius scales with seconds held (cap at 52)
  const ringR = Math.min(52, 20 + Math.log(Math.max(1, seconds)) * 14);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.5}>
        <svg width={140} height={140} viewBox="-70 -70 140 140" aria-hidden>
          {/* Outer duration ring */}
          <circle
            cx={0} cy={0} r={ringR}
            fill="none"
            stroke={accent}
            strokeWidth={2}
            opacity={0.7}
            strokeDasharray={`${ringR * 2 * Math.PI * 0.82} ${ringR * 2 * Math.PI}`}
            transform="rotate(-90)"
          />
          {/* Inner ring (solid) */}
          <circle
            cx={0} cy={0} r={ringR * 0.7}
            fill={`color-mix(in oklch, ${accent} 14%, transparent)`}
            stroke={`color-mix(in oklch, ${accent} 40%, transparent)`}
            strokeWidth={1}
          />
          {/* Fingertip — simple rounded shape */}
          <g transform="translate(0, 4)">
            <ellipse cx={0} cy={0} rx={14} ry={18}
                     fill="color-mix(in oklch, var(--po-pink) 85%, white)"
                     stroke={accent}
                     strokeWidth={1.5} />
            {/* Fingernail */}
            <ellipse cx={0} cy={-8} rx={7} ry={5}
                     fill="color-mix(in oklch, var(--po-pink) 40%, white)" opacity={0.8} />
            {/* Contact highlight */}
            <ellipse cx={0} cy={-2} rx={4} ry={2}
                     fill="color-mix(in oklch, var(--po-pink) 20%, white)" opacity={0.6} />
          </g>
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat
          value={seconds.toFixed(seconds < 60 ? 2 : 0)}
          label="held"
          accent={accent}
          suffix={seconds < 60 ? 's' : 's'}
        />
        {totalRanked > 1 && (
          <HeroStat value={totalRanked} label="players" accent={accent} />
        )}
      </HeroStatRow>
    </div>
  );
}
