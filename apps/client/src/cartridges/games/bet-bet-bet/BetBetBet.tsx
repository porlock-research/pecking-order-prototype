import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import { Crown, Coins, ShieldCheck } from '../../../shells/pulse/icons';

const LOCK_IN_MS = 3000;
const POT_ACCENT = 'var(--po-gold)';
const WIN_ACCENT = 'var(--po-green)';
const LOSE_ACCENT = 'var(--po-pink)';

interface BetBetBetProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BetBetBet(props: BetBetBetProps) {
  return (
    <SyncDecisionWrapper
      {...props}
      renderDecisionInput={({ playerId, roster, onSubmit }) => {
        const maxBet = roster[playerId]?.silver ?? 1;
        return <BetInput maxBet={maxBet} onSubmit={onSubmit} />;
      }}
      renderReveal={({ results, roster, playerId }) => (
        <BetReveal results={results} roster={roster} playerId={playerId} />
      )}
    />
  );
}

/* ================ INPUT ================ */

function BetInput({ maxBet, onSubmit }: { maxBet: number; onSubmit: (d: Record<string, any>) => void }) {
  const safeMax = Math.max(1, maxBet);
  const [amount, setAmount] = useState(Math.max(1, Math.floor(safeMax / 2)));
  const [locking, setLocking] = useState(false);
  const reduce = useReducedMotion();

  const handleLockIn = () => {
    if (locking) return;
    setLocking(true);
  };

  const handleCancel = () => setLocking(false);

  useEffect(() => {
    if (!locking || !reduce) return;
    const t = setTimeout(() => {
      onSubmit({ amount });
      setLocking(false);
    }, LOCK_IN_MS);
    return () => clearTimeout(t);
  }, [locking, reduce, onSubmit, amount]);

  const onLockComplete = () => {
    onSubmit({ amount });
    setLocking(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '8px 4px 16px',
      }}
    >
      {/* BIG BET DISPLAY */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '20px 16px',
          borderRadius: 18,
          background: `linear-gradient(180deg, color-mix(in oklch, ${POT_ACCENT} 8%, transparent), transparent)`,
          border: `1px solid color-mix(in oklch, ${POT_ACCENT} 18%, transparent)`,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--po-text-dim)',
          }}
        >
          Your Bet
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(48px, 14vw, 72px)',
            fontWeight: 900,
            lineHeight: 1,
            color: POT_ACCENT,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            textShadow: `0 0 36px color-mix(in oklch, ${POT_ACCENT} 30%, transparent)`,
          }}
        >
          {amount}
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--po-text-dim)', letterSpacing: 0 }}>
            silver
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--po-text-dim)',
          }}
        >
          out of {safeMax} silver in your pile
        </div>
      </div>

      {/* SLIDER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
        <input
          type="range"
          min={1}
          max={safeMax}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          disabled={locking}
          aria-label={`Bet ${amount} of ${safeMax} silver`}
          aria-valuetext={`${amount} silver`}
          style={{
            width: '100%',
            accentColor: POT_ACCENT,
            cursor: locking ? 'not-allowed' : 'pointer',
            opacity: locking ? 0.5 : 1,
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--po-text-dim)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>1</span>
          <span>{safeMax}</span>
        </div>
      </div>

      {/* PAYOUT RULES — visible on surface, not hidden */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          padding: '10px',
          borderRadius: 12,
          background: 'color-mix(in oklch, var(--po-text) 4%, transparent)',
          border: '1px solid color-mix(in oklch, var(--po-text) 6%, transparent)',
        }}
      >
        <PayoutChip label="2nd highest" detail="wins pot" tone="win" />
        <PayoutChip label="Lowest" detail="pays ×2" tone="lose" />
        <PayoutChip label="Tied" detail="costs ×5" tone="lose" />
      </div>

      {/* LOCK-IN */}
      {!locking ? (
        <motion.button
          initial={false}
          animate={{ opacity: 1 }}
          whileTap={!reduce ? { scale: 0.98 } : undefined}
          onClick={handleLockIn}
          aria-label={`Lock in your ${amount}-silver bet. Starts a 3-second countdown.`}
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: 14,
            border: 'none',
            background: POT_ACCENT,
            color: '#15121a',
            fontFamily: 'var(--po-font-display)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: `0 6px 22px color-mix(in oklch, ${POT_ACCENT} 38%, transparent), inset 0 1px 0 color-mix(in oklch, #fff 18%, transparent)`,
          }}
        >
          Lock in {amount}
        </motion.button>
      ) : (
        <CountdownButton
          accent={POT_ACCENT}
          label={`Locking ${amount}`}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
      )}
    </div>
  );
}

function PayoutChip({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'win' | 'lose';
}) {
  const accent = tone === 'win' ? WIN_ACCENT : LOSE_ACCENT;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 4px',
        borderRadius: 8,
        background: `color-mix(in oklch, ${accent} 6%, transparent)`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--po-text-dim)',
        }}
      >
        {detail}
      </span>
    </div>
  );
}

