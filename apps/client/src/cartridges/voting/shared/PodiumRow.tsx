import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PodiumRowProps {
  /** Podium player ids in rank order (#1, #2, #3 by silver). */
  ids: string[];
  roster: Record<string, SocialPlayer>;
  /** Optional self id — current player gets a subtle "you" highlight. */
  selfId?: string;
}

/**
 * Elevated/framed row of the top-3 silver players who are AT RISK in
 * PODIUM_SACRIFICE. Visually celebrates their position (gold accent,
 * numbered 1/2/3) while signaling the danger via the "AT RISK" label.
 *
 * Replaces the legacy podium-badge inline-style block.
 */
export function PodiumRow({ ids, roster, selfId }: PodiumRowProps) {
  if (!ids || ids.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '8px 4px 4px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: 'var(--po-gold)',
          textTransform: 'uppercase',
        }}
      >
        At risk \u00b7 the podium
      </span>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        {ids.map((id, i) => {
          const player = roster[id];
          if (!player) return null;
          const firstName = player.personaName?.split(' ')[0] ?? id;
          const isSelf = id === selfId;
          // Visual elevation: #1 is LIFTED (Olympic podium shape), #2/#3 sit at baseline.
          const lift = i === 0 ? -10 : i === 1 ? -2 : 0;
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transform: `translateY(${lift}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: 'var(--po-gold)',
                  textTransform: 'uppercase',
                }}
              >
                #{i + 1}
              </span>
              <div
                style={{
                  borderRadius: '50%',
                  padding: 2,
                  background:
                    'conic-gradient(from 180deg, var(--po-gold), color-mix(in oklch, var(--po-gold) 35%, transparent), var(--po-gold))',
                  boxShadow: '0 0 16px color-mix(in oklch, var(--po-gold) 30%, transparent)',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={i === 0 ? 48 : 40}
                />
              </div>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 11,
                  fontWeight: isSelf ? 700 : 600,
                  color: isSelf ? 'var(--po-gold)' : 'var(--po-text)',
                  letterSpacing: 0.1,
                }}
              >
                {firstName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
