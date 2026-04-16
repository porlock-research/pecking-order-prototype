import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface VoterStripProps {
  eligibleVoters: string[];
  votes: Record<string, string>;
  roster: Record<string, SocialPlayer>;
}

/**
 * Shell-agnostic voter-progress strip — shows avatar of each eligible
 * voter with a dim/voted state and a running tally. Uses only the --po-*
 * design contract.
 */
export function VoterStrip({ eligibleVoters, votes, roster }: VoterStripProps) {
  const votedCount = eligibleVoters.filter((id) => id in votes).length;
  const total = eligibleVoters.length;
  const remaining = total - votedCount;

  const statusText =
    remaining === 0
      ? `${total} of ${total} voted`
      : remaining === 1
        ? 'Waiting for 1 more…'
        : `${votedCount} of ${total} voted`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Avatar row */}
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
          const hasVoted = voterId in votes;

          return (
            <div
              key={voterId}
              style={{
                position: 'relative',
                opacity: hasVoted ? 1 : 0.5,
                transition: 'opacity 0.25s ease',
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: hasVoted
                    ? '2px solid var(--po-green, #2d6a4f)'
                    : '2px solid var(--po-border, rgba(255,255,255,0.12))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border 0.25s ease',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={20}
                />
              </div>
              {/* Voted checkmark badge */}
              {hasVoted && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: 'var(--po-green, #2d6a4f)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--po-bg-panel, rgba(0,0,0,0.4))',
                  }}
                >
                  <svg
                    width={5}
                    height={4}
                    viewBox="0 0 5 4"
                    fill="none"
                    style={{ display: 'block' }}
                  >
                    <path
                      d="M0.5 2L1.8 3.2L4.2 0.8"
                      stroke="white"
                      strokeWidth={0.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
