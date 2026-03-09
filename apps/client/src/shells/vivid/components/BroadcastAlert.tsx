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
  gradient: string;
  accentColor: string;
  Icon: React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>;
}

function resolveAlertStyle(category: string): AlertStyle {
  const cat = category.toUpperCase();

  if (cat.includes('ELIMINATION')) {
    return {
      gradient: 'linear-gradient(90deg, rgba(255,46,99,0.15), rgba(255,46,99,0.05))',
      accentColor: 'rgba(255,46,99,0.8)',
      Icon: Danger as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('VOTE') || cat.includes('VOTING')) {
    return {
      gradient: 'linear-gradient(90deg, rgba(255,217,61,0.12), rgba(255,217,61,0.04))',
      accentColor: 'rgba(255,217,61,0.8)',
      Icon: Scale as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('WINNER')) {
    return {
      gradient: 'linear-gradient(90deg, rgba(255,217,61,0.15), rgba(255,217,61,0.05))',
      accentColor: 'rgba(255,217,61,0.8)',
      Icon: Crown as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  if (cat.includes('GAME') || cat.includes('REWARD')) {
    return {
      gradient: 'linear-gradient(90deg, rgba(255,217,61,0.12), rgba(255,217,61,0.04))',
      accentColor: 'rgba(255,217,61,0.8)',
      Icon: CupStar as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
    };
  }

  // Default — teal info style
  return {
    gradient: 'linear-gradient(90deg, rgba(78,205,196,0.1), transparent)',
    accentColor: 'rgba(78,205,196,0.6)',
    Icon: InfoCircle as React.ComponentType<{ size?: number; weight?: string; style?: React.CSSProperties }>,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BroadcastAlert({ message }: BroadcastAlertProps) {
  const { gradient, accentColor, Icon } = resolveAlertStyle(message.category);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={VIVID_SPRING.gentle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 10,
        background: gradient,
        border: `1px solid ${accentColor.replace(/[\d.]+\)$/, '0.15)')}`,
        margin: '4px 0',
      }}
    >
      <Icon size={20} weight="BoldDuotone" style={{ color: accentColor, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 12,
          fontFamily: 'var(--vivid-font-display)',
          letterSpacing: '0.04em',
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
