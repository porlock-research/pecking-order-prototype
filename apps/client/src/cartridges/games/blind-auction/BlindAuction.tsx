import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import {
  Coins,
  ShieldCheck,
  ShieldSlash,
  Scales,
  LockKey,
  LockKeyOpen,
  Sparkle,
  Gavel,
} from '../../../shells/pulse/icons';

const LOCK_IN_MS = 3000;
const POT_ACCENT = 'var(--po-gold)';
const PRIZE_ACCENT = 'var(--po-gold)';
const SHIELD_ACCENT = 'var(--po-blue)';
const CURSE_ACCENT = 'var(--po-pink)';

interface BlindAuctionProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BlindAuction(props: BlindAuctionProps) {
  return (
    <SyncDecisionWrapper
      {...props}
      renderDecisionInput={({ playerId, roster, onSubmit }) => {
        const maxBid = roster[playerId]?.silver ?? 0;
        return <AuctionInput maxBid={maxBid} onSubmit={onSubmit} />;
      }}
      renderReveal={({ results, roster, playerId }) => (
        <AuctionReveal results={results} roster={roster} playerId={playerId} />
      )}
    />
  );
}

/* ================ INPUT ================ */

function AuctionInput({ maxBid, onSubmit }: { maxBid: number; onSubmit: (d: Record<string, any>) => void }) {
  const safeMax = Math.max(0, maxBid);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [locking, setLocking] = useState(false);
  const reduce = useReducedMotion();

  const handleLockIn = () => {
    if (selectedSlot === null || locking) return;
    setLocking(true);
  };

  const handleCancel = () => setLocking(false);

  useEffect(() => {
    if (!locking || !reduce) return;
    const t = setTimeout(() => {
      onSubmit({ slot: selectedSlot, amount });
      setLocking(false);
    }, LOCK_IN_MS);
    return () => clearTimeout(t);
  }, [locking, reduce, onSubmit, selectedSlot, amount]);

  const onLockComplete = () => {
    onSubmit({ slot: selectedSlot, amount });
    setLocking(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '8px 4px 16px',
      }}
    >
      {/* SLOT TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[1, 2, 3].map((slot) => (
          <SlotTile
            key={slot}
            slot={slot}
            isSelected={selectedSlot === slot}
            disabled={locking}
            onClick={() => !locking && setSelectedSlot(slot)}
            reduce={!!reduce}
          />
        ))}
      </div>

      {/* BID SURFACE */}
      <AnimatePresence mode="wait">
        {selectedSlot !== null && (
          <motion.div
            key="bid"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ type: 'spring', ...PULSE_SPRING.snappy }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '14px 14px 16px',
              borderRadius: 16,
              background: `linear-gradient(180deg, color-mix(in oklch, ${POT_ACCENT} 6%, transparent), transparent)`,
              border: `1px solid color-mix(in oklch, ${POT_ACCENT} 16%, transparent)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--po-text-dim)',
                }}
              >
                Slot {selectedSlot} · Your bid
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 4,
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 30,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: POT_ACCENT,
                  lineHeight: 1,
                }}
              >
                {amount}
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--po-text-dim)' }}>
                  silver
                </span>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={safeMax}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={locking}
              aria-label={`Bid ${amount} of ${safeMax} silver on slot ${selectedSlot}`}
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
                letterSpacing: '0.1em',
                color: 'var(--po-text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>0 (free if solo)</span>
              <span>{safeMax}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOCK-IN */}
      {!locking ? (
        <motion.button
          initial={false}
          animate={{ opacity: selectedSlot !== null ? 1 : 0.5 }}
          transition={{ duration: 0.18 }}
          whileTap={selectedSlot !== null && !reduce ? { scale: 0.98 } : undefined}
          onClick={handleLockIn}
          disabled={selectedSlot === null}
          aria-label={
            selectedSlot !== null
              ? `Lock in ${amount}-silver bid on slot ${selectedSlot}. Starts a 3-second countdown.`
              : 'Pick a slot first'
          }
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: 14,
            border: 'none',
            background:
              selectedSlot !== null
                ? POT_ACCENT
                : 'color-mix(in oklch, var(--po-text) 8%, transparent)',
            color: selectedSlot !== null ? '#15121a' : 'var(--po-text-dim)',
            fontFamily: 'var(--po-font-display)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: selectedSlot !== null ? 'pointer' : 'not-allowed',
            boxShadow:
              selectedSlot !== null
                ? `0 6px 22px color-mix(in oklch, ${POT_ACCENT} 38%, transparent), inset 0 1px 0 color-mix(in oklch, #fff 18%, transparent)`
                : 'none',
            transition: 'background 200ms, color 200ms, box-shadow 200ms',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {selectedSlot !== null && <Gavel size={16} weight="fill" />}
          {selectedSlot !== null ? `Place Bid` : 'Pick a slot'}
        </motion.button>
      ) : (
        <CountdownButton
          accent={POT_ACCENT}
          label={`Bidding ${amount} on slot ${selectedSlot}`}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
      )}
    </div>
  );
}

