'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getInviteInfo, acceptInvite } from '../../actions';
import type { GameInfo, Persona } from '../../actions';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    loadInviteInfo();
  }, [code]);

  async function loadInviteInfo() {
    setIsLoading(true);
    const result = await getInviteInfo(code);
    setIsLoading(false);

    if (result.success && result.game) {
      setGame(result.game);
      setCurrentUserId(result.currentUserId ?? null);
      setAlreadyJoined(result.alreadyJoined ?? false);
    } else {
      setError(result.error || 'Failed to load game');
    }
  }

  async function handleJoin() {
    if (!selectedPersona) return;
    setIsJoining(true);
    setError(null);

    const result = await acceptInvite(code, selectedPersona);
    setIsJoining(false);

    if (result.success) {
      // Reload to show updated state
      await loadInviteInfo();
      // Redirect to waiting room
      if (game) {
        router.push(`/game/${code}/waiting`);
      }
    } else {
      setError(result.error || 'Failed to join');
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

        {/* Game Info */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">Game Info</div>
              <div className="text-sm font-mono text-skin-base mt-1">
                {game.mode.replace(/_/g, ' ')} &middot; {game.dayCount} days &middot; {game.playerCount} players
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-mono font-bold uppercase tracking-wider ${game.status === 'RECRUITING' ? 'text-skin-green' : 'text-skin-gold'}`}>
                {game.status}
              </div>
              <div className="text-xs font-mono text-skin-dim/60 mt-1">
                {filledSlots.length}/{game.playerCount} joined
              </div>
            </div>
          </div>

          {/* Joined Players */}
          {filledSlots.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest">Players</div>
              <div className="flex flex-wrap gap-2">
                {filledSlots.map(slot => (
                  <div key={slot.slotIndex} className="flex items-center gap-2 bg-skin-input/60 border border-skin-base rounded-lg px-3 py-2">
                    <span className="text-lg">{slot.personaAvatar}</span>
                    <div>
                      <div className="text-xs font-bold text-skin-base">{slot.personaName}</div>
                      <div className="text-[10px] text-skin-dim/50">{slot.displayName}</div>
                    </div>
                  </div>
                ))}
                {Array.from({ length: emptySlots }, (_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-2 bg-skin-input/20 border border-dashed border-skin-base/30 rounded-lg px-3 py-2">
                    <span className="text-lg opacity-20">?</span>
                    <div className="text-xs text-skin-dim/30">Waiting...</div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

        {/* Character Select */}
        {!alreadyJoined && game.status === 'RECRUITING' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                Choose Your Character
              </div>
              <p className="text-xs text-skin-dim/60 mt-1">Pick wisely — you can't change later</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {game.availablePersonas.map((persona: Persona) => (
                <button
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center
                    ${selectedPersona === persona.id
                      ? 'bg-skin-gold/10 border-skin-gold/60 ring-1 ring-skin-gold/30 scale-105'
                      : 'bg-skin-input/40 border-skin-base hover:border-skin-dim/40 hover:bg-skin-input/60'
                    }`}
                >
                  <span className="text-3xl">{persona.avatar}</span>
                  <span className="text-xs font-bold text-skin-base leading-tight">{persona.name}</span>
                  <span className="text-[10px] text-skin-dim/50 leading-tight">{persona.bio}</span>
                </button>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={!selectedPersona || isJoining}
              className={`w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                ${!selectedPersona || isJoining
                  ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                  : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                }`}
            >
              {isJoining ? (
                <>
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                </>
              ) : selectedPersona ? (
                <>Join Game</>
              ) : (
                <>Select a Character</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
