import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoCircle } from '@solar-icons/react';

interface VotingHeaderProps {
  header: string;
  cta: string;
  oneLiner: string;
  howItWorks: string;
  accentColor: string;
}

export function VotingHeader({
  header,
  cta,
  oneLiner,
  howItWorks,
  accentColor,
}: VotingHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Collapsible rules banner */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8,
          padding: '6px 10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 11,
              color: '#9B8E7E',
              lineHeight: 1.4,
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
              padding: 2,
              cursor: 'pointer',
              color: '#9B8E7E',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label={expanded ? 'Hide rules' : 'Show rules'}
          >
            <InfoCircle size={16} weight="Bold" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <p
                style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 11,
                  color: '#9B8E7E',
                  lineHeight: 1.5,
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {howItWorks}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Header */}
      <h3
        style={{
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 14,
          fontWeight: 700,
          color: accentColor,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {header}
      </h3>

      {/* CTA */}
      <p
        style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          fontWeight: 400,
          color: '#f5f0e8',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {cta}
      </p>
    </div>
  );
}
