import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectPendingInvitesForMe, selectStandings } from '../../../../store/useGameStore';
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
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ width: 40, height: 4, background: 'var(--pulse-border)', borderRadius: 2 }} />
        </div>
        <div style={{
          background: 'radial-gradient(ellipse at top, rgba(255,215,0,0.08), transparent 60%), var(--pulse-surface)',
          borderBottom: '1px solid var(--pulse-border)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px 0',
          }}>
            <span style={{
              fontSize: 14, fontWeight: 900, letterSpacing: 1.5,
              textTransform: 'uppercase', color: 'var(--pulse-text-1)',
            }}>Standings</span>
            {myRank && (
              <span style={{
                fontSize: 11, color: 'var(--pulse-accent)', fontWeight: 700,
                background: 'rgba(255,59,111,0.15)', padding: '3px 9px', borderRadius: 10,
              }}>You · #{myRank}</span>
            )}
          </div>
          <Podium />
          <StandingsRest />
        </div>

        {pendingInvites.length > 0 && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'var(--pulse-text-3)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Pending Invites
              <span style={{
                background: 'var(--pulse-accent)', color: '#fff',
                fontSize: 10, padding: '1px 6px', borderRadius: 8,
              }}>{pendingInvites.length}</span>
            </div>
            {pendingInvites.map(ch => {
              const inviter = ch.createdBy ? roster[ch.createdBy] : null;
              if (!inviter) return null;
              return <InviteRow key={ch.id} channel={ch} inviter={inviter} />;
            })}
          </div>
        )}

        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
            color: 'var(--pulse-text-3)',
          }}>Conversations</div>
        </div>
        <ConversationsList />
      </motion.div>
    </>
  );
}
