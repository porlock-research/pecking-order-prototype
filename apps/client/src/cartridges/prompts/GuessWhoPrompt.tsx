import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PromptPhases, ActivityEvents, Config, type SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { X } from 'lucide-react';
import {
  PROMPT_ACCENT,
  PromptShell,
  LockedInReceipt,
  SilverEarned,
  SectionLabel,
} from './PromptShell';

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

export default function GuessWhoPrompt({
  cartridge,
  playerId,
  roster,
  engine,
}: GuessWhoPromptProps) {
  const { promptText, phase, eligibleVoters, anonymousAnswers, guesses, results } = cartridge;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.GUESS_WHO;

  const [answerText, setAnswerText] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [guessMap, setGuessMap] = useState<Record<number, string>>({});
  const [activeAnswerIndex, setActiveAnswerIndex] = useState<number | null>(null);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const hasGuessed = playerId in guesses;
  const reduce = useReducedMotion();

  const name = (id: string) => roster[id]?.personaName || id;
  const firstName = (id: string) => name(id).split(' ')[0];

  const handleSubmitAnswer = () => {
    if (answerSubmitted || !answerText.trim()) return;
    setAnswerSubmitted(true);
    engine.sendActivityAction(ActivityEvents.GUESSWHO.ANSWER, { text: answerText.trim() });
  };

  const handleAssign = (answerIndex: number, pid: string) => {
    setGuessMap((prev) => {
      const next = { ...prev };
      // If this player was assigned to another answer, free that slot.
      for (const [k, v] of Object.entries(next)) {
        if (v === pid && Number(k) !== answerIndex) delete next[Number(k)];
      }
      next[answerIndex] = pid;
      return next;
    });
    setActiveAnswerIndex(null);
  };

  const handleClearAssignment = (answerIndex: number) => {
    setGuessMap((prev) => {
      const next = { ...prev };
      delete next[answerIndex];
      return next;
    });
  };

  const handleSubmitGuesses = () => {
    if (guessSubmitted || hasGuessed) return;
    setGuessSubmitted(true);
    engine.sendActivityAction(ActivityEvents.GUESSWHO.GUESS, { guesses: guessMap });
  };

  const allGuessed = anonymousAnswers.every((a) => guessMap[a.index]);

  const status = (() => {
    if (phase === PromptPhases.ANSWERING) return 'Write yours';
    if (phase === PromptPhases.GUESSING) {
      const g = Object.keys(guesses).length;
      return g === totalEligible ? 'All guessed' : `${g}/${totalEligible} guessed`;
    }
    return 'Results';
  })();

  const statusBadge =
    phase === PromptPhases.ANSWERING && answerSubmitted
      ? 'Submitted'
      : phase === PromptPhases.GUESSING && (hasGuessed || guessSubmitted)
        ? 'Guessed'
        : undefined;

  const helper =
    phase === PromptPhases.ANSWERING && !answerSubmitted
      ? 'Your answer stays anonymous during guessing.'
      : phase === PromptPhases.GUESSING && !(hasGuessed || guessSubmitted)
        ? 'Match each answer to a face. +5 silver per correct, +10 if you fool someone.'
        : undefined;

  return (
    <PromptShell
      type="GUESS_WHO"
      accentColor={accent}
      status={status}
      statusBadge={statusBadge}
      promptText={promptText}
      helper={helper}
      /* Strip hides during ANSWERING — server strips who's answered. */
      eligibleIds={phase === PromptPhases.GUESSING ? eligibleVoters : undefined}
      respondedIds={phase === PromptPhases.GUESSING ? Object.keys(guesses) : undefined}
      roster={roster}
    >
      {/* Answering */}
      {phase === PromptPhases.ANSWERING && !answerSubmitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value.slice(0, Config.chat.maxMessageLength))}
            placeholder="Write something only you would say…"
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
              border: `1.5px solid color-mix(in oklch, ${accent} 22%, transparent)`,
              color: 'var(--po-text)',
              fontFamily: 'var(--po-font-body)',
              fontSize: 14,
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = `color-mix(in oklch, ${accent} 22%, transparent)`)
            }
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--po-text-dim)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.2,
              }}
            >
              {answerText.length}/{Config.chat.maxMessageLength}
            </span>
            <motion.button
              onClick={handleSubmitAnswer}
              disabled={!answerText.trim()}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              style={{
                padding: '12px 26px',
                borderRadius: 9999,
                background: accent,
                color: 'var(--po-text-inverted, #111)',
                border: 'none',
                fontFamily: 'var(--po-font-display)',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                cursor: answerText.trim() ? 'pointer' : 'not-allowed',
                opacity: answerText.trim() ? 1 : 0.4,
                boxShadow: `0 4px 20px color-mix(in oklch, ${accent} 50%, transparent)`,
              }}
            >
              Submit
            </motion.button>
          </div>
        </div>
      )}

      {phase === PromptPhases.ANSWERING && answerSubmitted && (
        <LockedInReceipt
          accentColor={accent}
          label="You answered"
          value="Sent — stays anonymous."
        />
      )}

      {/* Guessing — inline avatar attribution, no native select */}
      {phase === PromptPhases.GUESSING && !(hasGuessed || guessSubmitted) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {anonymousAnswers.map((a) => {
            const assignedId = guessMap[a.index];
            const assigned = assignedId ? roster[assignedId] : undefined;
            const isActive = activeAnswerIndex === a.index;
            return (
              <div
                key={a.index}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: isActive
                    ? `color-mix(in oklch, ${accent} 8%, var(--po-bg-glass))`
                    : 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                  border: `1.5px solid ${
                    assignedId
                      ? `color-mix(in oklch, ${accent} 36%, transparent)`
                      : isActive
                        ? accent
                        : 'var(--po-border, rgba(255,255,255,0.08))'
                  }`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `color-mix(in oklch, ${accent} 18%, transparent)`,
                      color: accent,
                      fontFamily: 'var(--po-font-display)',
                      fontSize: 13,
                      fontWeight: 800,
                      marginTop: 2,
                    }}
                  >
                    {a.index + 1}
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 14,
                      lineHeight: 1.45,
                      fontStyle: 'italic',
                      color: 'var(--po-text)',
                    }}
                  >
                    “{a.text}”
                  </p>
                </div>

                {/* Assigned chip (if any) + open/close picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {assigned ? (
                    <>
                      <motion.div
                        layout
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px 4px 4px',
                          borderRadius: 9999,
                          background: `color-mix(in oklch, ${accent} 22%, transparent)`,
                          border: `1px solid color-mix(in oklch, ${accent} 48%, transparent)`,
                        }}
                      >
                        <PersonaAvatar
                          avatarUrl={assigned.avatarUrl}
                          personaName={assigned.personaName}
                          size={24}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--po-font-display)',
                            fontSize: 12,
                            fontWeight: 800,
                            color: accent,
                            letterSpacing: 0.1,
                          }}
                        >
                          {firstName(assignedId!)}
                        </span>
                        <button
                          onClick={() => handleClearAssignment(a.index)}
                          aria-label="Clear"
                          style={{
                            marginLeft: 2,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: accent,
                            cursor: 'pointer',
                            opacity: 0.8,
                          }}
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </motion.div>
                      <button
                        onClick={() => setActiveAnswerIndex(isActive ? null : a.index)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 9999,
                          background: 'transparent',
                          border: `1px solid var(--po-border)`,
                          color: 'var(--po-text-dim)',
                          fontFamily: 'var(--po-font-display)',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.15,
                          cursor: 'pointer',
                        }}
                      >
                        Change
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setActiveAnswerIndex(isActive ? null : a.index)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 9999,
                        background: isActive
                          ? accent
                          : `color-mix(in oklch, ${accent} 14%, transparent)`,
                        border: `1px solid color-mix(in oklch, ${accent} ${
                          isActive ? 80 : 36
                        }%, transparent)`,
                        color: isActive ? 'var(--po-text-inverted, #111)' : accent,
                        fontFamily: 'var(--po-font-display)',
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.15,
                        cursor: 'pointer',
                      }}
                    >
                      {isActive ? 'Cancel' : 'Pick who wrote this'}
                    </button>
                  )}
                </div>

                {/* Picker — avatar row, not a native select */}
                {isActive && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.25 }}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      paddingTop: 4,
                    }}
                  >
                    {eligibleVoters.map((pid) => {
                      const p = roster[pid];
                      const usedElsewhere = Object.entries(guessMap).some(
                        ([k, v]) => v === pid && Number(k) !== a.index,
                      );
                      return (
                        <motion.button
                          key={pid}
                          onClick={() => handleAssign(a.index, pid)}
                          whileTap={reduce ? undefined : { scale: 0.95 }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 4px',
                            borderRadius: 10,
                            background: 'transparent',
                            border: '1px solid transparent',
                            cursor: usedElsewhere ? 'pointer' : 'pointer',
                            opacity: usedElsewhere ? 0.4 : 1,
                            transition: 'opacity 0.2s',
                          }}
                        >
                          <PersonaAvatar
                            avatarUrl={p?.avatarUrl}
                            personaName={p?.personaName}
                            size={48}
                          />
                          <span
                            style={{
                              fontFamily: 'var(--po-font-body)',
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--po-text)',
                              maxWidth: 60,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {firstName(pid)}
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            );
          })}

          <motion.button
            onClick={handleSubmitGuesses}
            disabled={!allGuessed}
            whileTap={reduce || !allGuessed ? undefined : { scale: 0.97 }}
            style={{
              padding: '14px 28px',
              borderRadius: 9999,
              background: accent,
              color: 'var(--po-text-inverted, #111)',
              border: 'none',
              fontFamily: 'var(--po-font-display)',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: allGuessed ? 'pointer' : 'not-allowed',
              opacity: allGuessed ? 1 : 0.4,
              boxShadow: `0 4px 22px color-mix(in oklch, ${accent} 50%, transparent)`,
              alignSelf: 'center',
              transition: 'opacity 0.2s',
            }}
          >
            Lock in my guesses
          </motion.button>
        </div>
      )}

      {phase === PromptPhases.GUESSING && (hasGuessed || guessSubmitted) && (
        <LockedInReceipt
          accentColor={accent}
          label="Guesses submitted"
          value="Fingers crossed."
        />
      )}

      {/* Results */}
      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel accentColor={accent}>Who wrote what</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.anonymousAnswers.map((a) => {
                const authorId = results.indexToAuthor[a.index];
                const author = authorId ? roster[authorId] : undefined;
                const isMe = authorId === playerId;
                return (
                  <div
                    key={a.index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: isMe
                        ? `color-mix(in oklch, ${accent} 10%, transparent)`
                        : 'var(--po-bg-glass, rgba(255,255,255,0.03))',
                      border: isMe
                        ? `1px solid color-mix(in oklch, ${accent} 32%, transparent)`
                        : '1px solid var(--po-border, rgba(255,255,255,0.05))',
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `color-mix(in oklch, ${accent} 20%, transparent)`,
                        color: accent,
                        fontFamily: 'var(--po-font-display)',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {a.index + 1}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--po-font-body)',
                        fontSize: 13,
                        fontStyle: 'italic',
                        color: 'var(--po-text)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                      }}
                    >
                      “{a.text}”
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PersonaAvatar
                        avatarUrl={author?.avatarUrl}
                        personaName={author?.personaName}
                        size={28}
                      />
                      <span
                        style={{
                          fontFamily: 'var(--po-font-display)',
                          fontSize: 12,
                          fontWeight: 800,
                          color: isMe ? accent : 'var(--po-text)',
                          letterSpacing: 0.1,
                        }}
                      >
                        {isMe ? 'You' : authorId ? firstName(authorId) : '?'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <ScoreTile
              label="Correct guesses"
              value={results.correctGuesses[playerId] ?? 0}
              color="var(--po-green)"
            />
            <ScoreTile
              label="Players fooled"
              value={results.fooledCounts[playerId] ?? 0}
              color={accent}
            />
          </div>

          <SilverEarned amount={results.silverRewards[playerId] ?? 0} />
        </div>
      )}
    </PromptShell>
  );
}

function ScoreTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 26%, transparent)`,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--po-text-dim)',
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 26,
          fontWeight: 800,
          color,
          letterSpacing: -0.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
    </div>
  );
}
