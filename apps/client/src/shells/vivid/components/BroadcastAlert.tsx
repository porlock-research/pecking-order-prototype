import React from 'react';
import { motion } from 'framer-motion';
import { Danger, Scale, CupStar, Crown, InfoCircle } from '@solar-icons/react';
import { VIVID_SPRING } from '../springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BroadcastAlertProps {
  message: { id: string; category: string; text: string; timestamp: number };
}

/* ------------------------------------------------------------------ */
/*  Style resolution                                                   */
/* ------------------------------------------------------------------ */

interface AlertStyle {
  bgColor: string;
  borderColor: string;
  accentColor: string;
  Icon: React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>;
}

function resolveAlertStyle(category: string): AlertStyle {
  const cat = category.toUpperCase();

  if (cat.includes('ELIMINATION')) {
    return {
      bgColor: '#FDE8E4',
      borderColor: '#E8614D',
      accentColor: '#D94053',
      Icon: Danger as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('VOTE') || cat.includes('VOTING')) {
    return {
      bgColor: '#FFF3D6',
      borderColor: '#E89B3A',
      accentColor: '#D4960A',
      Icon: Scale as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('WINNER')) {
    return {
      bgColor: '#FFF8E1',
      borderColor: '#D4960A',
      accentColor: '#D4960A',
      Icon: Crown as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('GAME') || cat.includes('REWARD')) {
    return {
      bgColor: '#E6F5EF',
      borderColor: '#3BA99C',
      accentColor: '#3BA99C',
      Icon: CupStar as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  // Default — warm sage info style
  return {
    bgColor: '#F0F5EE',
    borderColor: '#6B9E6E',
    accentColor: '#6B9E6E',
    Icon: InfoCircle as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BroadcastAlert({ message }: BroadcastAlertProps) {
  const { bgColor, borderColor, accentColor, Icon } = resolveAlertStyle(message.category);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={VIVID_SPRING.bouncy}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 18,
        background: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 3px 12px rgba(139, 115, 85, 0.12)`,
        margin: '6px 0',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: `${accentColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} weight="BoldDuotone" style={{ color: accentColor }} />
      </div>
      <span
        style={{
          fontSize: 14,
          fontFamily: 'var(--vivid-font-display)',
          fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--vivid-text)',
          lineHeight: 1.4,
        }}
      >
        {message.text}
      </span>
    </motion.div>
  );
}
