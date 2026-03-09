import { motion } from 'framer-motion';
import type { TickerMessage } from '@pecking-order/shared-types';
import { Danger, Scale, Gamepad, ChatDots } from '@solar-icons/react';
import { VIVID_SPRING } from '../springs';

interface AnnouncementStyle {
  borderColor: string;
  background: string;
  icon: React.ReactNode | null;
  isPhase: boolean;
}

function getAnnouncementStyle(category: string): AnnouncementStyle {
  if (category === 'ELIMINATION') {
    return {
      borderColor: 'var(--vivid-pink)',
      background: 'rgba(255, 46, 99, 0.1)',
      icon: <Danger size={16} weight="BoldDuotone" style={{ color: 'var(--vivid-pink)' }} />,
      isPhase: false,
    };
  }

  if (category === 'VOTE') {
    return {
      borderColor: 'var(--vivid-gold)',
      background: 'rgba(255, 217, 61, 0.1)',
      icon: <Scale size={16} weight="BoldDuotone" style={{ color: 'var(--vivid-gold)' }} />,
      isPhase: false,
    };
  }

  if (category === 'GAME' || category === 'GAME.REWARD') {
    return {
      borderColor: 'var(--vivid-teal)',
      background: 'rgba(78, 205, 196, 0.1)',
      icon: <Gamepad size={16} weight="BoldDuotone" style={{ color: 'var(--vivid-teal)' }} />,
      isPhase: false,
    };
  }

  if (category === 'ACTIVITY') {
    return {
      borderColor: 'var(--vivid-lavender)',
      background: 'rgba(167, 139, 250, 0.1)',
      icon: <ChatDots size={16} weight="BoldDuotone" style={{ color: 'var(--vivid-lavender)' }} />,
      isPhase: false,
    };
  }

  const prefix = category.split('.')[0];

  if (prefix === 'PHASE') {
    return {
      borderColor: 'transparent',
      background: getPhaseGradient(category),
      icon: null,
      isPhase: true,
    };
  }

  if (prefix === 'SOCIAL') {
    return {
      borderColor: 'var(--vivid-teal)',
      background: 'rgba(78, 205, 196, 0.1)',
      icon: <ChatDots size={16} weight="BoldDuotone" style={{ color: 'var(--vivid-teal)' }} />,
      isPhase: false,
    };
  }

  // Default
  return {
    borderColor: 'transparent',
    background: 'transparent',
    icon: null,
    isPhase: false,
  };
}

function getPhaseGradient(category: string): string {
  switch (category) {
    case 'PHASE.DAY_START':
      return 'linear-gradient(135deg, rgba(78, 205, 196, 0.15) 0%, rgba(255, 217, 61, 0.1) 100%)';
    case 'PHASE.NIGHT':
      return 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(26, 27, 58, 0.8) 100%)';
    case 'PHASE.GAME_OVER':
      return 'linear-gradient(135deg, rgba(255, 46, 99, 0.15) 0%, rgba(255, 107, 107, 0.1) 100%)';
    case 'PHASE.WINNER':
      return 'linear-gradient(135deg, rgba(255, 217, 61, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%)';
    default:
      return 'linear-gradient(135deg, rgba(37, 39, 88, 0.5) 0%, rgba(26, 27, 58, 0.8) 100%)';
  }
}

export function SystemAnnouncement({ message }: { message: TickerMessage }) {
  const style = getAnnouncementStyle(message.category);

  // Default fallback: simple dim divider
  if (!style.icon && !style.isPhase) {
    return (
      <motion.div
        className="flex items-center gap-3 py-1.5 px-2 select-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex-1 h-px" style={{ background: 'rgba(139, 141, 179, 0.2)' }} />
        <span
          className="text-[10px] font-mono uppercase tracking-wider text-center shrink-0"
          style={{ color: 'var(--vivid-text-dim)' }}
        >
          {message.text}
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(139, 141, 179, 0.2)' }} />
      </motion.div>
    );
  }

  // Phase banner: full-width, display font, larger text
  if (style.isPhase) {
    return (
      <motion.div
        className="w-full px-4 py-3 rounded-xl text-center select-none"
        style={{ background: style.background }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={VIVID_SPRING.gentle}
      >
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{
            fontFamily: 'var(--vivid-font-display)',
            color: 'var(--vivid-text)',
          }}
        >
          {message.text}
        </span>
      </motion.div>
    );
  }

  // Category card: icon + text with colored left border
  return (
    <motion.div
      className="w-full px-4 py-2.5 rounded-xl flex items-center gap-2.5 select-none"
      style={{
        borderLeft: `3px solid ${style.borderColor}`,
        background: style.background,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={VIVID_SPRING.gentle}
    >
      {style.icon}
      <span
        className={`text-sm leading-snug ${message.category === 'ELIMINATION' ? 'font-bold' : ''}`}
        style={{ color: 'var(--vivid-text)' }}
      >
        {message.text}
      </span>
    </motion.div>
  );
}
