import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PULSE_SPRING } from '../../../shells/pulse/springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

const LOCK_IN_MS = 3000;

interface AvatarPickerProps {
  eligibleTargets: string[];
  roster: Record<string, SocialPlayer>;
  disabled: boolean;
  confirmedId: string | null;
  /** Accent color — passed by the voting mechanism for themed selection. */
  accentColor: string;
  /** "Save {name}?" template. {name} replaced at render; the "?" is stripped for the CTA. */
  confirmLabel: string;
  /** "saved" / "voted for" / "trusted" — used in the confirmed-state copy. */
  actionVerb: string;
  onConfirm: (targetId: string) => void;
  /** Optional prefix for data-testid attributes on each avatar button. */
  testIdPrefix?: string;
}

function getFirstName(personaName: string | undefined): string {
  if (!personaName) return '?';
  return personaName.split(' ')[0];
}

function getAvatarSize(count: number): number {
  if (count <= 3) return 64;
  if (count <= 5) return 56;
  return 48;
}

function getGap(count: number): number {
  if (count <= 3) return 16;
  return 10;
}

/** "Save {name}?" → "Save" */
function getVerb(confirmLabel: string): string {
  return confirmLabel.replace('{name}', '').replace('?', '').trim();
}

/**
 * Shell-agnostic avatar picker with a docked lock-in footer.
 *
 * Flow:
 *   1. Tap avatar → selected (accent border, scale-up).
 *   2. Tap footer Confirm → enters 3-second lock-in countdown.
 *   3. Tap anywhere on the countdown bar → cancel, back to selected.
 *   4. Countdown completes → `onConfirm(selectedId)` fires.
 *
 * Designed for teen players on mobile who mis-tap. The 3s undo window is
 * critical — social deduction relies on reconsidering when a bombshell
 * drops right before lock-in.
 */
