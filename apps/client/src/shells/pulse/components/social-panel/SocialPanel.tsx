import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectPendingInvitesForMe, selectDmThreads } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { Podium } from './Podium';
import { StandingsRest } from './StandingsRest';
import { InviteRow } from './InviteRow';
import { ConversationsList } from './ConversationsList';

interface Props { onClose: () => void; }

export function SocialPanel({ onClose }: Props) {
  const pendingInvites = useGameStore(useShallow(selectPendingInvitesForMe));
  const roster = useGameStore(s => s.roster);
  const threads = useGameStore(useShallow(selectDmThreads));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={PULSE_SPRING.exit}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Social panel"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={PULSE_SPRING.page}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border-2)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflowY: 'auto',
        }}
      >
        {/* STANDINGS — chapter card, gold ambient tint, Clash Display title */}
        <section style={{
          background: 'radial-gradient(ellipse at top, color-mix(in oklch, var(--pulse-gold) 8%, transparent), transparent 60%), var(--pulse-surface)',
          borderBottom: '1px solid var(--pulse-border)',
          paddingTop: 'var(--pulse-space-lg)',
          paddingBottom: 'var(--pulse-space-md)',
        }}>
          <div style={{
            padding: '0 var(--pulse-space-lg) var(--pulse-space-sm)',
          }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--po-font-display)',
              fontSize: 'clamp(24px, 6vw, 32px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: 'var(--pulse-text-1)',
            }}>Standings</h2>
            <div style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--pulse-gold)',
              opacity: 0.75,
            }}>
              Ranked by silver
            </div>
          </div>
          <Podium />
          <StandingsRest />
        </section>

        {/* PENDING INVITES — action (accent-tinted container to demand attention) */}
        {pendingInvites.length > 0 && (
          <section style={{
            margin: 'var(--pulse-space-lg) var(--pulse-space-md) 0',
            padding: 'var(--pulse-space-md)',
            background: 'color-mix(in oklch, var(--pulse-pending) 10%, var(--pulse-surface))',
            border: '1px solid color-mix(in oklch, var(--pulse-pending) 32%, transparent)',
            borderRadius: 'var(--pulse-radius-md)',
            display: 'flex', flexDirection: 'column', gap: 'var(--pulse-space-sm)',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--pulse-pending)',
              display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-xs)',
            }}>
              Pending invites
              <span aria-hidden="true" style={{
                background: 'var(--pulse-pending)', color: 'var(--pulse-on-accent)',
                fontSize: 10,
                padding: 'var(--pulse-space-2xs) var(--pulse-space-sm)',
                borderRadius: 'var(--pulse-radius-sm)',
              }}>{pendingInvites.length}</span>
            </h3>
            {pendingInvites.map(ch => {
              const inviter = ch.createdBy ? roster[ch.createdBy] : null;
              if (!inviter) return null;
              return <InviteRow key={ch.id} channel={ch} inviter={inviter} />;
            })}
          </section>
        )}

        {/* CONVERSATIONS — bumped visual weight. The list IS the content here,
            but the label should still read as a section, not a footnote. */}
        <section>
          <div style={{
            padding: 'var(--pulse-space-lg) var(--pulse-space-lg) var(--pulse-space-xs)',
            display: 'flex', alignItems: 'baseline', gap: 'var(--pulse-space-sm)',
          }}>
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--po-font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--pulse-text-1)',
            }}>Conversations</h3>
            {threads.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: 'var(--pulse-text-3)',
                fontVariantNumeric: 'tabular-nums',
              }}>{threads.length}</span>
            )}
          </div>
          <ConversationsList />
        </section>
      </motion.div>
    </>
  );
}
