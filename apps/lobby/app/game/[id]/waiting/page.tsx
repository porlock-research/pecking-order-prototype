'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getGameSessionStatus, startGame } from '../../../actions';
import type { GameSlot } from '../../../actions';

export default function WaitingRoom() {
  const params = useParams();
  const code = params.id as string; // invite code from URL

  const [status, setStatus] = useState<string>('LOADING');
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [clientHost, setClientHost] = useState('http://localhost:5173');

  useEffect(() => {
    async function load() {
      try {
        const result = await getGameSessionStatus(code);
        setStatus(result.status);
        setSlots(result.slots);
        if (result.tokens) setTokens(result.tokens);
        if (result.clientHost) setClientHost(result.clientHost);
      } catch {
        setError('Failed to fetch game status');
      }
    }
    load();
  }, [code]);

  async function handleStart() {
    setIsStarting(true);
    setError(null);

    const result = await startGame(code);
    setIsStarting(false);

    if (result.success) {
      if (result.tokens) setTokens(result.tokens);
      setStatus('STARTED');
    } else {
      setError(result.error || 'Failed to start game');
    }
  }

  const filledSlots = slots.filter(s => s.acceptedBy);
  const totalSlots = slots.length;
  const isReady = status === 'READY';
  const isStarted = status === 'STARTED';

  // If game started and we have a token, show the enter link
  const myPlayerId = tokens ? Object.keys(tokens)[0] : null;
  const myToken = tokens ? Object.values(tokens)[0] : null;

  // Build the client entry URL — use /game/CODE?_t=JWT for clean URLs
  const clientEntryUrl = myToken
    ? `${clientHost}/game/${code}?_t=${myToken}`
    : null;

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base relative selection:bg-skin-gold/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 space-y-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow">
            WAITING ROOM
          </h1>
          <p className="text-xs font-mono text-skin-dim/60">
            Game: {code.toUpperCase()}
          </p>
        </header>

        {/* Status Badge */}
        <div className="flex justify-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono font-bold uppercase tracking-widest
            ${isStarted ? 'bg-skin-green/10 border-skin-green/30 text-skin-green'
              : isReady ? 'bg-skin-gold/10 border-skin-gold/30 text-skin-gold'
              : 'bg-skin-input border-skin-base text-skin-dim'}`}
          >
            <span className={`w-2 h-2 rounded-full ${isStarted ? 'bg-skin-green' : isReady ? 'bg-skin-gold' : 'bg-skin-dim/40'} ${!isStarted ? 'animate-pulse' : ''}`}></span>
            {isStarted ? 'Game Started' : isReady ? 'Ready to Launch' : `Waiting for Players (${filledSlots.length}/${totalSlots})`}
          </div>
        </div>

        {/* Player List */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base rounded-2xl p-6 space-y-4">
          <div className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest">The Cast</div>

          <div className="space-y-2">
            {slots.map(slot => (
              <div
                key={slot.slotIndex}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                  ${slot.acceptedBy
                    ? 'bg-skin-input/60 border-skin-base'
                    : 'bg-skin-input/10 border-dashed border-skin-base/20'
                  }`}
              >
                <div className="w-10 h-10 rounded-lg bg-skin-deep/60 overflow-hidden flex items-center justify-center">
                  {slot.personaImageUrl ? (
                    <img
                      src={slot.personaImageUrl}
                      alt={slot.personaName || ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl text-skin-dim/30">?</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {slot.acceptedBy ? (
                    <>
                      <div className="text-sm font-bold text-skin-base truncate">{slot.personaName}</div>
                      <div className="text-[10px] text-skin-dim/50 font-mono">{slot.displayName}</div>
                    </>
                  ) : (
                    <div className="text-sm text-skin-dim/30 font-mono">Slot {slot.slotIndex} — Waiting...</div>
                  )}
                </div>
                <div className="text-xs font-mono text-skin-dim/40">
                  {slot.acceptedBy ? 'Ready' : '...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {error && (
          <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
            {error}
          </div>
        )}

        {isReady && !isStarted && (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className={`w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
              ${isStarting
                ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
              }`}
          >
            {isStarting ? (
              <>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
              </>
            ) : (
              <>Launch Game</>
            )}
          </button>
        )}

        {isStarted && clientEntryUrl && (
          <a
            href={clientEntryUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full py-5 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg bg-skin-green/20 text-skin-green border border-skin-green/40 hover:bg-skin-green/30 transition-all"
          >
            Enter Game as {myPlayerId?.toUpperCase()}
            <span className="block text-xs font-mono mt-1 opacity-60">{clientHost}/game/{code.toUpperCase()}</span>
          </a>
        )}

        {!isStarted && !isReady && (
          <div className="text-center">
            <p className="text-xs text-skin-dim/40 font-mono">
              Share the code with your players and refresh when ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
