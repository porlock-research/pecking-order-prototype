'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getInviteInfo, getRandomPersonas, acceptInvite } from '../../actions';
import type { GameInfo, Persona } from '../../actions';

type PersonaWithImage = Persona & { imageUrl: string };

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  // Game state
  const [game, setGame] = useState<GameInfo | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [personas, setPersonas] = useState<PersonaWithImage[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<PersonaWithImage | null>(null);
  const [customBio, setCustomBio] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadInviteInfo();
  }, [code]);

  async function loadInviteInfo() {
    setIsLoading(true);
    const result = await getInviteInfo(code);
    setIsLoading(false);

    if (result.success && result.game) {
      setGame(result.game);
      setAlreadyJoined(result.alreadyJoined ?? false);
      // Auto-draw personas if not already joined
      if (!result.alreadyJoined && result.game.status === 'RECRUITING') {
        drawPersonas();
      }
    } else {
      setError(result.error || 'Failed to load game');
    }
  }

  async function drawPersonas() {
    setIsDrawing(true);
    const result = await getRandomPersonas(code);
    setIsDrawing(false);

    if (result.success && result.personas) {
      setPersonas(result.personas);
      setSelectedPersona(null);
      setStep(1);
    } else {
      setError(result.error || 'Failed to draw characters');
    }
  }

  async function handleJoin() {
    if (!selectedPersona || !customBio.trim()) return;
    setIsJoining(true);
    setError(null);

    const result = await acceptInvite(code, selectedPersona.id, customBio.trim());
    setIsJoining(false);

    if (result.success) {
      router.push(`/game/${code}/waiting`);
    } else {
      // If persona was taken, redraw
      if (result.error?.includes('already been picked')) {
        setError('That character was just taken! Drawing new characters...');
        setSelectedPersona(null);
        setCustomBio('');
        await drawPersonas();
      } else {
        setError(result.error || 'Failed to join');
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-skin-deep bg-grid-pattern flex items-center justify-center font-body text-skin-base">
        <div className="text-skin-dim font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-display font-black text-skin-gold text-glow">PECKING ORDER</h1>
          <div className="bg-skin-panel/30 border border-skin-base rounded-2xl p-8 space-y-4">
            <div className="text-skin-pink font-display font-bold text-sm uppercase tracking-widest">
              Invalid Invite
            </div>
            <p className="text-skin-dim text-sm">{error}</p>
            <a href="/" className="block py-3 text-center bg-skin-pink text-skin-base rounded-xl font-display font-bold text-sm uppercase hover:brightness-110 transition-all">
              Back to Lobby
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const filledSlots = game.slots.filter(s => s.acceptedBy);
  const emptySlots = game.playerCount - filledSlots.length;

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center p-4 py-12 font-body text-skin-base relative selection:bg-skin-gold/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10 space-y-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow">
            PECKING ORDER
          </h1>
          <p className="text-sm text-skin-dim font-mono">
            Invite Code: <span className="text-skin-gold font-bold tracking-wider">{code}</span>
          </p>
        </header>

        {/* Game Info Bar */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-skin-base">
              {game.mode.replace(/_/g, ' ')} &middot; {game.dayCount} days &middot; {game.playerCount} players
            </div>
            <div className="text-xs font-mono text-skin-dim/60">
              {filledSlots.length}/{game.playerCount} joined
            </div>
          </div>
        </div>

        {/* Already Joined */}
        {alreadyJoined && (
          <div className="bg-skin-green/10 border border-skin-green/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
              You've Already Joined
            </div>
            <a
              href={`/game/${code}/waiting`}
              className="inline-block py-3 px-6 bg-skin-green/20 text-skin-green border border-skin-green/40 rounded-xl font-display font-bold text-sm uppercase hover:bg-skin-green/30 transition-all"
            >
              Go to Waiting Room
            </a>
          </div>
        )}

        {/* Character Select Wizard */}
        {!alreadyJoined && game.status === 'RECRUITING' && (
          <>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${step === s
                      ? 'bg-skin-gold text-skin-deep'
                      : step > s
                        ? 'bg-skin-gold/30 text-skin-gold'
                        : 'bg-skin-input text-skin-dim/40'
                    }`}
                  >
                    {step > s ? '\u2713' : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-8 h-px ${step > s ? 'bg-skin-gold/30' : 'bg-skin-input'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1 — Card Draw */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                    Choose Your Character
                  </div>
                  <p className="text-xs text-skin-dim/60 mt-1">Fate has dealt you three options</p>
                </div>

                {isDrawing ? (
                  <div className="text-center py-12">
                    <div className="text-skin-dim font-mono text-sm animate-pulse">Drawing characters...</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {personas.map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() => setSelectedPersona(persona)}
                        className={`flex flex-col rounded-2xl border overflow-hidden transition-all text-left
                          ${selectedPersona?.id === persona.id
                            ? 'border-skin-gold/60 ring-2 ring-skin-gold/30 scale-[1.02]'
                            : 'border-skin-base hover:border-skin-dim/40'
                          }`}
                      >
                        {/* Portrait */}
                        <div className="aspect-[3/4] bg-skin-input/30 relative overflow-hidden">
                          <img
                            src={persona.imageUrl}
                            alt={persona.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              el.style.display = 'none';
                            }}
                          />
                          {selectedPersona?.id === persona.id && (
                            <div className="absolute inset-0 bg-skin-gold/10 border-2 border-skin-gold/40 rounded-t-2xl" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-4 space-y-1 bg-skin-panel/30">
                          <div className="text-sm font-bold text-skin-base">{persona.name}</div>
                          <div className="text-xs text-skin-gold font-display uppercase tracking-wider">{persona.stereotype}</div>
                          <div className="text-xs text-skin-dim/70 leading-relaxed">{persona.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => { setError(null); setStep(2); }}
                  disabled={!selectedPersona}
                  className={`w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                    ${!selectedPersona
                      ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                      : 'bg-skin-gold text-skin-deep shadow-btn hover:brightness-110 active:scale-[0.99]'
                    }`}
                >
                  {selectedPersona ? 'Choose This Character' : 'Select a Character'}
                </button>
              </div>
            )}

            {/* Step 2 — Bio Authoring */}
            {step === 2 && selectedPersona && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                    Write Your Catfish Bio
                  </div>
                  <p className="text-xs text-skin-dim/60 mt-1">This is what other players will see</p>
                </div>

                {/* Selected persona preview */}
                <div className="flex items-center gap-4 bg-skin-panel/30 border border-skin-base rounded-xl p-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-skin-input/30 flex-shrink-0">
                    <img
                      src={personaHeadshotUrl(selectedPersona.id)}
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-skin-base">{selectedPersona.name}</div>
                    <div className="text-xs text-skin-gold font-display uppercase tracking-wider">{selectedPersona.stereotype}</div>
                  </div>
                </div>

                {/* Bio textarea */}
                <div className="space-y-2">
                  <textarea
                    value={customBio}
                    onChange={(e) => setCustomBio(e.target.value.slice(0, 280))}
                    placeholder="Write your catfish bio... Who are you pretending to be?"
                    rows={4}
                    className="w-full px-4 py-3 bg-skin-input/60 border border-skin-base rounded-xl text-sm text-skin-base placeholder:text-skin-dim/40 focus:outline-none focus:ring-1 focus:ring-skin-gold/40 resize-none"
                  />
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-skin-dim/40">Max 280 characters</span>
                    <span className={customBio.length > 260 ? 'text-skin-pink' : 'text-skin-dim/40'}>
                      {customBio.length}/280
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!customBio.trim()}
                    className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                      ${!customBio.trim()
                        ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                        : 'bg-skin-gold text-skin-deep shadow-btn hover:brightness-110 active:scale-[0.99]'
                      }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Confirm & Join */}
            {step === 3 && selectedPersona && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                    Confirm Your Identity
                  </div>
                  <p className="text-xs text-skin-dim/60 mt-1">This is who you'll be in the game</p>
                </div>

                {/* Identity card */}
                <div className="bg-skin-panel/30 border border-skin-gold/30 rounded-2xl overflow-hidden">
                  <div className="aspect-[4/3] sm:aspect-[16/9] bg-skin-input/30 relative overflow-hidden">
                    <img
                      src={selectedPersona.imageUrl}
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-skin-deep/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="text-lg font-display font-black text-skin-base">{selectedPersona.name}</div>
                      <div className="text-xs text-skin-gold font-display uppercase tracking-wider">{selectedPersona.stereotype}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest mb-2">Your Bio</div>
                    <p className="text-sm text-skin-base leading-relaxed">{customBio}</p>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all"
                  >
                    Edit Bio
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={isJoining}
                    className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                      ${isJoining
                        ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                        : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                      }`}
                  >
                    {isJoining ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                      </>
                    ) : (
                      <>Join Game</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function personaHeadshotUrl(id: string): string {
  return `/api/persona-image/${id}/headshot.png`;
}
