import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import { Handshake, Sword, Coins, Sparkle } from '../../../shells/pulse/icons';

const TRUST_ACCENT = 'var(--po-green)';
const BETRAY_ACCENT = 'var(--po-pink)';
const POT_ACCENT = 'var(--po-gold)';

interface SplitRoundRevealProps {
  roundResult: {
    silverRewards: Record<string, number>;
    goldContribution: number;
    summary: Record<string, any>;
  };
  roster: Record<string, SocialPlayer>;
  playerId: string;
  currentRound: number;
  totalRounds: number;
}

type Outcome = 'BOTH_SPLIT' | 'A_STEALS' | 'B_STEALS' | 'BOTH_STEAL';

export default function SplitRoundReveal({
  roundResult,
  roster,
  playerId,
  currentRound,
  totalRounds,
}: SplitRoundRevealProps) {
  const summary = roundResult.summary;
  const pairing = summary.pairing as [string, string];
  const potAmount = summary.potAmount as number;
  const actionA = summary.actionA as 'SPLIT' | 'STEAL';
  const actionB = summary.actionB as 'SPLIT' | 'STEAL';
  const outcome = summary.outcome as Outcome;
  const runningTotals = (summary.runningTotals as Record<string, number>) ?? {};
  const reduce = useReducedMotion();

  const [aId, bId] = pairing;
  const a = roster[aId];
  const b = roster[bId];
  const aName = a?.personaName ?? aId;
  const bName = b?.personaName ?? bId;
  const aFirst = firstName(a);
  const bFirst = firstName(b);
  const rewardA = roundResult.silverRewards[aId] ?? 0;
  const rewardB = roundResult.silverRewards[bId] ?? 0;

  const heroWord =
    outcome === 'BOTH_SPLIT'
      ? 'SHARED'
      : outcome === 'A_STEALS'
        ? `${aFirst.toUpperCase()} STEALS`
        : outcome === 'B_STEALS'
          ? `${bFirst.toUpperCase()} STEALS`
          : 'BURNED';

  const heroAccent =
    outcome === 'BOTH_SPLIT'
      ? TRUST_ACCENT
      : outcome === 'BOTH_STEAL'
        ? POT_ACCENT
        : BETRAY_ACCENT;

  const moodLine =
    outcome === 'BOTH_SPLIT'
      ? `Pot of ${potAmount} silver split clean`
      : outcome === 'A_STEALS'
        ? `${aFirst} took it from ${bFirst}`
        : outcome === 'B_STEALS'
          ? `${bFirst} took it from ${aFirst}`
          : `Greed cost both — ${potAmount} silver burned to gold`;

  const showRunningTotals = Object.keys(runningTotals).length > 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 4px 12px' }}>
      {/* HERO WORD */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', ...PULSE_SPRING.snappy }}
        style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        <div
          role="status"
          aria-label={`${heroWord}. ${moodLine}`}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(40px, 11vw, 64px)',
            fontWeight: 900,
            letterSpacing: '0.04em',
            lineHeight: 0.95,
            color: heroAccent,
            textShadow: `0 0 36px color-mix(in oklch, ${heroAccent} 30%, transparent)`,
          }}
        >
          {heroWord}
        </div>
        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--po-text-dim)',
            letterSpacing: '0.02em',
          }}
        >
          {moodLine}
        </div>
      </motion.div>

      {/* PAIR COMPOSITION */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...PULSE_SPRING.gentle, delay: reduce ? 0 : 0.08 }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 10,
          padding: '14px 8px',
          borderRadius: 18,
          background: `linear-gradient(180deg, color-mix(in oklch, ${heroAccent} 6%, transparent), transparent)`,
        }}
      >
        <PlayerCard
          player={a}
          action={actionA}
          reward={rewardA}
          isMe={aId === playerId}
        />
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--po-bg-deep, #15121a)',
            border: '1.5px solid color-mix(in oklch, var(--po-text) 18%, transparent)',
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.18em',
            color: 'var(--po-text-dim)',
          }}
        >
          VS
        </div>
        <PlayerCard
          player={b}
          action={actionB}
          reward={rewardB}
          isMe={bId === playerId}
        />
      </motion.div>

      {/* GREED TAX (BOTH_STEAL only) */}
      {roundResult.goldContribution > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'center',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            background: `color-mix(in oklch, ${POT_ACCENT} 12%, transparent)`,
            border: `1px solid color-mix(in oklch, ${POT_ACCENT} 28%, transparent)`,
            color: POT_ACCENT,
            fontFamily: 'var(--po-font-display)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Sparkle size={12} weight="fill" />
          +{roundResult.goldContribution} to gold pool
        </div>
      )}

      {/* RUNNING TOTALS */}
      {showRunningTotals && (
        <RunningTotals totals={runningTotals} roster={roster} playerId={playerId} />
      )}

      {/* ROUND DOTS */}
      <div
        aria-label={`Round ${currentRound + 1} of ${totalRounds}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingTop: 4,
        }}
      >
        {Array.from({ length: totalRounds }).map((_, i) => {
          const filled = i <= currentRound;
          return (
            <span
              key={i}
              aria-hidden="true"
              style={{
                width: i === currentRound ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: filled
                  ? i === currentRound
                    ? heroAccent
                    : 'color-mix(in oklch, var(--po-text) 30%, transparent)'
                  : 'color-mix(in oklch, var(--po-text) 8%, transparent)',
                transition: 'width 220ms, background 220ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  action,
  reward,
  isMe,
}: {
  player: SocialPlayer | undefined;
  action: 'SPLIT' | 'STEAL';
  reward: number;
  isMe: boolean;
}) {
  const isSplit = action === 'SPLIT';
  const accent = isSplit ? TRUST_ACCENT : BETRAY_ACCENT;
  const Icon = isSplit ? Handshake : Sword;
  const label = isSplit ? 'Split' : 'Steal';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: '50%',
          padding: 2,
          background: isMe
            ? `conic-gradient(from 0deg, ${accent}, color-mix(in oklch, ${accent} 50%, transparent), ${accent})`
            : 'transparent',
        }}
      >
        <div
          style={{
            borderRadius: '50%',
            overflow: 'hidden',
            border: isMe ? '2px solid var(--po-bg-panel)' : 'none',
          }}
        >
          <PersonaAvatar
            avatarUrl={player?.avatarUrl}
            personaName={player?.personaName}
            size={64}
          />
        </div>
        {/* Action badge */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: accent,
            border: '2px solid var(--po-bg-deep, #15121a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px color-mix(in oklch, ${accent} 38%, transparent)`,
          }}
        >
          <Icon size={12} weight="fill" color="#15121a" />
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--po-text)',
          letterSpacing: '-0.01em',
          textAlign: 'center',
          maxWidth: 88,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {firstName(player)}
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: reward > 0 ? TRUST_ACCENT : reward < 0 ? BETRAY_ACCENT : 'var(--po-text-dim)',
        }}
      >
        {reward > 0 ? '+' : ''}
        {reward}
      </div>
    </div>
  );
}

