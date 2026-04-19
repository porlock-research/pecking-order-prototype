import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import { Crown, Coins, Sword, ShieldCheck, Sparkle } from '../../../shells/pulse/icons';

const TRUST_ACCENT = 'var(--po-green)';
const BETRAY_ACCENT = 'var(--po-pink)';
const POT_ACCENT = 'var(--po-gold)';

interface SplitFinalRevealProps {
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}

export default function SplitFinalReveal({ results, roster, playerId }: SplitFinalRevealProps) {
  const summary = results.summary as Record<string, any>;
  const silverRewards = results.silverRewards as Record<string, number>;
  const shieldWinnerId = (results.shieldWinnerId as string | null) ?? null;
  const winnerId = (summary.winnerId as string | null) ?? null;
  const winnerBonus = (summary.winnerBonus as number) ?? 0;
  const stealCounts = (summary.stealCounts as Record<string, number>) ?? {};
  const reduce = useReducedMotion();

  const ranked = Object.entries(silverRewards).sort(([, a], [, b]) => b - a);
  const winner = winnerId ? roster[winnerId] : undefined;
  const winnerName = winner?.personaName ?? 'No one';
  const winnerFirst = winner?.personaName?.split(' ')[0] ?? winnerName;
  const winnerTotal = winnerId ? silverRewards[winnerId] ?? 0 : 0;
  const isWinnerMe = winnerId === playerId;

  const heroWord = winnerId ? `${winnerFirst.toUpperCase()} BANKED` : 'GAME OVER';
  const moodLine = winnerId
    ? isWinnerMe
      ? `You took home the most silver`
      : `${winnerFirst} ended the game on top`
    : 'Nobody banked silver';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '4px 4px 12px',
      }}
    >
      {/* HERO */}
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
            color: POT_ACCENT,
            textShadow: `0 0 36px color-mix(in oklch, ${POT_ACCENT} 30%, transparent)`,
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

      {/* WINNER COMPOSITION */}
      {winner && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...PULSE_SPRING.gentle, delay: reduce ? 0 : 0.08 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '18px 12px',
            borderRadius: 18,
            background: `linear-gradient(180deg, color-mix(in oklch, ${POT_ACCENT} 8%, transparent), transparent)`,
          }}
        >
          <div style={{ position: 'relative' }}>
            <PersonaAvatar
              avatarUrl={winner.avatarUrl}
              personaName={winner.personaName}
              size={104}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: POT_ACCENT,
                border: '2px solid var(--po-bg-deep, #15121a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 6px 22px color-mix(in oklch, ${POT_ACCENT} 50%, transparent)`,
              }}
            >
              <Crown size={20} weight="fill" color="#15121a" />
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--po-text)',
              letterSpacing: '-0.01em',
            }}
          >
            {winnerName}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              background: 'color-mix(in oklch, var(--po-text) 6%, transparent)',
              fontFamily: 'var(--po-font-display)',
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: POT_ACCENT,
            }}
          >
            <Coins size={13} weight="fill" />+{winnerTotal} silver
            {winnerBonus > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: `color-mix(in oklch, ${POT_ACCENT} 22%, transparent)`,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                }}
              >
                +{winnerBonus} BONUS
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* FINAL STANDINGS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          Final Standings
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ranked.map(([pid, total], i) => {
            const player = roster[pid];
            const isMe = pid === playerId;
            const isFirst = i === 0;
            const isWinner = pid === winnerId;
            const hasShield = pid === shieldWinnerId;
            const steals = stealCounts[pid] ?? 0;
            return (
              <div
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: isWinner
                    ? `color-mix(in oklch, ${POT_ACCENT} 12%, transparent)`
                    : isMe
                      ? `color-mix(in oklch, ${POT_ACCENT} 6%, transparent)`
                      : 'color-mix(in oklch, var(--po-text) 3%, transparent)',
                  border: isWinner
                    ? `1px solid color-mix(in oklch, ${POT_ACCENT} 36%, transparent)`
                    : isMe
                      ? `1px solid color-mix(in oklch, ${POT_ACCENT} 22%, transparent)`
                      : '1px solid transparent',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 12,
                    fontWeight: 800,
                    color: isFirst ? POT_ACCENT : 'var(--po-text-dim)',
                    fontVariantNumeric: 'tabular-nums',
                    width: 18,
                    textAlign: 'right',
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ position: 'relative' }}>
                  <PersonaAvatar
                    avatarUrl={player?.avatarUrl}
                    personaName={player?.personaName}
                    size={32}
                  />
                  {hasShield && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        bottom: -3,
                        right: -3,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: POT_ACCENT,
                        border: '1.5px solid var(--po-bg-deep, #15121a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheck size={8} weight="fill" color="#15121a" />
                    </div>
                  )}
                </div>
                <div
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 14,
                      fontWeight: isMe || isWinner ? 700 : 500,
                      color: isWinner ? POT_ACCENT : 'var(--po-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {player?.personaName ?? pid}
                  </span>
                  {steals > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontFamily: 'var(--po-font-body)',
                        fontSize: 10,
                        fontWeight: 600,
                        color: BETRAY_ACCENT,
                        opacity: 0.8,
                      }}
                    >
                      <Sword size={9} weight="fill" />
                      {steals} steal{steals === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 14,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      total > 0
                        ? POT_ACCENT
                        : total < 0
                          ? BETRAY_ACCENT
                          : 'var(--po-text-dim)',
                  }}
                >
                  <Coins size={11} weight="fill" />
                  {total > 0 ? '+' : ''}
                  {total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* GREED TAX */}
      {results.goldContribution > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '10px 14px',
            borderRadius: 12,
            background: `color-mix(in oklch, ${POT_ACCENT} 8%, transparent)`,
            border: `1px solid color-mix(in oklch, ${POT_ACCENT} 24%, transparent)`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--po-font-display)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: POT_ACCENT,
            }}
          >
            <Sparkle size={12} weight="fill" />
            Greed Tax
          </div>
          <div
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 18,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: POT_ACCENT,
            }}
          >
            {results.goldContribution} silver burned to gold
          </div>
          <div
            style={{
              fontFamily: 'var(--po-font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--po-text-dim)',
            }}
          >
            from mutual-steal rounds
          </div>
        </div>
      )}
    </div>
  );
}
