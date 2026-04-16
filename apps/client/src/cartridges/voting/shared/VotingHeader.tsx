import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

interface VotingHeaderProps {
  header: string;
  cta: string;
  oneLiner: string;
  howItWorks: string;
  /** Accent color — passed in so voting types can theme themselves. */
  accentColor: string;
}

/**
 * Shell-agnostic voting header — renders the rules banner, mechanism
 * label, and CTA. Uses only the --po-* design contract so it adopts
 * whichever shell it's rendered in (Pulse / Vivid / Classic / Immersive).
 */
export function VotingHeader({
  header,
  cta,
  oneLiner,
  howItWorks,
  accentColor,
}: VotingHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Collapsible rules banner */}
      <div
        style={{
          background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
          borderRadius: 10,
          padding: '8px 12px',
          border: '1px solid var(--po-border, rgba(255,255,255,0.06))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--po-font-body)',
              fontSize: 12,
              color: 'var(--po-text-dim)',
              lineHeight: 1.45,
              flex: 1,
            }}
          >
            {oneLiner}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--po-text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderRadius: 6,
            }}
            aria-label={expanded ? 'Hide rules' : 'Show rules'}
            aria-expanded={expanded}
          >
            <Info size={16} strokeWidth={2.25} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.9, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <p
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 12,
                  color: 'var(--po-text-dim)',
                  lineHeight: 1.55,
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--po-border, rgba(255,255,255,0.06))',
                  margin: 0,
                }}
              >
                {howItWorks}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mechanism label — display font, accent-colored, uppercase */}
      <h3
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: accentColor,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {header}
      </h3>

      {/* CTA — body font, primary text color, readable */}
      <p
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--po-text)',
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {cta}
      </p>
    </div>
  );
}
