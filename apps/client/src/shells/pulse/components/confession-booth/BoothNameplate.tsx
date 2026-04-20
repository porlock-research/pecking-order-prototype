import { motion } from 'framer-motion';
import { PULSE_SPRING } from '../../springs';
import { parseHandleParts } from '../input/ConfessionInput';

interface Props {
  /** The per-phase handle like "CONFESSOR·03" or "CONFESSOR-03". */
  handle: string;
  onContinue: () => void;
}

/**
 * One-time entry nameplate — shows on the player's first open of the booth
 * each confession phase. Masked silhouette drops in, the handle number stamps,
 * the caption settles. Tap anywhere to enter the booth. Design contract:
 * mockup 13 state 01 (docs/reports/pulse-mockups/13-confessions-booth.html).
 */
export function BoothNameplate({ handle, onContinue }: Props) {
  const parts = parseHandleParts(handle);

  return (
    <motion.button
      type="button"
      aria-label="Tap to enter the Confession Booth"
      onClick={onContinue}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={overlayStyle}
    >
      {/* film letterbox top */}
      <div aria-hidden="true" style={letterboxTop} />

      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...PULSE_SPRING.pop, delay: 0.06 }}
        style={maskStyle}
      >
        {/* crossed-tape "X" silhouette */}
        <span aria-hidden="true" style={{ ...tapeBarStyle, transform: 'rotate(24deg)' }} />
        <span aria-hidden="true" style={{ ...tapeBarStyle, transform: 'rotate(-24deg)' }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...PULSE_SPRING.gentle, delay: 0.18 }}
        style={labelStackStyle}
      >
        <div style={eyebrowStyle}>YOU ARE</div>
        <div style={labelStyle}>{parts.word}</div>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...PULSE_SPRING.pop, delay: 0.26 }}
          style={numberStyle}
        >
          <span style={hashStyle}>#</span>
          {parts.number}
        </motion.div>
        <div style={tagStyle}>NAMELESS FOR TONIGHT</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...PULSE_SPRING.gentle, delay: 0.34 }}
        style={captionStyle}
      >
        Anything you drop in here posts under this tape. The others won&rsquo;t know it&rsquo;s
        you &mdash; not even tomorrow.
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        style={continueStyle}
      >
        TAP TO ENTER <span aria-hidden="true" style={arrowStyle} />
      </motion.div>

      <div aria-hidden="true" style={letterboxBottom} />
    </motion.button>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 3,
  background:
    'radial-gradient(ellipse 60% 80% at 50% 45%, rgba(249,169,74,0.10), transparent 65%),' +
    'linear-gradient(180deg, var(--pulse-bg) 0%, var(--pulse-bg-2) 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  gap: 20,
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'center',
};

const letterboxTop: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '8%',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent)',
  pointerEvents: 'none',
};
const letterboxBottom: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '10%',
  background: 'linear-gradient(0deg, rgba(0,0,0,0.8), transparent)',
  pointerEvents: 'none',
};

const maskStyle: React.CSSProperties = {
  width: 124,
  height: 124,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 38% 30%, var(--pulse-surface-3), var(--pulse-surface) 60%, #08060d 100%)',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow:
    '0 0 0 2px var(--pulse-border-2), 0 0 60px rgba(249,169,74,0.18), inset 0 4px 8px rgba(249,169,74,0.15)',
};

const tapeBarStyle: React.CSSProperties = {
  position: 'absolute',
  width: 74,
  height: 7,
  background: 'var(--pulse-accent)',
  borderRadius: 2,
  boxShadow: '0 0 18px rgba(255, 59, 111, 0.4)',
};

const labelStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.34em',
  color: 'var(--pulse-accent)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 800,
  fontSize: 26,
  letterSpacing: '0.16em',
  lineHeight: 1,
  color: 'var(--pulse-text-1)',
  marginTop: -4,
};

const numberStyle: React.CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 700,
  fontSize: 120,
  lineHeight: 0.88,
  letterSpacing: '-0.05em',
  color: 'var(--pulse-text-1)',
  textShadow: '0 0 28px rgba(249,169,74,0.28)',
  marginTop: 2,
  fontVariantNumeric: 'tabular-nums',
};

const hashStyle: React.CSSProperties = {
  color: 'var(--pulse-accent)',
  marginRight: 2,
  fontWeight: 600,
};

const tagStyle: React.CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: '0.24em',
  color: 'var(--pulse-text-2)',
};

const captionStyle: React.CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontSize: 13,
  fontStyle: 'italic',
  color: 'var(--pulse-text-3)',
  maxWidth: 280,
  lineHeight: 1.5,
  marginTop: 4,
};

const continueStyle: React.CSSProperties = {
  marginTop: 14,
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.28em',
  color: 'var(--pulse-text-3)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const arrowStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRight: '2px solid var(--pulse-text-3)',
  borderBottom: '2px solid var(--pulse-text-3)',
  transform: 'rotate(-45deg)',
  marginTop: -2,
};