export function AvatarPicker({
  eligibleTargets,
  roster,
  disabled,
  confirmedId,
  accentColor,
  confirmLabel,
  actionVerb,
  onConfirm,
  testIdPrefix,
}: AvatarPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const reduce = useReducedMotion();

  const count = eligibleTargets.length;
  const avatarSize = getAvatarSize(count);
  const gap = getGap(count);
  const hasConfirmed = confirmedId !== null;

  const useGrid = count >= 6;
  const gridColumns = useGrid ? 4 : undefined;

  const selectedPlayer = selectedId ? roster[selectedId] : null;
  const confirmedPlayer = confirmedId ? roster[confirmedId] : null;

  // Cancel locking if selection clears or parent flags disabled/confirmed mid-flight.
  useEffect(() => {
    if (locking && (!selectedId || disabled || hasConfirmed)) {
      setLocking(false);
    }
  }, [locking, selectedId, disabled, hasConfirmed]);

  const handleTap = (targetId: string) => {
    if (disabled || hasConfirmed || locking) return;
    setSelectedId((prev) => (prev === targetId ? null : targetId));
  };

  const startLockIn = () => {
    if (!selectedId || disabled || hasConfirmed || locking) return;
    setLocking(true);
  };

  const cancelLockIn = () => setLocking(false);

  const completeLockIn = () => {
    const id = selectedId;
    setLocking(false);
    if (id) onConfirm(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: useGrid ? 'grid' : 'flex',
          ...(useGrid
            ? {
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                gap,
                justifyItems: 'center',
              }
            : {
                flexWrap: 'wrap' as const,
                justifyContent: 'center',
                gap,
              }),
        }}
      >
        {eligibleTargets.map((targetId) => {
          const player = roster[targetId];
          const firstName = getFirstName(player?.personaName);
          const isSelected = selectedId === targetId && !hasConfirmed;
          const isConfirmed = confirmedId === targetId;
          const isDimmed = (hasConfirmed && !isConfirmed) || (locking && !isSelected);

          let borderStyle: string;
          let boxShadow: string | undefined;
          let transform: string | undefined;
          let nameColor: string;
          let containerOpacity: number | undefined;
          let containerFilter: string | undefined;

          if (isConfirmed) {
            borderStyle = `3px solid var(--po-green, ${accentColor})`;
            boxShadow = `0 0 18px color-mix(in oklch, var(--po-green, ${accentColor}) 40%, transparent)`;
            nameColor = 'var(--po-green, var(--po-text))';
          } else if (isSelected) {
            borderStyle = `3px solid ${accentColor}`;
            boxShadow = `0 0 18px color-mix(in oklch, ${accentColor} 45%, transparent)`;
            transform = reduce ? undefined : 'scale(1.08)';
            nameColor = accentColor;
          } else if (isDimmed) {
            borderStyle = '3px solid color-mix(in oklch, var(--po-text) 6%, transparent)';
            containerOpacity = 0.3;
            containerFilter = 'grayscale(40%)';
            nameColor = 'var(--po-text-dim)';
          } else {
            borderStyle = '3px solid color-mix(in oklch, var(--po-text) 10%, transparent)';
            nameColor = 'var(--po-text)';
          }

          const isInteractive = !disabled && !hasConfirmed && !locking;

          return (
            <div
              key={targetId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                opacity: containerOpacity,
                filter: containerFilter,
                transition: reduce
                  ? 'none'
                  : 'opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease',
              }}
            >
              <motion.button
                onClick={() => handleTap(targetId)}
                disabled={!isInteractive}
                whileTap={isInteractive && !reduce ? { scale: 0.94 } : undefined}
                aria-label={
                  isConfirmed
                    ? `You ${actionVerb} ${player?.personaName ?? firstName}`
                    : `Pick ${player?.personaName ?? firstName}`
                }
                aria-pressed={isSelected || isConfirmed}
                {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}-${targetId}` } : {})}
                style={{
                  background: 'none',
                  padding: 0,
                  cursor: isInteractive ? 'pointer' : 'default',
                  border: borderStyle,
                  borderRadius: '50%',
                  boxShadow,
                  transform,
                  transition: reduce
                    ? 'none'
                    : 'border 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={avatarSize}
                />

                {isConfirmed && (
                  <motion.div
                    initial={reduce ? { scale: 1 } : { scale: 0 }}
                    animate={reduce ? { scale: 1 } : { scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--po-green, #2d6a4f)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--po-bg-panel, #1a1a1a)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <svg width={11} height={9} viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 600,
                  color: nameColor,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  letterSpacing: 0.1,
                  transition: reduce ? 'none' : 'color 0.2s ease',
                }}
              >
                {firstName}
              </span>
            </div>
          );
        })}
      </div>

      {/* Docked footer — lock-in CTA, countdown, or confirmed receipt. */}
      <LockInFooter
        state={
          confirmedPlayer
            ? 'confirmed'
            : locking && selectedPlayer
              ? 'locking'
              : selectedPlayer
                ? 'selected'
                : 'idle'
        }
        selectedPlayer={selectedPlayer}
        confirmedPlayer={confirmedPlayer}
        accentColor={accentColor}
        confirmLabel={confirmLabel}
        actionVerb={actionVerb}
        disabled={disabled}
        onLockIn={startLockIn}
        onCancel={cancelLockIn}
        onComplete={completeLockIn}
        reduce={!!reduce}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Footer CTA — 4 states                                              */
/* ------------------------------------------------------------------ */

interface LockInFooterProps {
  state: 'idle' | 'selected' | 'locking' | 'confirmed';
  selectedPlayer: SocialPlayer | null;
  confirmedPlayer: SocialPlayer | null;
  accentColor: string;
  confirmLabel: string;
  actionVerb: string;
  disabled: boolean;
  onLockIn: () => void;
  onCancel: () => void;
  onComplete: () => void;
  reduce: boolean;
}

function LockInFooter(props: LockInFooterProps) {
  const { state } = props;
  return (
    <div style={{ minHeight: 52, position: 'relative' }}>
      <AnimatePresence mode="wait" initial={false}>
        {state === 'idle' && <IdleFooter key="idle" />}
        {state === 'selected' && <SelectedFooter key="selected" {...props} />}
        {state === 'locking' && <LockingFooter key="locking" {...props} />}
        {state === 'confirmed' && <ConfirmedFooter key="confirmed" {...props} />}
      </AnimatePresence>
    </div>
  );
}

function IdleFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 14,
        border: '1px dashed color-mix(in oklch, var(--po-text) 16%, transparent)',
        fontFamily: 'var(--po-font-display)',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.18em',
        color: 'var(--po-text-dim)',
        textTransform: 'uppercase',
      }}
    >
      Tap a player to pick
    </motion.div>
  );
}

function SelectedFooter({
  selectedPlayer,
  accentColor,
  confirmLabel,
  disabled,
  onLockIn,
  reduce,
}: LockInFooterProps) {
  if (!selectedPlayer) return null;
  const firstName = getFirstName(selectedPlayer.personaName);
  const verb = getVerb(confirmLabel);

  return (
    <motion.button
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ type: 'spring', ...PULSE_SPRING.snappy }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      onClick={onLockIn}
      disabled={disabled}
      data-testid="vote-confirm-btn"
      aria-label={`${verb} ${selectedPlayer.personaName ?? firstName}. Starts a 3-second lock-in.`}
      style={{
        width: '100%',
        minHeight: 52,
        borderRadius: 14,
        border: 'none',
        background: accentColor,
        color: 'var(--po-text-inverted, #fff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 16px',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--po-font-display)',
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.3,
        boxShadow: `0 6px 22px color-mix(in oklch, ${accentColor} 40%, transparent), inset 0 1px 0 color-mix(in oklch, #fff 16%, transparent)`,
      }}
    >
      <PersonaAvatar
        avatarUrl={selectedPlayer.avatarUrl}
        personaName={selectedPlayer.personaName}
        size={32}
      />
      <span style={{ textTransform: 'none' }}>
        {verb} {firstName}
      </span>
    </motion.button>
  );
}

function LockingFooter({
  selectedPlayer,
  accentColor,
  confirmLabel,
  onCancel,
  onComplete,
  reduce,
}: LockInFooterProps) {
  if (!selectedPlayer) return null;
  const firstName = getFirstName(selectedPlayer.personaName);
  const verb = getVerb(confirmLabel);

  // Fallback timer for reduced-motion users (no CSS animation onAnimationComplete).
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!reduce) return;
    timeoutRef.current = setTimeout(() => onComplete(), LOCK_IN_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reduce, onComplete]);

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={LOCK_IN_MS}
      aria-valuenow={0}
      aria-label={`Locking in ${verb} ${firstName}. Tap to undo.`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: 52,
        borderRadius: 14,
        border: `2px solid ${accentColor}`,
        background: 'var(--po-bg-panel, rgba(0,0,0,0.35))',
        color: 'var(--po-text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--po-font-display)',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {/* Progress fill — accent color sweeps left→right over LOCK_IN_MS. */}
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
            background: `linear-gradient(90deg, ${accentColor}, color-mix(in oklch, ${accentColor} 65%, transparent))`,
            opacity: 0.9,
            zIndex: 0,
          }}
        />
      )}
      {/* Reduced-motion: static filled accent bg, the timeout handles completion. */}
      {reduce && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `color-mix(in oklch, ${accentColor} 40%, transparent)`,
          }}
        />
      )}
      <span
        style={{
          position: 'relative',
          zIndex: 2,
          color: 'var(--po-text-inverted, #fff)',
          mixBlendMode: 'normal',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
        }}
      >
        Locking in \u00b7 tap to undo
      </span>
    </motion.button>
  );
}

function ConfirmedFooter({
  confirmedPlayer,
  accentColor,
  actionVerb,
}: LockInFooterProps) {
  if (!confirmedPlayer) return null;
  const firstName = getFirstName(confirmedPlayer.personaName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', ...PULSE_SPRING.gentle }}
      data-testid="vote-confirmed"
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        minHeight: 52,
        borderRadius: 14,
        background: `color-mix(in oklch, var(--po-green, ${accentColor}) 14%, var(--po-bg-panel, rgba(0,0,0,0.3)))`,
        border: `1px solid color-mix(in oklch, var(--po-green, ${accentColor}) 40%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 16px',
        fontFamily: 'var(--po-font-display)',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--po-green, var(--po-text))',
      }}
    >
      <PersonaAvatar
        avatarUrl={confirmedPlayer.avatarUrl}
        personaName={confirmedPlayer.personaName}
        size={28}
      />
      <span>
        You {actionVerb} <span style={{ color: 'var(--po-text)' }}>{firstName}</span>
      </span>
    </motion.div>
  );
}
