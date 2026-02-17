import React, { useState } from 'react';
import { PromptPhases, ActivityEvents, Config, type SocialPlayer } from '@pecking-order/shared-types';
import { PenLine } from 'lucide-react';

interface ConfessionCartridge {
  promptType: 'CONFESSION';
  promptText: string;
  phase: 'COLLECTING' | 'VOTING' | 'RESULTS';
  eligibleVoters: string[];
  // confessions is stripped from SYNC during COLLECTING/VOTING (security)
  anonymousConfessions: { index: number; text: string }[];
  votes: Record<string, number>;
  results: {
    anonymousConfessions: { index: number; text: string }[];
    voteCounts: Record<number, number>;
    winnerIndex: number | null;
    winnerId: string | null;
    winnerText: string | null;
    indexToAuthor: Record<number, string>;
    silverRewards: Record<string, number>;
  } | null;
}

interface ConfessionPromptProps {
  cartridge: ConfessionCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function ConfessionPrompt({ cartridge, playerId, roster, engine }: ConfessionPromptProps) {
  const { promptText, phase, eligibleVoters, anonymousConfessions, votes, results } = cartridge;
  const respondedCount = phase === PromptPhases.COLLECTING
    ? eligibleVoters.filter(id => {
        // We can't see confessions map (stripped), but we know if we submitted
        // Track our own submission via local state
        return false; // Server doesn't expose this during collecting
      }).length
    : anonymousConfessions.length;
  const totalEligible = eligibleVoters.length;

  const [confessionText, setConfessionText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [votedIndex, setVotedIndex] = useState<number | null>(null);
  const hasVoted = playerId in votes;

  const name = (id: string) => roster[id]?.personaName || id;

  const handleSubmitConfession = () => {
    if (submitted || !confessionText.trim()) return;
    setSubmitted(true);
    engine.sendActivityAction(ActivityEvents.CONFESSION.SUBMIT, { text: confessionText.trim() });
  };

  const handleVote = (confessionIndex: number) => {
    if (hasVoted || votedIndex !== null) return;
    setVotedIndex(confessionIndex);
    engine.sendActivityAction(ActivityEvents.CONFESSION.VOTE, { confessionIndex });
  };

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Confession
          </span>
          <span className="text-xs font-mono text-skin-dim">
            {phase === PromptPhases.COLLECTING ? 'Write your confession' : phase === PromptPhases.VOTING ? `${Object.keys(votes).length}/${totalEligible} voted` : 'Results'}
          </span>
        </div>
        {phase === PromptPhases.COLLECTING && submitted && (
          <span className="text-[10px] font-mono text-skin-green uppercase tracking-wider">Submitted</span>
        )}
        {phase === PromptPhases.VOTING && (hasVoted || votedIndex !== null) && (
          <span className="text-[10px] font-mono text-skin-green uppercase tracking-wider">Voted</span>
        )}
      </div>

      {/* Collecting Phase */}
      {phase === PromptPhases.COLLECTING && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-skin-pink/10 border border-skin-pink/20 flex items-center justify-center shrink-0">
              <PenLine size={14} className="text-skin-pink" />
            </div>
            <p className="text-sm font-bold text-skin-base leading-relaxed pt-1">
              {promptText}
            </p>
          </div>

          {!submitted ? (
            <div className="space-y-3">
              <textarea
                value={confessionText}
                onChange={(e) => setConfessionText(e.target.value.slice(0, Config.chat.maxMessageLength))}
                placeholder="Write your anonymous confession..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-skin-base placeholder:text-skin-dim/40 focus:outline-none focus:border-skin-pink/30 resize-none"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-skin-dim/40">{confessionText.length}/{Config.chat.maxMessageLength}</span>
                <button
                  onClick={handleSubmitConfession}
                  disabled={!confessionText.trim()}
                  className="px-4 py-2 rounded-lg bg-skin-pink/20 border border-skin-pink/30 text-skin-pink text-xs font-bold uppercase tracking-wider hover:bg-skin-pink/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">Confession submitted anonymously</p>
              <p className="text-xs text-skin-dim mt-1 font-mono">Waiting for others...</p>
            </div>
          )}
        </div>
      )}

      {/* Voting Phase */}
      {phase === PromptPhases.VOTING && (
        <div className="p-4 space-y-4">
          <p className="text-sm font-bold text-skin-base text-center">Vote for the best confession</p>
          <div className="space-y-2">
            {anonymousConfessions.map((c) => {
              const isVoted = votedIndex === c.index || (hasVoted && votes[playerId] === c.index);
              return (
                <button
                  key={c.index}
                  onClick={() => handleVote(c.index)}
                  disabled={hasVoted || votedIndex !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm
                    ${isVoted
                      ? 'bg-skin-pink/20 border-skin-pink/50 text-skin-pink'
                      : 'bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]'
                    }
                    ${(hasVoted || votedIndex !== null) && !isVoted ? 'opacity-50' : ''}`}
                >
                  <span className="text-skin-pink font-mono text-xs mr-2">#{c.index + 1}</span>
                  "{c.text}"
                </button>
              );
            })}
          </div>
          {(hasVoted || votedIndex !== null) && (
            <p className="text-center text-xs text-skin-dim font-mono">Waiting for others...</p>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === PromptPhases.RESULTS && results && (
        <div className="p-4 space-y-4 animate-fade-in">
          <p className="text-center text-sm font-bold text-skin-pink uppercase tracking-wider font-display">
            Results
          </p>

          {results.winnerText && (
            <div className="text-center py-3 rounded-lg bg-skin-pink/5 border border-skin-pink/10">
              <p className="text-xs text-skin-dim uppercase tracking-wider mb-1">Best Confession</p>
              <p className="text-sm font-bold text-skin-base italic px-4">
                "{results.winnerText}"
              </p>
              {results.winnerId && (
                <p className="text-xs text-skin-pink mt-2">
                  — {name(results.winnerId)} (+15 silver)
                </p>
              )}
            </div>
          )}

          {/* Author Reveal */}
          <div className="space-y-1.5">
            <p className="text-xs text-skin-dim uppercase tracking-wider font-mono">Author Reveal</p>
            {results.anonymousConfessions.map((c) => {
              const authorId = results.indexToAuthor[c.index];
              const isWinner = c.index === results.winnerIndex;
              return (
                <div key={c.index} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${isWinner ? 'bg-skin-pink/10 border-skin-pink/30' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                  <span className="text-skin-dim shrink-0">#{c.index + 1}</span>
                  <span className="text-skin-base flex-1 italic">"{c.text}"</span>
                  <span className={`shrink-0 font-mono ${authorId === playerId ? 'text-skin-pink font-bold' : 'text-skin-dim'}`}>
                    {authorId ? name(authorId) : '?'}
                  </span>
                </div>
              );
            })}
          </div>

          {results.silverRewards[playerId] != null && (
            <div className="text-center py-2">
              <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">You Earned</p>
              <p className="text-2xl font-bold font-mono text-skin-gold text-glow">
                +{results.silverRewards[playerId]} silver
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
