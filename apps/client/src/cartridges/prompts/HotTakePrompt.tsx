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

const OPTION_COLORS = ['var(--po-green)', 'var(--po-pink)', 'var(--po-gold)', 'var(--po-blue)'];

interface HotTakeResults {
  statement: string;
  promptId?: string;
  options?: string[];
  tally?: number[];
  minorityIndices?: number[];
  hasRealMinority?: boolean;
  silverRewards: Record<string, number>;
  // --- legacy shape (completed games recorded before the pool shipped) ---
  agreeCount?: number;
  disagreeCount?: number;
  minorityStance?: 'AGREE' | 'DISAGREE' | null;
}

interface HotTakeCartridge {
  promptType: 'HOT_TAKE';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  options?: string[];
  stances: Record<string, number | 'AGREE' | 'DISAGREE'>;
  results: HotTakeResults | null;
}

interface HotTakePromptProps {
  cartridge: HotTakeCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function HotTakePrompt({ cartridge, playerId, roster, engine }: HotTakePromptProps) {
  const { promptText, phase, eligibleVoters, stances, results } = cartridge;
  const options = cartridge.options ?? ['Agree', 'Disagree'];

  const normalizedStances: Record<string, number> = {};
  for (const [pid, v] of Object.entries(stances ?? {})) {
    if (typeof v === 'number') {
      normalizedStances[pid] = v;
    } else if (v === 'AGREE') {
      normalizedStances[pid] = 0;
    } else if (v === 'DISAGREE') {
      normalizedStances[pid] = 1;
    }
  }

  const hasResponded = playerId in normalizedStances;
  const respondedCount = Object.keys(normalizedStances).length;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.HOT_TAKE;
  const reduce = useReducedMotion();

  const handleOption = (optionIndex: number) => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction(ActivityEvents.HOTTAKE.RESPOND, { optionIndex });
  };

  const tally: number[] =
    results?.tally && results.tally.length === options.length
      ? results.tally
      : deriveLegacyTally(results, options, normalizedStances);

  const minorityIndices: number[] =
    results?.minorityIndices ?? deriveLegacyMinorityIndices(results, options);

  const hasRealMinority = results?.hasRealMinority ?? minorityIndices.length > 0;

  const status =
    phase === PromptPhases.RESULTS
      ? 'Results'
      : respondedCount === totalEligible
        ? 'All in'
        : `${respondedCount}/${totalEligible} in`;

