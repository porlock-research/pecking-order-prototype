import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { Handshake, Sword, Coins } from '../../../shells/pulse/icons';

const LOCK_IN_MS = 3000;
const TRUST_ACCENT = 'var(--po-green)';
const BETRAY_ACCENT = 'var(--po-pink)';
const POT_ACCENT = 'var(--po-gold)';

type Choice = 'SPLIT' | 'STEAL';

interface SplitInputProps {
  onSubmit: (decision: Record<string, any>) => void;
  opponent: SocialPlayer | undefined;
  potAmount: number;
}

export default function SplitInput({ onSubmit, opponent, potAmount }: SplitInputProps) {
  const [selected, setSelected] = useState<Choice | null>(null);
  const [locking, setLocking] = useState<Choice | null>(null);
  const reduce = useReducedMotion();

  const opponentName = opponent?.personaName ?? 'opponent';
  const opponentFirst = firstName(opponent);

  const handlePick = (choice: Choice) => {
    if (locking) return;
    setSelected((prev) => (prev === choice ? null : choice));
  };

  const handleLockIn = () => {
    if (!selected || locking) return;
    setLocking(selected);
  };

  const handleCancel = () => setLocking(null);

  useEffect(() => {
    if (!locking || !reduce) return;
    const t = setTimeout(() => {
      onSubmit({ action: locking });
      setLocking(null);
    }, LOCK_IN_MS);
    return () => clearTimeout(t);
  }, [locking, reduce, onSubmit]);

  const onLockComplete = () => {
    if (locking) {
      onSubmit({ action: locking });
      setLocking(null);
    }
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
      {/* Opponent + pot */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <PersonaAvatar avatarUrl={opponent?.avatarUrl} personaName={opponentName} size={84} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--po-bg-deep, #15121a)',
              border: '1.5px solid color-mix(in oklch, var(--po-text) 20%, transparent)',
              fontFamily: 'var(--po-font-display)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: 'var(--po-text-dim)',
            }}
          >
            VS YOU
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--po-text)',
            marginTop: 2,
          }}
        >
          {opponentName}
        </div>
        <div
          aria-label={`Pot of ${potAmount} silver`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'color-mix(in oklch, var(--po-gold) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--po-gold) 30%, transparent)',
            color: POT_ACCENT,
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Coins size={16} weight="fill" />
          {potAmount} silver in the pot
        </div>
      </div>

      {/* Question / status */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--po-font-body)',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--po-text-dim)',
        }}
      >
        {locking
          ? 'Tap to undo'
          : selected
            ? 'Lock it in?'
            : 'Share, or take it all?'}
      </div>

      {/* Choice cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ChoiceCard
          icon={<Handshake size={28} weight="fill" />}
          label="Split"
          subline="Share the pot"
          accent={TRUST_ACCENT}
          isSelected={selected === 'SPLIT'}
          isLocking={locking === 'SPLIT'}
          isDimmed={locking !== null && locking !== 'SPLIT'}
          onClick={() => handlePick('SPLIT')}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
        <ChoiceCard
          icon={<Sword size={28} weight="fill" />}
          label="Steal"
          subline={`Take it from ${opponentFirst}`}
          accent={BETRAY_ACCENT}
          isSelected={selected === 'STEAL'}
          isLocking={locking === 'STEAL'}
          isDimmed={locking !== null && locking !== 'STEAL'}
          onClick={() => handlePick('STEAL')}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
      </div>

      {!locking && (
        <motion.button
          initial={false}
          animate={{ opacity: selected ? 1 : 0.5 }}
          transition={{ duration: 0.18 }}
          whileTap={selected && !reduce ? { scale: 0.98 } : undefined}
          onClick={handleLockIn}
          disabled={!selected}
          aria-label={
            selected
              ? `Lock in ${selected}. Starts a 3-second countdown.`
              : 'Pick split or steal first'
          }
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: 14,
            border: 'none',
            background: selected
              ? selected === 'SPLIT'
                ? TRUST_ACCENT
                : BETRAY_ACCENT
              : 'color-mix(in oklch, var(--po-text) 8%, transparent)',
            color: selected ? '#15121a' : 'var(--po-text-dim)',
            fontFamily: 'var(--po-font-display)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: selected ? 'pointer' : 'not-allowed',
            boxShadow: selected
              ? `0 6px 22px color-mix(in oklch, ${selected === 'SPLIT' ? 'var(--po-green)' : 'var(--po-pink)'} 38%, transparent), inset 0 1px 0 color-mix(in oklch, #fff 18%, transparent)`
              : 'none',
            transition: 'background 200ms, color 200ms, box-shadow 200ms',
          }}
        >
          {selected ? `Lock in ${selected}` : 'Pick first'}
        </motion.button>
      )}
    </div>
  );
}

interface ChoiceCardProps {
  icon: React.ReactNode;
  label: string;
  subline: string;
  accent: string;
  isSelected: boolean;
  isLocking: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onCancel: () => void;
  onComplete: () => void;
  reduce: boolean;
}

function ChoiceCard({
  icon,
  label,
  subline,
  accent,
  isSelected,
  isLocking,
  isDimmed,
  onClick,
  onCancel,
  onComplete,
  reduce,
}: ChoiceCardProps) {
  const handleClick = () => {
    if (isLocking) {
      onCancel();
      return;
    }
    if (isDimmed) return;
    onClick();
  };

  const accentBg = isSelected || isLocking;

  return (
    <motion.button
      whileTap={!isDimmed && !reduce ? { scale: 0.97 } : undefined}
      onClick={handleClick}
      aria-label={
        isLocking ? `Locking in ${label}. Tap to undo.` : `Choose ${label}: ${subline}`
      }
      aria-pressed={isSelected || isLocking}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 12px 16px',
        borderRadius: 16,
        border: `2px solid ${accentBg ? accent : 'color-mix(in oklch, var(--po-text) 9%, transparent)'}`,
        background: accentBg
          ? `color-mix(in oklch, ${accent} 8%, var(--po-bg-panel))`
          : 'var(--po-bg-panel)',
        opacity: isDimmed ? 0.5 : 1,
        filter: isDimmed && !reduce ? 'saturate(0.55)' : undefined,
        cursor: isDimmed ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transition: reduce
          ? 'none'
          : 'border-color 200ms, background 200ms, opacity 200ms, filter 200ms, box-shadow 200ms',
        boxShadow:
          isSelected && !isLocking
            ? `0 0 0 1px ${accent}, 0 0 24px color-mix(in oklch, ${accent} 22%, transparent)`
            : 'none',
      }}
    >
      {isLocking && !reduce && (
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
            background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 32%, transparent), color-mix(in oklch, ${accent} 16%, transparent))`,
            zIndex: 0,
          }}
        />
      )}
      {isLocking && reduce && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `color-mix(in oklch, ${accent} 22%, transparent)`,
            zIndex: 0,
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          color: accentBg ? accent : 'var(--po-text-dim)',
          transition: 'color 200ms',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--po-font-display)',
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: accentBg ? accent : 'var(--po-text)',
          transition: 'color 200ms',
        }}
      >
        {isLocking ? 'Locking…' : label}
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--po-text-dim)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {isLocking ? 'tap to undo' : subline}
      </div>
    </motion.button>
  );
}

function firstName(player: SocialPlayer | undefined): string {
  if (!player?.personaName) return '?';
  return player.personaName.split(' ')[0];
}
