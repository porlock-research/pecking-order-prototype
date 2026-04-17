import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import {
  PROMPT_ACCENT,
  PromptShell,
  LockedInReceipt,
  SilverEarned,
  SectionLabel,
} from './PromptShell';

interface WyrCartridge {
  promptType: 'WOULD_YOU_RATHER';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  optionA: string;
  optionB: string;
  eligibleVoters: string[];
  choices: Record<string, 'A' | 'B'>;
  results: {
    optionA: string;
    optionB: string;
    countA: number;
    countB: number;
    minorityChoice: 'A' | 'B' | null;
    silverRewards: Record<string, number>;
  } | null;
}

interface WyrPromptProps {
  cartridge: WyrCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function WouldYouRatherPrompt({
  cartridge,
  playerId,
  roster,
  engine,
}: WyrPromptProps) {
  const { promptText, phase, optionA, optionB, eligibleVoters, choices, results } = cartridge;
  const hasResponded = playerId in choices;
  const respondedCount = Object.keys(choices).length;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.WOULD_YOU_RATHER;
  const reduce = useReducedMotion();

  const handleChoose = (choice: 'A' | 'B') => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction(ActivityEvents.WYR.CHOOSE, { choice });
  };

  const status =
    phase === PromptPhases.RESULTS
      ? 'Results'
      : respondedCount === totalEligible
        ? 'All in'
        : `${respondedCount}/${totalEligible} in`;

  // Accent-contrasting second color for side B so A/B read as a duality,
  // not a monochrome duplicate.
  const accentB = 'var(--po-orange)';

  return (
    <PromptShell
      type="WOULD_YOU_RATHER"
      accentColor={accent}
      status={status}
      statusBadge={phase === PromptPhases.ACTIVE && hasResponded ? 'Submitted' : undefined}
      promptText={promptText}
      helper={
        phase === PromptPhases.ACTIVE && !hasResponded
          ? 'Pick one — no changing your mind.'
          : undefined
      }
      eligibleIds={phase === PromptPhases.ACTIVE ? eligibleVoters : undefined}
      respondedIds={phase === PromptPhases.ACTIVE ? Object.keys(choices) : undefined}
      roster={roster}
    >
      {phase === PromptPhases.ACTIVE && !hasResponded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OptionButton
            letter="A"
            text={optionA}
            color={accent}
            onClick={() => handleChoose('A')}
          />
          <span
            style={{
              alignSelf: 'center',
              fontFamily: 'var(--po-font-display)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.3em',
              color: 'var(--po-text-dim)',
              opacity: 0.6,
            }}
          >
            OR
          </span>
          <OptionButton
            letter="B"
            text={optionB}
            color={accentB}
            onClick={() => handleChoose('B')}
          />
        </div>
      )}

      {phase === PromptPhases.ACTIVE && hasResponded && (
        <LockedInReceipt
          accentColor={choices[playerId] === 'A' ? accent : accentB}
          label="You picked"
          value={choices[playerId] === 'A' ? optionA : optionB}
        />
      )}

      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DualBar
            leftText={results.optionA}
            leftCount={results.countA}
            leftColor={accent}
            rightText={results.optionB}
            rightCount={results.countB}
            rightColor={accentB}
            minority={
              results.minorityChoice === 'A'
                ? 'left'
                : results.minorityChoice === 'B'
                  ? 'right'
                  : null
            }
            reduce={reduce ?? false}
          />

          {results.minorityChoice && (
            <p
              style={{
                margin: 0,
                textAlign: 'center',
                fontFamily: 'var(--po-font-display)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--po-gold)',
              }}
            >
              Minority bonus · +10 silver
            </p>
          )}

