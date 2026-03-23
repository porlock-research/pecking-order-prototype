import { useState } from 'react';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface AvatarPickerProps {
  eligibleTargets: string[];
  roster: Record<string, SocialPlayer>;
  disabled: boolean;
  confirmedId: string | null;
  accentColor: string;
  confirmLabel: string;
  actionVerb: string;
  onConfirm: (targetId: string) => void;
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

export function AvatarPicker({
  eligibleTargets,
  roster,
  disabled,
  confirmedId,
  accentColor,
  confirmLabel,
  actionVerb,
  onConfirm,
}: AvatarPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const count = eligibleTargets.length;
  const avatarSize = getAvatarSize(count);
  const gap = getGap(count);
  const hasConfirmed = confirmedId !== null;

  // Grid columns for 6-8 targets
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

        // Determine border style
        let borderStyle: string;
        let boxShadow: string | undefined;
        let transform: string | undefined;
        let nameColor: string;
        let containerOpacity: number | undefined;
        let containerFilter: string | undefined;

        if (isConfirmed) {
          borderStyle = '3px solid #2d6a4f';
          nameColor = '#2d6a4f';
        } else if (isSelected) {
          borderStyle = `3px solid ${accentColor}`;
          boxShadow = `0 0 12px ${accentColor}40`;
          transform = 'scale(1.05)';
          nameColor = accentColor;
        } else if (isDimmed) {
          borderStyle = '3px solid rgba(255,255,255,0.04)';
          containerOpacity = 0.3;
          containerFilter = 'grayscale(40%)';
          nameColor = '#9B8E7E';
        } else {
          borderStyle = '3px solid rgba(255,255,255,0.1)';
          nameColor = '#f5f0e8';
        }

        const isInteractive = !disabled && !hasConfirmed;

        return (
          <div
            key={targetId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              opacity: containerOpacity,
              filter: containerFilter,
              transition: 'opacity 0.2s, filter 0.2s, transform 0.2s',
            }}
          >
            {/* Avatar button */}
            <button
              onClick={() => handleTap(targetId)}
              disabled={!isInteractive}
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

              {/* Green checkmark badge for confirmed */}
              {isConfirmed && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#2d6a4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #1a1a1a',
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
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>

            {/* Name */}
            <span
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 11,
                fontWeight: 500,
                color: nameColor,
                textAlign: 'center',
                lineHeight: 1.2,
                transition: 'color 0.2s',
              }}
            >
              {firstName}
            </span>

            {/* Confirm button (selected, not yet confirmed) */}
            {isSelected && (
              <button
                onClick={handleConfirm}
                style={{
                  background: accentColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--vivid-font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {confirmLabel.replace('{name}', firstName)}
              </button>
            )}

            {/* Confirmed text */}
            {isConfirmed && (
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 9,
                  color: '#2d6a4f',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