function CountdownButton({
  accent,
  label,
  onCancel,
  onComplete,
  reduce,
}: {
  accent: string;
  label: string;
  onCancel: () => void;
  onComplete: () => void;
  reduce: boolean;
}) {
  return (
    <button
      onClick={onCancel}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={LOCK_IN_MS}
      aria-valuenow={0}
      aria-label={`${label}. Tap to undo.`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: 50,
        borderRadius: 14,
        border: `2px solid ${accent}`,
        background: 'var(--po-bg-panel)',
        color: 'var(--po-text)',
        cursor: 'pointer',
        fontFamily: 'var(--po-font-display)',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {!reduce && (
        <motion.div
          aria-hidden="true"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: LOCK_IN_MS / 1000, ease: 'linear' }}
          onAnimationComplete={onComplete}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 50%, transparent), color-mix(in oklch, ${accent} 25%, transparent))`,
            zIndex: 0,
          }}
        />
      )}
      {reduce && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `color-mix(in oklch, ${accent} 25%, transparent)`,
            zIndex: 0,
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>
        {label} · tap to undo
      </span>
    </button>
  );
}

/* ================ REVEAL ================ */

function BetReveal({
  results,
  roster,
  playerId,
}: {
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}) {
  const summary = results.summary as Record<string, any>;
  const bets = (summary.bets as Record<string, number>) ?? {};
  const winnerId = (summary.winnerId as string | null) ?? null;
  const lowestBettorId = (summary.lowestBettorId as string | null) ?? null;
  const tiedGroups = (summary.tiedGroups as Record<number, string[]>) ?? {};
  const shieldWinnerId = (summary.shieldWinnerId as string | null) ?? null;
  const potTotal = (summary.potTotal as number) ?? 0;
  const reduce = useReducedMotion();

  const sortedEntries = Object.entries(bets).sort(([, a], [, b]) => b - a);
  const winner = winnerId ? roster[winnerId] : undefined;
  const winnerFirst = winner?.personaName?.split(' ')[0] ?? 'No one';
  const isWinnerMe = winnerId === playerId;

  const heroWord = winner ? `${winnerFirst.toUpperCase()} READS IT` : 'NO READ';
  const moodLine = winner
    ? isWinnerMe
      ? `You took the pot of ${potTotal}`
      : `${winnerFirst} took the pot of ${potTotal} silver`
    : 'No clean second-highest bet';

  const tiedSet = new Set<string>();
  Object.values(tiedGroups).forEach((g) => g.forEach((id) => tiedSet.add(id)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 4px 12px' }}>
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
            padding: '16px 12px',
            borderRadius: 18,
            background: `linear-gradient(180deg, color-mix(in oklch, ${POT_ACCENT} 8%, transparent), transparent)`,
          }}
        >
          <div style={{ position: 'relative' }}>
            <PersonaAvatar
              avatarUrl={winner.avatarUrl}
              personaName={winner.personaName}
              size={96}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 36,
                height: 36,
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
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--po-text)',
              letterSpacing: '-0.01em',
            }}
          >
            {winner.personaName}
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
              color: WIN_ACCENT,
            }}
          >
            <Coins size={13} weight="fill" />+{results.silverRewards[winnerId!] ?? potTotal} silver
          </div>
        </motion.div>
      )}

      {/* ALL BIDS */}
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
          The Bids
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sortedEntries.map(([pid, amount], i) => {
            const player = roster[pid];
            const isWinner = pid === winnerId;
            const isLowest = pid === lowestBettorId;
            const isTied = tiedSet.has(pid);
            const isMe = pid === playerId;
            const hasShield = pid === shieldWinnerId;
            const reward = results.silverRewards[pid] ?? 0;

            const rowAccent = isWinner
              ? WIN_ACCENT
              : isLowest || isTied
                ? LOSE_ACCENT
                : null;

            const tag = isWinner
              ? { label: 'Winner', accent: WIN_ACCENT }
              : isTied
                ? { label: 'Tied ×5', accent: LOSE_ACCENT }
                : isLowest
                  ? { label: 'Lowest ×2', accent: LOSE_ACCENT }
                  : null;

            return (
              <div
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: rowAccent
                    ? `color-mix(in oklch, ${rowAccent} 10%, transparent)`
                    : 'color-mix(in oklch, var(--po-text) 3%, transparent)',
                  border: rowAccent
                    ? `1px solid color-mix(in oklch, ${rowAccent} 30%, transparent)`
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
                    color: i === 0 ? 'var(--po-text)' : 'var(--po-text-dim)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: 'var(--po-font-body)',
                        fontSize: 14,
                        fontWeight: isMe || isWinner ? 700 : 500,
                        color: rowAccent ?? 'var(--po-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {player?.personaName ?? pid}
                    </span>
                    {tag && (
                      <span
                        style={{
                          fontFamily: 'var(--po-font-display)',
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: tag.accent,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: `color-mix(in oklch, ${tag.accent} 15%, transparent)`,
                        }}
                      >
                        {tag.label}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--po-text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    bet {amount}
                  </span>
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
                      reward > 0
                        ? WIN_ACCENT
                        : reward < 0
                          ? LOSE_ACCENT
                          : 'var(--po-text-dim)',
                  }}
                >
                  <Coins size={11} weight="fill" />
                  {reward > 0 ? '+' : ''}
                  {reward}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
