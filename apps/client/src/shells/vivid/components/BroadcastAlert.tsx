import React from 'react';
import { motion } from 'framer-motion';

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
  label: string;
}

function resolveAlertStyle(category: string): AlertStyle {
  const cat = category.toUpperCase();

  if (cat.includes('ELIMINATION')) {
    return {
      bgColor: '#FDE8E4',
      borderColor: '#E8614D',
      accentColor: '#D94053',
      label: 'ELIMINATED',
    };
  }

  if (cat.includes('VOTE') || cat.includes('VOTING')) {
    return {
      bgColor: '#FFF3D6',
      borderColor: '#E89B3A',
      accentColor: '#D4960A',
      label: 'VOTE',
    };
  }

  if (cat.includes('WINNER')) {
    return {
      bgColor: '#FFF8E1',
      borderColor: '#D4960A',
      accentColor: '#D4960A',
      label: 'WINNER',
    };
  }

  if (cat.includes('GAME') || cat.includes('REWARD')) {
    return {
      bgColor: '#E6F5EF',
      borderColor: '#3BA99C',
      accentColor: '#3BA99C',
      label: 'GAME',
    };
  }

  // Default — warm sage info style
  return {
    bgColor: '#F0F5EE',
    borderColor: '#6B9E6E',
    accentColor: '#6B9E6E',
    label: 'INFO',
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BroadcastAlert({ message }: BroadcastAlertProps) {
  const { bgColor, borderColor, accentColor, label } = resolveAlertStyle(message.category);

  return (
    <motion.div
      className="vivid-alert-pulse"
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 18 }}
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
        // CSS custom property for pulse color
        ['--alert-pulse-color' as string]: accentColor,
      }}
    >
      {/* Category badge instead of emoji */}
      <span
        style={{
          flexShrink: 0,
          padding: '3px 8px',
          borderRadius: 6,
          background: accentColor,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: 800,
          fontFamily: 'var(--vivid-font-display)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
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
