import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface AvatarPickerProps {
  eligibleTargets: string[];
  roster: Record<string, SocialPlayer>;
  disabled: boolean;
  confirmedId: string | null;
  /** Accent color — passed by the voting mechanism for themed selection. */
  accentColor: string;
  confirmLabel: string;
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

/**
 * Shell-agnostic avatar picker — renders a grid/flex of tappable personas
 * with selection, confirmation, and dim states. Uses only the --po-* design
 * contract + an injected accentColor so it adopts whichever shell wraps it.
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
  const reduce = useReducedMotion();

  const count = eligibleTargets.length;
  const avatarSize = getAvatarSize(count);
  const gap = getGap(count);
  const hasConfirmed = confirmedId !== null;

  // Grid for 6+ targets; flex-wrap for 5 or fewer.
  const useGrid = count >= 6;
  const gridColumns = useGrid ? 4 : undefined;

  const handleTap = (targetId: string) => {
    if (disabled || hasConfirmed) return;
    setSelectedId((prev) => (prev === targetId ? null : targetId));
  };

  const handleConfirm = () => {
    if (!selectedId || disabled || hasConfirmed) return;
    onConfirm(selectedId);
  };

  return (
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
        const isDimmed = hasConfirmed && !isConfirmed;

        // Border + glow treatment per state — all token-driven so shells
        // theme properly. Confirmed uses --po-green (maps to each shell's
        // affirmative color); selected uses the mechanism's accent.
        let borderStyle: string;
        let boxShadow: string | undefined;
        let transform: string | undefined;
        let nameColor: string;
        let containerOpacity: number | undefined;
        let containerFilter: string | undefined;

        if (isConfirmed) {
          borderStyle = `3px solid var(--po-green, ${accentColor})`;
          boxShadow = `0 0 16px color-mix(in oklch, var(--po-green, ${accentColor}) 35%, transparent)`;
          nameColor = 'var(--po-green, var(--po-text))';
        } else if (isSelected) {
          borderStyle = `3px solid ${accentColor}`;
          boxShadow = `0 0 14px color-mix(in oklch, ${accentColor} 40%, transparent)`;
          transform = reduce ? undefined : 'scale(1.06)';
          nameColor = accentColor;
        } else if (isDimmed) {
          borderStyle = '3px solid var(--po-border, rgba(255,255,255,0.04))';
          containerOpacity = 0.3;
          containerFilter = 'grayscale(40%)';
          nameColor = 'var(--po-text-dim)';
        } else {
          borderStyle = '3px solid var(--po-border, rgba(255,255,255,0.1))';
          nameColor = 'var(--po-text)';
        }

        const isInteractive = !disabled && !hasConfirmed;

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
              transition: 'opacity 0.2s, filter 0.2s, transform 0.2s',
            }}
          >
            {/* Avatar button */}
            <motion.button
              onClick={() => handleTap(targetId)}
              disabled={!isInteractive}
              whileTap={isInteractive && !reduce ? { scale: 0.94 } : undefined}
              {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}-${targetId}` } : {})}
              style={{
                background: 'none',
                padding: 0,
                cursor: isInteractive ? 'pointer' : 'default',
                border: borderStyle,
                borderRadius: '50%',
                boxShadow,
                transform,
                transition: 'border 0.2s, box-shadow 0.2s, transform 0.2s',
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

              {/* Confirmed checkmark badge — pops in after onConfirm. */}
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
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--po-green, #2d6a4f)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--po-bg-panel, #1a1a1a)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                  }}
                >
                  <svg
                    width={10}
                    height={8}
                    viewBox="0 0 10 8"
                    fill="none"
                    style={{ display: 'block' }}
                  >
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.button>

            {/* First name */}
            <span
              style={{
                fontFamily: 'var(--po-font-body)',
                fontSize: 12,
                fontWeight: 600,
                color: nameColor,
                textAlign: 'center',
                lineHeight: 1.2,
                letterSpacing: 0.1,
                transition: 'color 0.2s',
              }}
            >
              {firstName}
            </span>

            {/* Confirm button — appears only while selected + unconfirmed. */}
            {isSelected && (
              <motion.button
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.92 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.92 }}
                transition={{ duration: 0.2, ease: [0.2, 0.9, 0.3, 1] }}
                whileTap={reduce ? undefined : { scale: 0.95 }}
                onClick={handleConfirm}
                data-testid="vote-confirm-btn"
                style={{
                  background: accentColor,
                  color: 'var(--po-text-inverted, #fff)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontFamily: 'var(--po-font-body)',
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 2px 10px color-mix(in oklch, ${accentColor} 40%, transparent)`,
                }}
              >
                {confirmLabel.replace('{name}', firstName)}
              </motion.button>
            )}

            {/* Confirmed state copy — replaces the confirm button. */}
            {isConfirmed && (
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 10,
                  color: 'var(--po-green, var(--po-text-dim))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                }}
              >
                You {actionVerb} {firstName}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