          {Object.keys(choices).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel>Who chose what</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(choices).map(([pid, choice]) => {
                  const player = roster[pid];
                  const isMe = pid === playerId;
                  const color = choice === 'A' ? accent : accentB;
                  const text = choice === 'A' ? results.optionA : results.optionB;
                  return (
                    <ChoiceRow
                      key={pid}
                      player={player}
                      isMe={isMe}
                      name={player?.personaName || pid}
                      pickLabel={text}
                      pickColor={color}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <SilverEarned amount={results.silverRewards[playerId] ?? 0} />
        </div>
      )}
    </PromptShell>
  );
}

/* ------------------------------------------------------------------ */

function OptionButton({
  letter,
  text,
  color,
  onClick,
}: {
  letter: string;
  text: string;
  color: string;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      whileHover={reduce ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px 14px 10px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${color} 8%, var(--po-bg-glass, rgba(255,255,255,0.03)))`,
        border: `1.5px solid color-mix(in oklch, ${color} 32%, transparent)`,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: `0 0 12px color-mix(in oklch, ${color} 15%, transparent)`,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: color,
          color: 'var(--po-text-inverted, #111)',
          fontFamily: 'var(--po-font-display)',
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: -0.5,
        }}
      >
        {letter}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.3,
          color: 'var(--po-text)',
          letterSpacing: 0.1,
        }}
      >
        {text}
      </span>
    </motion.button>
  );
}

function DualBar({
  leftText,
  leftCount,
  leftColor,
  rightText,
  rightCount,
  rightColor,
  minority,
  reduce,
}: {
  leftText: string;
  leftCount: number;
  leftColor: string;
  rightText: string;
  rightCount: number;
  rightColor: string;
  minority: 'left' | 'right' | null;
  reduce: boolean;
}) {
  const total = leftCount + rightCount;
  const pctLeft = total > 0 ? Math.round((leftCount / total) * 100) : 50;
  const pctRight = 100 - pctLeft;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          height: 36,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--po-border, rgba(255,255,255,0.08))',
        }}
      >
        <motion.div
          initial={reduce ? { width: `${pctLeft}%` } : { width: '50%' }}
          animate={{ width: `${pctLeft}%` }}
          transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in oklch, ${leftColor} 22%, transparent)`,
            color: leftColor,
            fontFamily: 'var(--po-font-display)',
            fontWeight: 800,
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            outline: minority === 'left' ? '2px solid var(--po-gold)' : 'none',
            outlineOffset: -2,
          }}
        >
          {pctLeft > 10 ? `${pctLeft}%` : ''}
        </motion.div>
        <motion.div
          initial={reduce ? { width: `${pctRight}%` } : { width: '50%' }}
          animate={{ width: `${pctRight}%` }}
          transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in oklch, ${rightColor} 22%, transparent)`,
            color: rightColor,
            fontFamily: 'var(--po-font-display)',
            fontWeight: 800,
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            outline: minority === 'right' ? '2px solid var(--po-gold)' : 'none',
            outlineOffset: -2,
          }}
        >
          {pctRight > 10 ? `${pctRight}%` : ''}
        </motion.div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ color: leftColor, maxWidth: '48%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {leftText}
        </span>
        <span style={{ color: rightColor, maxWidth: '48%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          {rightText}
        </span>
      </div>
    </div>
  );
}

function ChoiceRow({
  player,
  isMe,
  name,
  pickLabel,
  pickColor,
}: {
  player?: SocialPlayer;
  isMe: boolean;
  name: string;
  pickLabel: string;
  pickColor: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 10,
        background: isMe
          ? 'color-mix(in oklch, var(--po-gold) 8%, transparent)'
          : 'var(--po-bg-glass, rgba(255,255,255,0.03))',
        border: isMe
          ? '1px solid color-mix(in oklch, var(--po-gold) 26%, transparent)'
          : '1px solid var(--po-border, rgba(255,255,255,0.05))',
      }}
    >
      <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={36} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          fontWeight: 700,
          color: isMe ? 'var(--po-gold)' : 'var(--po-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isMe ? 'You' : name}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.1,
          color: pickColor,
          maxWidth: '45%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {pickLabel}
      </span>
    </div>
  );
}
