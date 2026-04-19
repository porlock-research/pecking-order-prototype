import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import {
  Crown,
  Sword,
  ShieldCheck,
  Vault,
  Coins,
} from '../../../shells/pulse/icons';

const LOCK_IN_MS = 3000;
const STEAL_ACCENT = 'var(--po-pink)';
const PROTECT_ACCENT = 'var(--po-green)';
const VAULT_ACCENT = 'var(--po-gold)';

interface KingsRansomProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function KingsRansom(props: KingsRansomProps) {
  const kingId = props.cartridge.kingId as string | undefined;
  const vaultAmount = (props.cartridge.vaultAmount as number | undefined) ?? 0;
  const king = kingId ? props.roster[kingId] : undefined;

  return (
    <SyncDecisionWrapper
      {...props}
      renderDecisionInput={({ onSubmit }) => (
        <RansomInput onSubmit={onSubmit} king={king} vaultAmount={vaultAmount} />
      )}
      renderReveal={({ decisions, results, roster, playerId }) => (
        <RansomReveal
          decisions={decisions}
          results={results}
          roster={roster}
          playerId={playerId}
        />
      )}
    />
  );
}

/* ================ INPUT ================ */

type Choice = 'STEAL' | 'PROTECT';

function RansomInput({
  onSubmit,
  king,
  vaultAmount,
}: {
  onSubmit: (d: Record<string, any>) => void;
  king: SocialPlayer | undefined;
  vaultAmount: number;
}) {
  const [selected, setSelected] = useState<Choice | null>(null);
  const [locking, setLocking] = useState<Choice | null>(null);
  const reduce = useReducedMotion();
  const kingName = king?.personaName ?? 'The King';
  const kingFirst = firstNameOf(king);

  const handlePick = (choice: Choice) => {
    if (locking) return;
    setSelected((prev) => (prev === choice ? null : choice));
  };

  const handleLockIn = () => {
    if (!selected || locking) return;
    setLocking(selected);
  };

  const handleCancel = () => setLocking(null);

  // Reduced-motion fallback timer (no spring animation to listen for completion).
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
        gap: 22,
        padding: '8px 4px 16px',
      }}
    >
      {/* King at stake */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative' }}>
          <PersonaAvatar avatarUrl={king?.avatarUrl} personaName={kingName} size={88} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -8,
              right: -10,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: VAULT_ACCENT,
              border: '2px solid var(--po-bg-deep, #15121a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px color-mix(in oklch, var(--po-gold) 45%, transparent)',
            }}
          >
            <Crown size={20} weight="fill" color="#15121a" />
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--po-text)',
          }}
        >
          {kingName}
        </div>
        <div
          aria-label={`The vault holds ${vaultAmount} silver`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'color-mix(in oklch, var(--po-gold) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--po-gold) 30%, transparent)',
            color: VAULT_ACCENT,
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Vault size={16} weight="fill" />
          {vaultAmount} silver in the vault
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
            : `Will you side with ${kingFirst}?`}
      </div>

      {/* Choice cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ChoiceCard
          icon={<Sword size={28} weight="fill" />}
          label="Steal"
          subline="Take a share"
          accent={STEAL_ACCENT}
          isSelected={selected === 'STEAL'}
          isLocking={locking === 'STEAL'}
          isDimmed={locking !== null && locking !== 'STEAL'}
          onClick={() => handlePick('STEAL')}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
        <ChoiceCard
          icon={<ShieldCheck size={28} weight="fill" />}
          label="Protect"
          subline={`Stand with ${kingFirst}`}
          accent={PROTECT_ACCENT}
          isSelected={selected === 'PROTECT'}
          isLocking={locking === 'PROTECT'}
          isDimmed={locking !== null && locking !== 'PROTECT'}
          onClick={() => handlePick('PROTECT')}
          onCancel={handleCancel}
          onComplete={onLockComplete}
          reduce={!!reduce}
        />
      </div>

      {/* Confirm CTA — hidden during locking (the locking card itself is the progress). */}
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
              : 'Pick steal or protect first'
          }
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: 14,
            border: 'none',
            background: selected
              ? selected === 'STEAL'
                ? STEAL_ACCENT
                : PROTECT_ACCENT
              : 'color-mix(in oklch, var(--po-text) 8%, transparent)',
            color: selected ? '#15121a' : 'var(--po-text-dim)',
            fontFamily: 'var(--po-font-display)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: selected ? 'pointer' : 'not-allowed',
            boxShadow: selected
              ? `0 6px 22px color-mix(in oklch, ${selected === 'STEAL' ? 'var(--po-pink)' : 'var(--po-green)'} 38%, transparent), inset 0 1px 0 color-mix(in oklch, #fff 18%, transparent)`
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
      {/* Locking countdown fill */}
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
      {/* Reduced-motion: static accent tint while the parent timer counts down. */}
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

