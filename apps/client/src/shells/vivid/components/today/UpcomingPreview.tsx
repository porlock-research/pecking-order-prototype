// apps/client/src/shells/vivid/components/today/UpcomingPreview.tsx
import { motion } from 'framer-motion';
import { Scale, Gamepad, MagicStick3, HandMoney, CupStar } from '@solar-icons/react';
import { VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';
import { useActivityCountdown } from '../../../../hooks/useActivityCountdown';

interface UpcomingPreviewProps {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  typeKey: string;
  startsAt?: number;
}

const KIND_LABELS: Record<string, string> = {
  voting: 'Vote', game: 'Mini-Game', prompt: 'Activity', dilemma: 'Dilemma',
};

const KIND_COLORS: Record<string, string> = {
  voting: '#E89B3A', game: '#3BA99C', prompt: '#8B6CC1', dilemma: '#CF864B',
};

function getIcon(kind: string, typeKey: string) {
  if (kind === 'voting' && typeKey === 'FINALS') return CupStar;
  switch (kind) {
    case 'voting': return Scale;
    case 'game': return Gamepad;
    case 'prompt': return MagicStick3;
    case 'dilemma': return HandMoney;
    default: return Scale;
  }
}

function getTypeInfo(kind: string, typeKey: string): { name: string; description: string } {
  const map =
    kind === 'voting' ? VOTE_TYPE_INFO :
    kind === 'game' ? GAME_TYPE_INFO :
    kind === 'prompt' ? ACTIVITY_TYPE_INFO :
    DILEMMA_TYPE_INFO;
  const info = (map as Record<string, { name: string; oneLiner?: string; description?: string }>)[typeKey];
  return {
    name: info?.name || typeKey,
    description: info?.oneLiner || info?.description || '',
  };
}

export function UpcomingPreview({ kind, typeKey, startsAt }: UpcomingPreviewProps) {
  const countdown = useActivityCountdown(startsAt);
  const Icon = getIcon(kind, typeKey);
  const color = KIND_COLORS[kind] || '#888';
  const { name, description } = getTypeInfo(kind, typeKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        background: 'var(--vivid-bg-surface)',
        borderRadius: 14,
        border: '1px solid var(--vivid-border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} weight="Bold" style={{ color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.5, color: 'var(--vivid-text-muted)',
            }}>
              {KIND_LABELS[kind]}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'var(--vivid-text)',
            }}>
              {name}
            </span>
          </div>
          {countdown && (
            <span style={{
              fontSize: 12, color, fontWeight: 600,
              fontFamily: 'var(--vivid-font-mono)',
            }}>
              {countdown}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 0.5, color: 'var(--vivid-text-muted)',
          background: 'var(--vivid-bg-inset)',
          padding: '3px 8px', borderRadius: 6,
        }}>
          Upcoming
        </span>
      </div>

      {/* Description */}
      {description && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--vivid-text-muted)',
        }}>
          {description}
        </div>
      )}
    </motion.div>
  );
}