  return (
    <PromptShell
      type="HOT_TAKE"
      accentColor={accent}
      status={status}
      statusBadge={phase === PromptPhases.ACTIVE && hasResponded ? 'Submitted' : undefined}
      promptText={promptText}
      helper={
        phase === PromptPhases.ACTIVE && !hasResponded
          ? 'Pick a side — being in the minority earns bonus silver.'
          : undefined
      }
      eligibleIds={phase === PromptPhases.ACTIVE ? eligibleVoters : undefined}
      respondedIds={phase === PromptPhases.ACTIVE ? Object.keys(normalizedStances) : undefined}
      roster={roster}
    >
      {phase === PromptPhases.ACTIVE && !hasResponded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: options.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: 10,
          }}
        >
          {options.map((label, i) => (
            <StanceButton
              key={i}
              onClick={() => handleOption(i)}
              label={label}
              color={OPTION_COLORS[i % OPTION_COLORS.length]}
            />
          ))}
        </div>
      )}

      {phase === PromptPhases.ACTIVE && hasResponded && (
        <LockedInReceipt
          accentColor={OPTION_COLORS[normalizedStances[playerId] % OPTION_COLORS.length]}
          label="You voted"
          value={options[normalizedStances[playerId]] ?? 'Submitted'}
        />
      )}

      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TallyBar
            options={options}
            tally={tally}
            colors={OPTION_COLORS}
            minorityIndices={minorityIndices}
            reduce={reduce ?? false}
          />

          {hasRealMinority && (
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
              Minority bonus · {minorityIndices.map((i) => options[i]).join(' & ')} · +10 silver
            </p>
          )}

          {Object.keys(normalizedStances).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel>Who said what</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(normalizedStances).map(([pid, idx]) => {
                  const player = roster[pid];
                  const isMe = pid === playerId;
                  const tagColor = OPTION_COLORS[idx % OPTION_COLORS.length];
                  return (
                    <StanceRow
                      key={pid}
                      player={player}
                      isMe={isMe}
                      name={player?.personaName || pid}
                      tagLabel={options[idx] ?? '—'}
                      tagColor={tagColor}
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
/*  Local primitives                                                   */
/* ------------------------------------------------------------------ */

function StanceButton({
  onClick,
  label,
  color,
}: {
  onClick: () => void;
  label: string;
  color: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        padding: '18px 12px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${color} 10%, var(--po-bg-glass, rgba(255,255,255,0.03)))`,
        border: `1.5px solid color-mix(in oklch, ${color} 38%, transparent)`,
        cursor: 'pointer',
        fontFamily: 'var(--po-font-display)',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: color,
        boxShadow: `0 0 14px color-mix(in oklch, ${color} 18%, transparent)`,
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {label}
    </motion.button>
  );
}

function TallyBar({
  options,
  tally,
  colors,
  minorityIndices,
  reduce,
}: {
  options: string[];
  tally: number[];
  colors: string[];
  minorityIndices: number[];
  reduce: boolean;
}) {
  const total = tally.reduce((s, n) => s + n, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 8,
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {options.map((opt, i) => (
          <span key={i} style={{ color: colors[i % colors.length] }}>
            {opt} · {tally[i]}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          height: 36,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--po-border, rgba(255,255,255,0.08))',
        }}
      >
        {tally.map((count, i) => {
          const pct = total > 0 ? (count / total) * 100 : 100 / tally.length;
          const color = colors[i % colors.length];
          const isMinority = minorityIndices.includes(i);
          return (
            <motion.div
              key={i}
              initial={reduce ? { width: `${pct}%` } : { width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `color-mix(in oklch, ${color} 22%, transparent)`,
                color,
                fontFamily: 'var(--po-font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.2,
                fontVariantNumeric: 'tabular-nums',
                outline: isMinority ? '2px solid var(--po-gold)' : 'none',
                outlineOffset: -2,
              }}
            >
              {pct > 10 ? `${Math.round(pct)}%` : ''}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function deriveLegacyTally(
  results: HotTakeResults | null,
  options: string[],
  stances: Record<string, number>,
): number[] {
  if (!results) return options.map(() => 0);
  if (typeof results.agreeCount === 'number' && options.length === 2) {
    return [results.agreeCount, results.disagreeCount ?? 0];
  }
  const out = options.map(() => 0);
  for (const idx of Object.values(stances)) out[idx]++;
  return out;
}

function deriveLegacyMinorityIndices(
  results: HotTakeResults | null,
  options: string[],
): number[] {
  if (!results?.minorityStance || options.length !== 2) return [];
  return [results.minorityStance === 'AGREE' ? 0 : 1];
}

function StanceRow({
  player,
  isMe,
  name,
  tagLabel,
  tagColor,
}: {
  player?: SocialPlayer;
  isMe: boolean;
  name: string;
  tagLabel: string;
  tagColor: string;
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
      <PersonaAvatar
        avatarUrl={player?.avatarUrl}
        personaName={player?.personaName}
        size={36}
      />
      <span
        style={{
          flex: 1,
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
          padding: '3px 10px',
          borderRadius: 9999,
          background: `color-mix(in oklch, ${tagColor} 18%, transparent)`,
          color: tagColor,
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.2,
          textTransform: 'uppercase',
        }}
      >
        {tagLabel}
      </span>
    </div>
  );
}