function SlotTile({
  slot,
  isSelected,
  disabled,
  onClick,
  reduce,
}: {
  slot: number;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  reduce: boolean;
}) {
  return (
    <motion.button
      whileTap={!disabled && !reduce ? { scale: 0.96 } : undefined}
      animate={{
        rotate: isSelected && !reduce ? [0, -2, 2, 0] : 0,
      }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      aria-label={`Pick slot ${slot} — contents hidden`}
      aria-pressed={isSelected}
      disabled={disabled}
      style={{
        position: 'relative',
        overflow: 'hidden',
        aspectRatio: '1',
        borderRadius: 16,
        border: `2px solid ${isSelected ? POT_ACCENT : 'color-mix(in oklch, var(--po-text) 9%, transparent)'}`,
        background: isSelected
          ? `color-mix(in oklch, ${POT_ACCENT} 10%, var(--po-bg-panel))`
          : 'var(--po-bg-panel)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isSelected ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: reduce
          ? 'none'
          : 'border-color 200ms, background 200ms, opacity 200ms, box-shadow 200ms',
        boxShadow: isSelected
          ? `0 0 0 1px ${POT_ACCENT}, 0 0 20px color-mix(in oklch, ${POT_ACCENT} 22%, transparent)`
          : 'none',
      }}
    >
      {/* Decorative sparkle on selected */}
      {isSelected && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: POT_ACCENT,
            opacity: 0.7,
          }}
        >
          <Sparkle size={12} weight="fill" />
        </div>
      )}
      <div
        style={{
          color: isSelected ? POT_ACCENT : 'var(--po-text-dim)',
          transition: 'color 200ms',
        }}
      >
        {isSelected ? (
          <LockKeyOpen size={32} weight="fill" />
        ) : (
          <LockKey size={32} weight="fill" />
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isSelected ? POT_ACCENT : 'var(--po-text-dim)',
          transition: 'color 200ms',
        }}
      >
        Slot {slot}
      </div>
    </motion.button>
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
        fontSize: 13,
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
      <span style={{ position: 'relative', zIndex: 1 }}>{label} · tap to undo</span>
    </button>
  );
}

/* ================ REVEAL ================ */

interface PrizeMeta {
  icon: React.ReactNode;
  accent: string;
  isCurse: boolean;
}

function prizeMeta(type: string): PrizeMeta {
  switch (type) {
    case 'SILVER':
      return { icon: <Coins size={28} weight="fill" />, accent: PRIZE_ACCENT, isCurse: false };
    case 'SHIELD':
      return { icon: <ShieldCheck size={28} weight="fill" />, accent: SHIELD_ACCENT, isCurse: false };
    case 'CURSE_NO_DM':
      return { icon: <ShieldSlash size={28} weight="fill" />, accent: CURSE_ACCENT, isCurse: true };
    case 'CURSE_HALF_VOTE':
      return { icon: <Scales size={28} weight="fill" />, accent: CURSE_ACCENT, isCurse: true };
    default:
      return {
        icon: <Sparkle size={28} weight="fill" />,
        accent: 'var(--po-text-dim)',
        isCurse: false,
      };
  }
}

