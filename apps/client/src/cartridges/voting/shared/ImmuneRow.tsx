import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface ImmuneRowProps {
  /** Player ids granted immunity (e.g. top 3 silver in BUBBLE). */
  ids: string[];
  roster: Record<string, SocialPlayer>;
}

/**
 * Gold-haloed avatar row representing immune players (BUBBLE top-3-silver).
 * Visually elite, sits above the picker, signals "these can't be voted on."
 *
 * Replaces the legacy "[*]" ASCII immune badge.
 */
export function ImmuneRow({ ids, roster }: ImmuneRowProps) {
  if (!ids || ids.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
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
        Immune \u00b7 top silver
      </span>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {ids.map((id) => {
          const player = roster[id];
          if (!player) return null;
          const firstName = player.personaName?.split(' ')[0] ?? id;
          return (
            <div
              key={id}
              title={`${player.personaName} (immune)`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  padding: 1.5,
                  background:
                    'conic-gradient(from 180deg, var(--po-gold), color-mix(in oklch, var(--po-gold) 40%, transparent), var(--po-gold))',
                  boxShadow: '0 0 14px color-mix(in oklch, var(--po-gold) 35%, transparent)',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={36}
                />
              </div>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--po-gold)',
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
