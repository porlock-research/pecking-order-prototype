import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectPendingInvitesForMe, selectStandings } from '../../../../store/useGameStore';
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
  const playerId = useGameStore(s => s.playerId);
  const standings = useGameStore(useShallow(selectStandings));
  const myRank = standings.find(s => s.id === playerId)?.rank ?? null;

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
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflowY: 'auto',
        }}
      >
        {/* Drag affordance */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pulse-space-sm) 0' }}>
          <span aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--pulse-border)', borderRadius: 2 }} />
        </div>

        {/* STANDINGS — featured (largest type, gold ambient tint, generous padding) */}
        <section style={{
          background: 'radial-gradient(ellipse at top, rgba(255,200,61,0.08), transparent 60%), var(--pulse-surface)',
          borderBottom: '1px solid var(--pulse-border)',
          paddingBottom: 'var(--pulse-space-md)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--pulse-space-lg) var(--pulse-space-lg) var(--pulse-space-sm)',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: 17, fontWeight: 900, letterSpacing: 2,
              textTransform: 'uppercase', color: 'var(--pulse-text-1)',
            }}>Standings</h2>
            {myRank && (
              <span style={{
                fontSize: 11, color: 'var(--pulse-accent)', fontWeight: 700,
                background: 'rgba(255,59,111,0.15)',
                padding: 'var(--pulse-space-2xs) var(--pulse-space-sm)',
                borderRadius: 10,
              }}>You · #{myRank}</span>
            )}
          </div>
          <Podium />
          <StandingsRest />
        </section>

        {/* PENDING INVITES — action (accent-tinted container to demand attention) */}
        {pendingInvites.length > 0 && (
          <section style={{
            margin: 'var(--pulse-space-lg) var(--pulse-space-md) 0',
            padding: 'var(--pulse-space-md) var(--pulse-space-md) var(--pulse-space-md)',
            background: 'color-mix(in oklch, var(--pulse-pending) 10%, var(--pulse-surface))',
            border: '1px solid color-mix(in oklch, var(--pulse-pending) 32%, transparent)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column', gap: 'var(--pulse-space-sm)',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--pulse-pending)',
              display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-xs)',
            }}>
              Pending Invites
              <span aria-hidden="true" style={{
                background: 'var(--pulse-pending)', color: 'var(--pulse-on-accent)',
                fontSize: 10,
                padding: 'var(--pulse-space-2xs) var(--pulse-space-sm)',
                borderRadius: 8,
              }}>{pendingInvites.length}</span>
            </h3>
            {pendingInvites.map(ch => {
              const inviter = ch.createdBy ? roster[ch.createdBy] : null;
              if (!inviter) return null;
              return <InviteRow key={ch.id} channel={ch} inviter={inviter} />;
            })}
          </section>
        )}

        {/* CONVERSATIONS — utility (quietest label; list carries its own rhythm) */}
        <section>
          <div style={{ padding: 'var(--pulse-space-xl) var(--pulse-space-lg) var(--pulse-space-xs)' }}>
            <h3 style={{
              margin: 0,
              fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase',
              color: 'var(--pulse-text-4)',
            }}>Conversations</h3>
          </div>
          <ConversationsList />
        </section>
      </motion.div>
    </>
  );
}
