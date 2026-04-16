import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_Z } from '../../zIndex';

export function StartPickedCta() {
  const pickingMode = useGameStore(s => s.pickingMode);
  const roster = useGameStore(s => s.roster);
  const cancelPicking = useGameStore(s => s.cancelPicking);
  const { engine, openDM } = usePulse();

  if (!pickingMode || pickingMode.selected.length === 0) return null;

  const label = pickingMode.kind === 'add-member'
    ? `Add ${pickingMode.selected.length}`
    : pickingMode.selected.length === 1
      ? `Start chat with ${roster[pickingMode.selected[0]]?.personaName ?? ''}`
      : `Start group with ${pickingMode.selected.length}`;

  const go = () => {
    if (pickingMode.kind === 'add-member') {
      engine.addMember(pickingMode.channelId, pickingMode.selected);
      cancelPicking();
      return;
    }
    if (pickingMode.selected.length === 1) {
      // Defer first-message creation to when the user actually types.
      // Opens the DmSheet with no resolved channel → DmInput will call
      // sendFirstMessage on the first real send.
      const partnerId = pickingMode.selected[0];
      cancelPicking();
      openDM(partnerId, false);
    } else {
      engine.createGroupDm(pickingMode.selected);
      cancelPicking();
      // Group channel arrives via SYNC; user opens it from Social panel or Cast Strip.
    }
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      style={{
        position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: PULSE_Z.elevated,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <button onClick={go} style={{
        pointerEvents: 'auto',
        background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
        padding: '12px 22px', borderRadius: 22,
        fontSize: 14, fontWeight: 800, border: 'none',
        boxShadow: '0 4px 14px rgba(255,59,111,0.45)',
        cursor: 'pointer',
      }}>{label}</button>
    </motion.div>
  );
}