/* ================ REVEAL ================ */

function RansomReveal({
  results,
  roster,
  playerId,
}: {
  decisions: Record<string, any>;
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}) {
  const summary = results.summary as Record<string, any>;
  const kingId = summary.kingId as string;
  const outcome = summary.outcome as 'PROTECT_WINS' | 'STEAL_WINS' | 'TIE';
  const stealers = (summary.stealers as string[]) ?? [];
  const protectors = (summary.protectors as string[]) ?? [];
  const shieldWinnerId = (summary.shieldWinnerId as string | null) ?? null;
  const reduce = useReducedMotion();

  const king = roster[kingId];
  const kingName = king?.personaName ?? 'The King';
  const kingFirst = firstNameOf(king);
  const kingReward = results.silverRewards[kingId] ?? 0;
  const isKing = playerId === kingId;
  const dethroned = outcome === 'STEAL_WINS';

  const heroWord =
    outcome === 'PROTECT_WINS'
      ? 'GUARDED'
      : outcome === 'STEAL_WINS'
        ? 'RAIDED'
        : 'STANDOFF';

  const heroAccent =
    outcome === 'PROTECT_WINS'
      ? PROTECT_ACCENT
      : outcome === 'STEAL_WINS'
        ? STEAL_ACCENT
        : 'var(--po-text-dim)';

  const moodLine =
    outcome === 'PROTECT_WINS'
      ? isKing
        ? 'You kept the throne'
        : `${kingFirst} kept the throne`
      : outcome === 'STEAL_WINS'
        ? isKing
          ? 'You were overthrown'
          : `${kingFirst} was overthrown`
        : 'Nobody gained ground';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '4px 4px 12px',
      }}
    >
      {/* HERO WORD */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', ...PULSE_SPRING.snappy }}
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          role="status"
          aria-label={`${heroWord}. ${moodLine}`}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(48px, 13vw, 72px)',
            fontWeight: 900,
            letterSpacing: '0.04em',
            lineHeight: 0.95,
            color: heroAccent,
            textShadow: `0 0 40px color-mix(in oklch, ${heroAccent} 30%, transparent)`,
          }}
        >
          {heroWord}
        </div>
        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--po-text-dim)',
            letterSpacing: '0.02em',
          }}
        >
          {moodLine}
        </div>
      </motion.div>

      {/* KING HERO */}
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
          background: dethroned
            ? `linear-gradient(180deg, color-mix(in oklch, ${STEAL_ACCENT} 6%, transparent), transparent)`
            : `linear-gradient(180deg, color-mix(in oklch, ${VAULT_ACCENT} 8%, transparent), transparent)`,
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              opacity: dethroned ? 0.55 : 1,
              filter: dethroned && !reduce ? 'grayscale(40%)' : undefined,
              transition: 'opacity 250ms, filter 250ms',
            }}
          >
            <PersonaAvatar avatarUrl={king?.avatarUrl} personaName={kingName} size={104} />
          </div>
          {/* Crown badge — bright if guarded, tipped & dimmed if dethroned */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: dethroned ? -2 : -10,
              right: dethroned ? -16 : -10,
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: dethroned
                ? 'color-mix(in oklch, var(--po-text) 14%, var(--po-bg-panel))'
                : VAULT_ACCENT,
              border: '2px solid var(--po-bg-deep, #15121a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: dethroned
                ? 'none'
                : `0 6px 22px color-mix(in oklch, ${VAULT_ACCENT} 50%, transparent)`,
              transform: dethroned ? 'rotate(-22deg)' : 'none',
              transition: 'transform 280ms, background 250ms, box-shadow 250ms',
            }}
          >
            <Crown size={20} weight="fill" color={dethroned ? '#75707f' : '#15121a'} />
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: dethroned ? 'var(--po-text-dim)' : 'var(--po-text)',
            letterSpacing: '-0.01em',
          }}
        >
          {kingName}
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
            color:
              kingReward > 0
                ? PROTECT_ACCENT
                : kingReward < 0
                  ? STEAL_ACCENT
                  : 'var(--po-text-dim)',
          }}
        >
          <Coins size={13} weight="fill" />
          {kingReward >= 0 ? '+' : ''}
          {kingReward} silver
          {shieldWinnerId === kingId && (
            <span
              style={{
                marginLeft: 4,
                padding: '2px 6px',
                borderRadius: 6,
                background: `color-mix(in oklch, ${VAULT_ACCENT} 22%, transparent)`,
                color: VAULT_ACCENT,
                fontSize: 10,
                letterSpacing: '0.1em',
              }}
            >
              SHIELD
            </span>
          )}
        </div>
      </motion.div>

      {/* FACTION LISTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FactionList
          label="Stolen by"
          accent={STEAL_ACCENT}
          icon={<Sword size={14} weight="fill" />}
          ids={stealers}
          rewards={results.silverRewards}
          roster={roster}
          playerId={playerId}
          shieldWinnerId={shieldWinnerId}
        />
        <FactionList
          label="Defended by"
          accent={PROTECT_ACCENT}
          icon={<ShieldCheck size={14} weight="fill" />}
          ids={protectors}
          rewards={results.silverRewards}
          roster={roster}
          playerId={playerId}
          shieldWinnerId={shieldWinnerId}
        />
      </div>
    </div>
  );
}

interface FactionListProps {
  label: string;
  accent: string;
  icon: React.ReactNode;
  ids: string[];
  rewards: Record<string, number>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
  shieldWinnerId: string | null;
}

function FactionList({
  label,
  accent,
  icon,
  ids,
  rewards,
  roster,
  playerId,
  shieldWinnerId,
}: FactionListProps) {
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--po-font-display)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: accent,
  };

  if (ids.length === 0) {
    return (
      <div style={headerStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: accent }}>
          {icon}
          {label} no one
        </span>
      </div>
    );
  }

  // Per-person reward — assume even split inside a faction; sample first.
  const sample = ids.find((id) => rewards[id] !== undefined);
  const perPerson = sample !== undefined ? (rewards[sample] ?? 0) : 0;
  const names = ids.map((id) => firstNameOf(roster[id]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={headerStyle}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: accent,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {icon}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {label} {joinNames(names)}
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: perPerson > 0 ? accent : 'var(--po-text-dim)',
            letterSpacing: 0,
            textTransform: 'none',
            flexShrink: 0,
          }}
        >
          {perPerson >= 0 ? '+' : ''}
          {perPerson} ea
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {ids.map((id) => {
          const player = roster[id];
          const isMe = id === playerId;
          const hasShield = shieldWinnerId === id;
          return (
            <div
              key={id}
              title={player?.personaName ?? id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
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
                    size={36}
                  />
                </div>
                {hasShield && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: VAULT_ACCENT,
                      border: '1.5px solid var(--po-bg-deep, #15121a)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheck size={9} weight="fill" color="#15121a" />
                  </div>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 11,
                  fontWeight: isMe ? 700 : 500,
                  color: isMe ? accent : 'var(--po-text-dim)',
                  lineHeight: 1.1,
                  maxWidth: 56,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {firstNameOf(player)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================ helpers ================ */

function firstNameOf(player: SocialPlayer | undefined): string {
  if (!player?.personaName) return '?';
  return player.personaName.split(' ')[0];
}

function joinNames(names: string[]): string {
  if (names.length === 0) return 'no one';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`;
}
