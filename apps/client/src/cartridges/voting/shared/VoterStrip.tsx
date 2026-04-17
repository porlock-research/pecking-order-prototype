import { motion, useReducedMotion } from 'framer-motion';
import { useCartridgeStage } from '../../CartridgeStageContext';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface VoterStripProps {
  eligibleVoters: string[];
  votes: Record<string, string>;
  roster: Record<string, SocialPlayer>;
  /** Mechanism accent — used for the engaged-state ring + glow. */
  accentColor: string;
  /** Current player id, so we can mark "you" in the row. */
  selfId?: string;
}

/**
 * Shell-agnostic voter-progress strip.
 *
 * Engagement grammar (canonical, matches DilemmaCard / PromptShell):
 *   - Voted    → conic-gradient ring in mechanism accent + soft glow, full opacity
 *   - Waiting  → 1.5px dashed neutral ring + 0.55 opacity + breathing pulse
 *                (opacity oscillates 0.55 → 0.85 → 0.55 over 2.4s) + saturate(0.8)
 *
 * Self-marker: the current player gets a tiny accent dot under their avatar.
 *
 * Status text uses tabular-nums + named callouts when ≤2 holdouts remain.
 * Wrapped with role="status" + aria-live="polite" for SR users.
 *
 * Hidden when staged: the Pulse stage renders a bigger cast strip below
 * the cartridge already (mirrors PromptShell behavior).
 */
export function VoterStrip({
  eligibleVoters,
  votes,
  roster,
  accentColor,
  selfId,
}: VoterStripProps) {
  const { staged } = useCartridgeStage();
  const reduce = useReducedMotion();
  if (staged) return null;

  const votedSet = new Set(Object.keys(votes));
  const total = eligibleVoters.length;
  const votedCount = eligibleVoters.filter((id) => votedSet.has(id)).length;
  const remaining = total - votedCount;

  const holdoutNames = eligibleVoters
    .filter((id) => !votedSet.has(id))
    .map((id) => roster[id]?.personaName?.split(' ')[0] ?? null)
    .filter((n): n is string => !!n);

  const statusText = formatStatus(votedCount, total, remaining, holdoutNames);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {eligibleVoters.map((voterId) => {
          const player = roster[voterId];
          if (!player) return null;
          const did = votedSet.has(voterId);
          const isSelf = voterId === selfId;
          return (
            <div
              key={voterId}
              title={player.personaName}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <motion.div
                animate={did || reduce ? { opacity: did ? 1 : 0.55 } : { opacity: [0.55, 0.85, 0.55] }}
                transition={did || reduce ? { duration: 0.25 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  borderRadius: '50%',
                  padding: 1.5,
                  background: did
                    ? `conic-gradient(from 180deg, ${accentColor}, color-mix(in oklch, ${accentColor} 40%, transparent), ${accentColor})`
                    : 'transparent',
                  border: did
                    ? 'none'
                    : '1.5px dashed color-mix(in oklch, var(--po-text) 25%, transparent)',
                  filter: did ? 'none' : 'grayscale(35%) saturate(0.8)',
                  boxShadow: did
                    ? `0 0 14px color-mix(in oklch, ${accentColor} 30%, transparent)`
                    : undefined,
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={36}
                />
              </motion.div>
              {isSelf && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: accentColor,
                    marginTop: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <span
        role="status"
        aria-live="polite"
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}

function formatStatus(
  votedCount: number,
  total: number,
  remaining: number,
  holdoutNames: string[],
): string {
  if (total === 0) return '';
  if (remaining === 0) return 'All locked in — revealing';
  if (remaining <= 2 && holdoutNames.length === remaining && holdoutNames.length > 0) {
    if (holdoutNames.length === 1) return `Waiting for ${holdoutNames[0]}`;
    return `Waiting for ${holdoutNames[0]} and ${holdoutNames[1]}`;
  }
  return `${votedCount} of ${total} voted`;
}
