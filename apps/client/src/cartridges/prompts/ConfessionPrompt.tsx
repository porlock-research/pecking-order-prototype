import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PromptPhases, ActivityEvents, Config, type SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import {
  PROMPT_ACCENT,
  PromptShell,
  LockedInReceipt,
  WinnerSpread,
  SilverEarned,
  SectionLabel,
} from './PromptShell';

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

export default function ConfessionPrompt({
  cartridge,
  playerId,
  roster,
  engine,
}: ConfessionPromptProps) {
  const { promptText, phase, eligibleVoters, anonymousConfessions, votes, results } = cartridge;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.CONFESSION;

  const [confessionText, setConfessionText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [votedIndex, setVotedIndex] = useState<number | null>(null);
  const hasVoted = playerId in votes;

  const name = (id: string) => roster[id]?.personaName || id;
  const firstName = (id: string) => name(id).split(' ')[0];
  const reduce = useReducedMotion();

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

  const status = (() => {
    if (phase === PromptPhases.COLLECTING) return 'Write yours';
    if (phase === PromptPhases.VOTING) {
      const v = Object.keys(votes).length;
      return v === totalEligible ? 'All voted' : `${v}/${totalEligible} voted`;
    }
    return 'Results';
  })();

  const statusBadge =
    (phase === PromptPhases.COLLECTING && submitted)
      ? 'Submitted'
      : phase === PromptPhases.VOTING && (hasVoted || votedIndex !== null)
        ? 'Voted'
        : undefined;

  const helper =
    phase === PromptPhases.COLLECTING && !submitted
      ? 'Anonymous — no one knows it’s you until the reveal.'
      : phase === PromptPhases.VOTING && !(hasVoted || votedIndex !== null)
        ? 'Vote for the best. Winner takes +15 silver.'
        : undefined;

  return (
    <PromptShell
      type="CONFESSION"
      accentColor={accent}
      status={status}
      statusBadge={statusBadge}
      promptText={promptText}
      helper={helper}
      /* Strip hides during COLLECTING — server strips who's written what. */
      eligibleIds={phase === PromptPhases.VOTING ? eligibleVoters : undefined}
      respondedIds={phase === PromptPhases.VOTING ? Object.keys(votes) : undefined}
      roster={roster}
    >
      {/* Collecting — write */}
      {phase === PromptPhases.COLLECTING && !submitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={confessionText}
            onChange={(e) => setConfessionText(e.target.value.slice(0, Config.chat.maxMessageLength))}
            placeholder="Spill it…"
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
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accent;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `color-mix(in oklch, ${accent} 22%, transparent)`;
            }}
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
              {confessionText.length}/{Config.chat.maxMessageLength}
            </span>
            <motion.button
              onClick={handleSubmitConfession}
              disabled={!confessionText.trim()}
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
                cursor: confessionText.trim() ? 'pointer' : 'not-allowed',
                opacity: confessionText.trim() ? 1 : 0.4,
                boxShadow: `0 4px 20px color-mix(in oklch, ${accent} 50%, transparent)`,
                transition: 'opacity 0.2s',
              }}
            >
              Confess
            </motion.button>
          </div>
        </div>
      )}

      {phase === PromptPhases.COLLECTING && submitted && (
        <LockedInReceipt
          accentColor={accent}
          label="You confessed"
          value="Sent — stays anonymous until the reveal."
          waitingText="Waiting for the rest…"
        />
      )}

      {/* Voting — pick the best */}
      {phase === PromptPhases.VOTING && !(hasVoted || votedIndex !== null) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {anonymousConfessions.map((c) => (
            <motion.button
              key={c.index}
              onClick={() => handleVote(c.index)}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              whileHover={reduce ? undefined : { y: -1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                border: `1px solid var(--po-border, rgba(255,255,255,0.08))`,
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 12,
                alignItems: 'start',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `color-mix(in oklch, ${accent} 42%, transparent)`;
                e.currentTarget.style.background = `color-mix(in oklch, ${accent} 6%, var(--po-bg-glass))`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--po-border, rgba(255,255,255,0.08))';
                e.currentTarget.style.background = 'var(--po-bg-glass, rgba(255,255,255,0.04))';
              }}
            >
              <span
                style={{
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
                {c.index + 1}
              </span>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 14,
                  lineHeight: 1.45,
                  fontStyle: 'italic',
                  color: 'var(--po-text)',
                }}
              >
                “{c.text}”
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {phase === PromptPhases.VOTING && (hasVoted || votedIndex !== null) && (
        <LockedInReceipt
          accentColor={accent}
          label="You voted"
          value={`Confession #${(votedIndex ?? votes[playerId]) + 1}`}
        />
      )}

      {/* Results */}
      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {results.winnerText && results.winnerId && (
            <WinnerSpread
              player={roster[results.winnerId]}
              accentColor={accent}
              label="Best Confession"
              name={firstName(results.winnerId)}
              sublabel="+15 silver"
            />
          )}

          {results.winnerText && (
            <blockquote
              style={{
                margin: 0,
                padding: '14px 16px',
                borderRadius: 14,
                background: `color-mix(in oklch, ${accent} 10%, transparent)`,
                border: `1px solid color-mix(in oklch, ${accent} 28%, transparent)`,
                fontFamily: 'var(--po-font-body)',
                fontSize: 15,
                lineHeight: 1.5,
                fontStyle: 'italic',
                color: 'var(--po-text)',
                textAlign: 'center',
              }}
            >
              “{results.winnerText}”
            </blockquote>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel>Author reveal</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.anonymousConfessions.map((c) => {
                const authorId = results.indexToAuthor[c.index];
                const author = authorId ? roster[authorId] : undefined;
                const isWinner = c.index === results.winnerIndex;
                const isMe = authorId === playerId;
                return (
                  <div
                    key={c.index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: isWinner
                        ? `color-mix(in oklch, ${accent} 10%, transparent)`
                        : 'var(--po-bg-glass, rgba(255,255,255,0.03))',
                      border: isWinner
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
                        background: isWinner
                          ? accent
                          : 'color-mix(in oklch, var(--po-text-dim) 15%, transparent)',
                        color: isWinner ? 'var(--po-text-inverted, #111)' : 'var(--po-text-dim)',
                        fontFamily: 'var(--po-font-display)',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {c.index + 1}
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
                      “{c.text}”
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PersonaAvatar
                        avatarUrl={author?.avatarUrl}
                        personaName={author?.personaName}
                        size={24}
                      />
                      <span
                        style={{
                          fontFamily: 'var(--po-font-display)',
                          fontSize: 12,
                          fontWeight: 700,
                          color: isMe ? accent : 'var(--po-text-dim)',
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

          <SilverEarned amount={results.silverRewards[playerId] ?? 0} />
        </div>
      )}
    </PromptShell>
  );
}