function RunningTotals({
  totals,
  roster,
  playerId,
}: {
  totals: Record<string, number>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}) {
  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--po-text-dim)',
          textAlign: 'center',
        }}
      >
        Standings
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(([pid, total], i) => {
          const player = roster[pid];
          const isMe = pid === playerId;
          return (
            <div
              key={pid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 10,
                background: isMe
                  ? `color-mix(in oklch, ${POT_ACCENT} 8%, transparent)`
                  : 'color-mix(in oklch, var(--po-text) 3%, transparent)',
                border: isMe
                  ? `1px solid color-mix(in oklch, ${POT_ACCENT} 26%, transparent)`
                  : '1px solid transparent',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 11,
                  fontWeight: 800,
                  color: i === 0 ? POT_ACCENT : 'var(--po-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  width: 16,
                  textAlign: 'right',
                }}
              >
                {i + 1}
              </span>
              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={22}
              />
              <span
                style={{
                  flex: '1 1 auto',
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 13,
                  fontWeight: isMe ? 700 : 500,
                  color: isMe ? POT_ACCENT : 'var(--po-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {firstName(player)}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 13,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: total > 0 ? POT_ACCENT : 'var(--po-text-dim)',
                }}
              >
                <Coins size={11} weight="fill" />
                {total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function firstName(player: SocialPlayer | undefined): string {
  if (!player?.personaName) return '?';
  return player.personaName.split(' ')[0];
}
