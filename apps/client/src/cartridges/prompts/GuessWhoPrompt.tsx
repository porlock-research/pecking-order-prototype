import React, { useState } from 'react';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { HelpCircle } from 'lucide-react';

interface GuessWhoCartridge {
  promptType: 'GUESS_WHO';
  promptText: string;
  phase: 'ANSWERING' | 'GUESSING' | 'RESULTS';
  eligibleVoters: string[];
  // answers is stripped from SYNC during ANSWERING/GUESSING (security)
  anonymousAnswers: { index: number; text: string }[];
  guesses: Record<string, Record<number, string>>;
  results: {
    anonymousAnswers: { index: number; text: string }[];
    indexToAuthor: Record<number, string>;
    correctGuesses: Record<string, number>;
    fooledCounts: Record<string, number>;
    silverRewards: Record<string, number>;
  } | null;
}

interface GuessWhoPromptProps {
  cartridge: GuessWhoCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function GuessWhoPrompt({ cartridge, playerId, roster, engine }: GuessWhoPromptProps) {
  const { promptText, phase, eligibleVoters, anonymousAnswers, guesses, results } = cartridge;
  const totalEligible = eligibleVoters.length;

  const [answerText, setAnswerText] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [guessMap, setGuessMap] = useState<Record<number, string>>({});
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const hasGuessed = playerId in guesses;

  const name = (id: string) => roster[id]?.personaName || id;

  const handleSubmitAnswer = () => {
    if (answerSubmitted || !answerText.trim()) return;
    setAnswerSubmitted(true);
    engine.sendActivityAction(ActivityEvents.GUESSWHO.ANSWER, { text: answerText.trim() });
  };

  const handleGuessChange = (answerIndex: number, guessedPlayerId: string) => {
    setGuessMap(prev => ({ ...prev, [answerIndex]: guessedPlayerId }));
  };

  const handleSubmitGuesses = () => {
    if (guessSubmitted || hasGuessed) return;
    setGuessSubmitted(true);
    engine.sendActivityAction(ActivityEvents.GUESSWHO.GUESS, { guesses: guessMap });
  };

  const allGuessed = anonymousAnswers.every(a => guessMap[a.index]);

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Guess Who
          </span>
          <span className="text-xs font-mono text-skin-dim">
            {phase === PromptPhases.ANSWERING ? 'Answer the prompt' : phase === PromptPhases.GUESSING ? `${Object.keys(guesses).length}/${totalEligible} guessed` : 'Results'}
          </span>
        </div>
        {phase === PromptPhases.ANSWERING && answerSubmitted && (
          <span className="text-[10px] font-mono text-skin-green uppercase tracking-wider">Submitted</span>
        )}
        {phase === PromptPhases.GUESSING && (hasGuessed || guessSubmitted) && (
          <span className="text-[10px] font-mono text-skin-green uppercase tracking-wider">Guessed</span>
        )}
      </div>

      {/* Answering Phase */}
      {phase === PromptPhases.ANSWERING && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-skin-pink/10 border border-skin-pink/20 flex items-center justify-center shrink-0">
              <HelpCircle size={14} className="text-skin-pink" />
            </div>
            <p className="text-sm font-bold text-skin-base leading-relaxed pt-1">
              {promptText}
            </p>
          </div>

          {!answerSubmitted ? (
            <div className="space-y-3">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value.slice(0, 280))}
                placeholder="Write your answer..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-skin-base placeholder:text-skin-dim/40 focus:outline-none focus:border-skin-pink/30 resize-none"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-skin-dim/40">{answerText.length}/280</span>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answerText.trim()}
                  className="px-4 py-2 rounded-lg bg-skin-pink/20 border border-skin-pink/30 text-skin-pink text-xs font-bold uppercase tracking-wider hover:bg-skin-pink/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">Answer submitted anonymously</p>
              <p className="text-xs text-skin-dim mt-1 font-mono">Waiting for others...</p>
            </div>
          )}
        </div>
      )}

      {/* Guessing Phase */}
      {phase === PromptPhases.GUESSING && (
        <div className="p-4 space-y-4">
          <p className="text-sm font-bold text-skin-base text-center">Who wrote each answer?</p>

          {!(hasGuessed || guessSubmitted) ? (
            <>
              <div className="space-y-3">
                {anonymousAnswers.map((a) => (
                  <div key={a.index} className="px-4 py-3 rounded-lg border bg-white/[0.03] border-white/[0.06] space-y-2">
                    <p className="text-sm text-skin-base italic">"{a.text}"</p>
                    <select
                      value={guessMap[a.index] || ''}
                      onChange={(e) => handleGuessChange(a.index, e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-skin-base font-mono focus:outline-none focus:border-skin-pink/30"
                    >
                      <option value="">Who wrote this?</option>
                      {eligibleVoters.map(pid => (
                        <option key={pid} value={pid}>{name(pid)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSubmitGuesses}
                disabled={!allGuessed}
                className="w-full px-4 py-3 rounded-lg bg-skin-pink/20 border border-skin-pink/30 text-skin-pink text-xs font-bold uppercase tracking-wider hover:bg-skin-pink/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Submit Guesses
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">Guesses submitted</p>
              <p className="text-xs text-skin-dim mt-1 font-mono">Waiting for others...</p>
            </div>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === PromptPhases.RESULTS && results && (
        <div className="p-4 space-y-4 animate-fade-in">
          <p className="text-center text-sm font-bold text-skin-pink uppercase tracking-wider font-display">
            Results
          </p>

          {/* Answer Reveal */}
          <div className="space-y-1.5">
            <p className="text-xs text-skin-dim uppercase tracking-wider font-mono">Who Wrote What</p>
            {results.anonymousAnswers.map((a) => {
              const authorId = results.indexToAuthor[a.index];
              return (
                <div key={a.index} className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-white/[0.02] border-white/[0.04] text-xs">
                  <span className="text-skin-base flex-1 italic">"{a.text}"</span>
                  <span className={`shrink-0 font-mono ${authorId === playerId ? 'text-skin-pink font-bold' : 'text-skin-dim'}`}>
                    {authorId ? name(authorId) : '?'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center py-2 rounded-lg bg-skin-green/5 border border-skin-green/10">
              <p className="text-xs text-skin-dim uppercase tracking-wider mb-1">Your Correct Guesses</p>
              <p className="text-lg font-bold font-mono text-skin-green">
                {results.correctGuesses[playerId] ?? 0}
              </p>
            </div>
            <div className="text-center py-2 rounded-lg bg-skin-pink/5 border border-skin-pink/10">
              <p className="text-xs text-skin-dim uppercase tracking-wider mb-1">Players You Fooled</p>
              <p className="text-lg font-bold font-mono text-skin-pink">
                {results.fooledCounts[playerId] ?? 0}
              </p>
            </div>
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
