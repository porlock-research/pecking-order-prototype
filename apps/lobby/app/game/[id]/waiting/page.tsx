'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getGameSessionStatus, startGame } from '../../../actions';
import type { GameSlot } from '../../../actions';

function personaFullUrl(id: string): string {
  return `/api/persona-image/${id}/full.png`;
}

function personaMediumUrl(id: string): string {
  return `/api/persona-image/${id}/medium.png`;
}

export default function WaitingRoom() {
  const params = useParams();
  const code = params.id as string;

  const [status, setStatus] = useState<string>('LOADING');
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [clientHost, setClientHost] = useState('http://localhost:5173');
  const [myPersonaId, setMyPersonaId] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await getGameSessionStatus(code);
        setStatus(result.status);
        setSlots(result.slots);
        if (result.tokens) setTokens(result.tokens);
        if (result.clientHost) setClientHost(result.clientHost);
        if (result.mode) setMode(result.mode);
        // Find the current user's persona for background
        if (result.myPersonaId) setMyPersonaId(result.myPersonaId);
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

  const filledSlots = slots.filter((s) => s.acceptedBy);
  const emptySlots = slots.filter((s) => !s.acceptedBy);
  const totalSlots = slots.length;
  const isReady = status === 'READY';
  const isStarted = status === 'STARTED';
  const isLoading = status === 'LOADING';

  const isConfigurableCycle = mode === 'CONFIGURABLE_CYCLE';
  const myPlayerId = tokens ? Object.keys(tokens)[0] : null;
  const myToken = tokens ? Object.values(tokens)[0] : null;
  const clientEntryUrl = myToken ? `${clientHost}/game/${code}?_t=${myToken}` : null;

  // Use first filled slot's persona as background fallback if myPersonaId not available
  const bgPersonaId = myPersonaId || filledSlots[0]?.personaId;

  return (
    <div className="h-screen h-dvh flex flex-col bg-skin-deep bg-grid-pattern font-body text-skin-base relative selection:bg-skin-gold/30 overflow-hidden">
      {/* Blurred persona background */}
      <AnimatePresence mode="popLayout">
        {bgPersonaId && (
          <motion.img
            key={bgPersonaId}
            src={personaFullUrl(bgPersonaId)}
            alt=""
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover object-top scale-110 pointer-events-none"
            style={{ filter: 'blur(2px)' }}
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-skin-deep/60 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10 max-w-lg w-full mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Header */}
        <header className="text-center space-y-0.5 flex-shrink-0">
          <h1 className="text-3xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow">
            PECKING ORDER
          </h1>
          <p className="text-sm text-skin-dim font-mono">
            Game: <span className="text-skin-gold font-bold tracking-wider">{code.toUpperCase()}</span>
          </p>
        </header>

        {/* Status badge */}
        <div className="flex justify-center mt-2 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm text-xs font-mono font-bold uppercase tracking-widest
              ${
                isStarted
                  ? 'text-skin-green'
                  : isReady
                    ? 'text-skin-gold'
                    : 'text-skin-dim'
              }`}
            style={{
              backgroundColor: 'rgba(44, 0, 62, 0.6)',
              border: `1px solid ${isStarted ? 'var(--po-green)' : isReady ? 'var(--po-gold)' : 'var(--po-border)'}`,
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isStarted ? 'bg-skin-green' : isReady ? 'bg-skin-gold' : 'bg-skin-dim'
              } ${!isStarted ? 'animate-pulse' : ''}`}
            />
            {isStarted
              ? 'Game Started'
              : isReady
                ? 'Ready to Launch'
                : isLoading
                  ? 'Loading...'
                  : `Waiting for Players (${filledSlots.length}/${totalSlots})`}
          </motion.div>
        </div>

        {/* Cast title */}
        <div className="text-center mt-2 flex-shrink-0">
          <div className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
            The Cast
          </div>
        </div>

        {/* Cast grid */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 pb-2">
          {isLoading ? (
            /* Skeleton grid */
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-skin-input/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 gap-3"
            >
              {/* Filled slots — cast portrait cards */}
              {filledSlots.map((slot, idx) => (
                <motion.div
                  key={slot.slotIndex}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                  className="aspect-[3/4] relative rounded-2xl overflow-hidden glow-breathe"
                >
                  {slot.personaId ? (
                    <img
                      src={personaMediumUrl(slot.personaId)}
                      alt={slot.personaName || ''}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-skin-input" />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-skin-deep via-skin-deep/40 via-30% to-transparent pointer-events-none" />
                  {/* Name + stereotype */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                    <div className="text-sm font-display font-black text-skin-base text-glow leading-tight truncate">
                      {slot.personaName}
                    </div>
                    <div className="text-[9px] font-display font-bold text-skin-gold uppercase tracking-[0.15em] truncate">
                      {slot.personaStereotype}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Empty slots — mysterious placeholders */}
              {emptySlots.map((slot) => (
                <motion.div
                  key={slot.slotIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: filledSlots.length * 0.08 + 0.1, duration: 0.3 }}
                  className="aspect-[3/4] relative rounded-2xl overflow-hidden border border-dashed flex items-center justify-center"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(44, 0, 62, 0.4)' }}
                >
                  <div className="text-center space-y-2">
                    <div className="text-4xl text-skin-dim/20 animate-pulse">?</div>
                    <div className="text-[10px] font-mono text-skin-dim/30 uppercase tracking-widest">TBD</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 relative z-20 bg-gradient-to-b from-skin-deep/0 to-skin-deep pt-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto">
          {error && (
            <div className="p-3 mb-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isReady && !isStarted && !isConfigurableCycle && (
              <motion.div
                key="launch"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className={`w-full py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                    ${
                      isStarting
                        ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                        : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                    }`}
                >
                  {isStarting ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150" />
                    </>
                  ) : (
                    <>Launch Game</>
                  )}
                </button>
              </motion.div>
            )}

            {(isStarted || (isConfigurableCycle && clientEntryUrl)) && clientEntryUrl && (
              <motion.div
                key="enter"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <a
                  href={clientEntryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full py-4 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', color: 'var(--po-green)' }}
                >
                  Enter Game as {myPlayerId?.toUpperCase()}
                  <span className="block text-xs font-mono mt-1 opacity-60">
                    {clientHost}/game/{code.toUpperCase()}
                  </span>
                </a>
              </motion.div>
            )}

            {!isStarted && !isReady && !isLoading && !isConfigurableCycle && (
              <motion.div
                key="share"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-center text-xs text-skin-dim font-mono">
                  Share the invite code and refresh when everyone has joined.
                </p>
              </motion.div>
            )}

            {isConfigurableCycle && !clientEntryUrl && !isLoading && (
              <motion.div
                key="cc-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-center text-xs text-skin-dim font-mono">
                  Share the invite code. You can enter the game while waiting for other players.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
