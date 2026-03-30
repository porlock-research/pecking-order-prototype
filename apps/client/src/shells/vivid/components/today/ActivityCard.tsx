import React from 'react';
import { motion } from 'framer-motion';
import {
  VOTE_TYPE_INFO,
  GAME_TYPE_INFO,
  ACTIVITY_TYPE_INFO,
  DILEMMA_TYPE_INFO,
} from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import {
  Scale, Gamepad, MagicStick3, HandMoney, CupStar,
  CheckCircle, AltArrowRight, PlayCircle,
} from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../../springs';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ActivityCardProps {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  typeKey: string;
  state: 'upcoming' | 'live' | 'completed';
  countdown?: string | null;
  summaryLine?: string;
  onTap: () => void;
  /** For upcoming cards further in the future, reduce opacity further */
  upcomingIndex?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTypeInfo(kind: ActivityCardProps['kind'], typeKey: string) {
  switch (kind) {
    case 'voting': {
      const info = VOTE_TYPE_INFO[typeKey as VoteType];
      return info
        ? { name: info.name, description: info.oneLiner, icon: typeKey === 'FINALS' ? CupStar : Scale }
        : { name: typeKey, description: '', icon: Scale };
    }
    case 'game': {
      const info = GAME_TYPE_INFO[typeKey as Exclude<GameType, 'NONE'>];
      return info
        ? { name: info.name, description: info.description, icon: Gamepad }
        : { name: typeKey, description: '', icon: Gamepad };
    }
    case 'prompt': {
      const info = ACTIVITY_TYPE_INFO[typeKey as PromptType];
      return info
        ? { name: info.name, description: info.description, icon: MagicStick3 }
        : { name: typeKey, description: '', icon: MagicStick3 };
    }
    case 'dilemma': {
      const info = DILEMMA_TYPE_INFO[typeKey as DilemmaType];
      return info
        ? { name: info.name, description: info.description, icon: HandMoney }
        : { name: typeKey, description: '', icon: HandMoney };
    }
  }
}

const KIND_LABELS: Record<ActivityCardProps['kind'], string> = {
  voting: 'Vote',
  game: 'Mini-Game',
  prompt: 'Activity',
  dilemma: 'Dilemma',
};

const KIND_COLORS: Record<ActivityCardProps['kind'], string> = {
  voting: '#E89B3A',
  game: '#3BA99C',
  prompt: '#8B6CC1',
  dilemma: '#CF864B',
};

function getCta(kind: ActivityCardProps['kind']): string {
  switch (kind) {
    case 'voting': return 'Cast Your Vote';
    case 'game': return 'Play Now';
    case 'prompt': return 'Respond';
    case 'dilemma': return 'Decide';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ActivityCard({
  kind,
  typeKey,
  state: cardState,
  countdown,
  summaryLine,
  onTap,
  upcomingIndex = 0,
}: ActivityCardProps) {
  const { name, description, icon: Icon } = getTypeInfo(kind, typeKey);
  const color = KIND_COLORS[kind];
  const label = KIND_LABELS[kind];

  /* ---- Completed card ---- */
  if (cardState === 'completed') {
    return (
      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={VIVID_SPRING.gentle}
        whileTap={VIVID_TAP.card}
        onClick={onTap}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--vivid-bg-warm, rgba(245,240,232,0.6))',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <CheckCircle size={18} weight="Bold" color="#6B9E6E" />
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--vivid-text-dim, #9B8E7E)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summaryLine || name}
        </span>
        <span
          style={{
            fontFamily: 'var(--vivid-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: '#6B9E6E',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(107, 158, 110, 0.1)',
            flexShrink: 0,
          }}
        >
          Done
        </span>
        <AltArrowRight size={14} weight="Bold" color="var(--vivid-text-dim, #9B8E7E)" />
      </motion.button>
    );
  }

  /* ---- Live card ---- */
  if (cardState === 'live') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={VIVID_SPRING.gentle}
        style={{
          borderRadius: 16,
          padding: '16px 18px',
          border: `2px solid var(--vivid-phase-accent, ${color})`,
          background: 'var(--vivid-bg-deep, #FAF6EF)',
          boxShadow: '0 0 20px rgba(196,166,106,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={20} weight="Bold" color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 9,
                  fontWeight: 800,
                  color: color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 8,
                  fontWeight: 800,
                  color: '#FAF6EF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: color,
                  flexShrink: 0,
                }}
              >
                LIVE
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--vivid-text-base, #3D2E1F)',
                letterSpacing: '0.01em',
              }}
            >
              {name}
            </span>
          </div>
          {countdown && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--vivid-text-dim, #9B8E7E)',
                flexShrink: 0,
              }}
            >
              {countdown}
            </span>
          )}
        </div>

        {/* Description */}
        <p
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--vivid-font-body, sans-serif)',
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--vivid-text-dim, #5A4A3A)',
          }}
        >
          {description}
        </p>

        {/* CTA button */}
        <motion.button
          whileTap={VIVID_TAP.button}
          onClick={onTap}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: color,
            cursor: 'pointer',
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 14,
            fontWeight: 800,
            color: '#FAF6EF',
            letterSpacing: '0.02em',
          }}
        >
          {getCta(kind)}
          <PlayCircle size={16} weight="Bold" color="#FAF6EF" />
        </motion.button>
      </motion.div>
    );
  }

  /* ---- Upcoming card ---- */
  const upcomingOpacity = upcomingIndex === 0 ? 0.6 : 0.45;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: upcomingOpacity, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        borderRadius: 14,
        padding: '12px 14px',
        background: 'var(--vivid-bg-warm, rgba(245,240,232,0.4))',
        border: '1px solid rgba(155, 142, 126, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `${color}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} weight="Bold" color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 9,
              fontWeight: 800,
              color: color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'block',
              marginBottom: 1,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--vivid-text-base, #3D2E1F)',
            }}
          >
            {name}
          </span>
        </div>
        {countdown && (
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--vivid-text-dim, #9B8E7E)',
              flexShrink: 0,
            }}
          >
            {countdown}
          </span>
        )}
      </div>
      {/* Description only for the next-up card */}
      {upcomingIndex === 0 && description && (
        <p
          style={{
            margin: '6px 0 0 40px',
            fontFamily: 'var(--vivid-font-body, sans-serif)',
            fontSize: 12,
            lineHeight: 1.4,
            color: 'var(--vivid-text-dim, #7A6E60)',
          }}
        >
          {description}
        </p>
      )}
    </motion.div>
  );
}