function AuctionReveal({
  results,
  roster,
  playerId,
}: {
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}) {
  const summary = results.summary as Record<string, any>;
  const prizes =
    (summary.prizes as { type: string; label: string; value: number }[]) ?? [];
  const bids =
    (summary.bids as Record<string, { slot: number; amount: number }>) ?? {};
  const slotWinners = (summary.slotWinners as Record<number, string | null>) ?? {};
  const silverSpent = (summary.silverSpent as number) ?? 0;
  const reduce = useReducedMotion();

  const sortedBids = Object.entries(bids).sort(([, a], [, b]) => b.amount - a.amount);

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
          UNSEALED
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
          The bidders saw what they bought
        </div>
      </motion.div>

      {/* PRIZE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {prizes.map((prize, i) => {
          const slot = i + 1;
          const winnerId = slotWinners[slot];
          const winner = winnerId ? roster[winnerId] : undefined;
          const winnerFirst = winner?.personaName?.split(' ')[0] ?? null;
          const meta = prizeMeta(prize.type);
          return (
            <motion.div
              key={slot}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                ...PULSE_SPRING.gentle,
                delay: reduce ? 0 : 0.05 + i * 0.06,
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '14px 8px 10px',
                borderRadius: 14,
                background: `color-mix(in oklch, ${meta.accent} 8%, var(--po-bg-panel))`,
                border: `1px solid color-mix(in oklch, ${meta.accent} 28%, transparent)`,
              }}
            >
              <div style={{ color: meta.accent }}>{meta.icon}</div>
              <div
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: meta.accent,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {prize.label}
              </div>
              {winner ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    paddingTop: 4,
                    borderTop: `1px solid color-mix(in oklch, ${meta.accent} 18%, transparent)`,
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: '50%',
                      padding: 1.5,
                      background: meta.accent,
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid var(--po-bg-panel)',
                      }}
                    >
                      <PersonaAvatar
                        avatarUrl={winner.avatarUrl}
                        personaName={winner.personaName}
                        size={36}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--po-text)',
                      maxWidth: 70,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {winnerFirst}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    paddingTop: 6,
                    fontFamily: 'var(--po-font-body)',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--po-text-dim)',
                    fontStyle: 'italic',
                  }}
                >
                  No bids
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ALL BIDS */}
      {sortedBids.length > 0 && (
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
            All Bids
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sortedBids.map(([pid, bid]) => {
              const player = roster[pid];
              const isWinner = slotWinners[bid.slot] === pid;
              const isMe = pid === playerId;
              const reward = results.silverRewards[pid] ?? 0;
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
                      ? `color-mix(in oklch, ${POT_ACCENT} 10%, transparent)`
                      : 'color-mix(in oklch, var(--po-text) 3%, transparent)',
                    border: isWinner
                      ? `1px solid color-mix(in oklch, ${POT_ACCENT} 30%, transparent)`
                      : isMe
                        ? `1px solid color-mix(in oklch, ${POT_ACCENT} 22%, transparent)`
                        : '1px solid transparent',
                  }}
                >
                  <PersonaAvatar
                    avatarUrl={player?.avatarUrl}
                    personaName={player?.personaName}
                    size={32}
                  />
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
                          color: isWinner ? POT_ACCENT : 'var(--po-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {player?.personaName ?? pid}
                      </span>
                      {isWinner && (
                        <span
                          style={{
                            fontFamily: 'var(--po-font-display)',
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: POT_ACCENT,
                            padding: '2px 5px',
                            borderRadius: 4,
                            background: `color-mix(in oklch, ${POT_ACCENT} 15%, transparent)`,
                          }}
                        >
                          Won slot {bid.slot}
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
                      slot {bid.slot} · bet {bid.amount}
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
                        reward > 0 ? POT_ACCENT : reward < 0 ? CURSE_ACCENT : 'var(--po-text-dim)',
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
      )}

      {/* SILVER → GOLD CONVERSION */}
      {silverSpent > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'center',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            background: `color-mix(in oklch, ${POT_ACCENT} 10%, transparent)`,
            border: `1px solid color-mix(in oklch, ${POT_ACCENT} 24%, transparent)`,
            color: POT_ACCENT,
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Sparkle size={12} weight="fill" />
          {silverSpent} silver → gold pool
        </div>
      )}
    </div>
  );
}
