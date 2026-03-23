import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface VoterStripProps {
  eligibleVoters: string[];
  votes: Record<string, string>;
  roster: Record<string, SocialPlayer>;
}

export function VoterStrip({ eligibleVoters, votes, roster }: VoterStripProps) {
  const votedCount = eligibleVoters.filter((id) => id in votes).length;
  const total = eligibleVoters.length;
  const remaining = total - votedCount;

  const statusText =
    remaining === 0
      ? `${total} of ${total} voted`
      : remaining === 1
        ? 'Waiting for 1 more...'
        : `${votedCount} of ${total} voted`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
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
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: hasVoted
                    ? '2px solid #2d6a4f'
                    : '2px solid #555',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={20}
                />
              </div>
              {/* Green checkmark badge */}
              {hasVoted && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2d6a4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                      strokeWidth={0.8}
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
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 10,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
