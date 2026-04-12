import { usePillStates } from '../hooks/usePillStates';
import { useGameStore } from '../../../store/useGameStore';
import { usePulse } from '../PulseShell';
import { Pill } from './Pill';
import { getPlayerColor } from '../colors';

/**
 * PulseBar persists between ticker and chat.
 * When cartridges are active → shows pills.
 * When empty → shows online-now presence with per-player status (typing, active).
 *
 * Refined from Vivid: avatars show live status via animated ring + typing indicator,
 * eliminated/offline players are shown dimmed so the roster feels complete at a glance.
 */
export function PulseBar() {
  const pills = usePillStates();
  const roster = useGameStore(s => s.roster);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const { playerId, openAvatarPopover } = usePulse();

  if (pills.length === 0) {
    // Show all alive players (online highlighted, offline dimmed)
    const allAlive = Object.entries(roster).filter(([_, p]) => p.status === 'ALIVE');
    if (allAlive.length <= 1) return null;

    const onlineCount = allAlive.filter(([id]) => onlinePlayers.includes(id)).length;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          height: 52,
          position: 'relative',
          zIndex: 2,
          borderBottom: '1px solid var(--pulse-border)',
          background: 'var(--pulse-surface)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#2ecc71', textTransform: 'uppercase' }}>
            Here
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>
            {onlineCount} of {allAlive.length}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', gap: 8 }}>
          {allAlive.map(([id, p], i) => {
            const isOnline = onlinePlayers.includes(id);
            const isTyping = typingPlayers[id] === 'MAIN';
            const isSelf = id === playerId;
            const color = getPlayerColor(Object.keys(roster).indexOf(id));

            return (
              <button
                key={id}
                onClick={e => {
                  if (isSelf) return;
                  openAvatarPopover(id, e.currentTarget.getBoundingClientRect());
                }}
                title={p.personaName}
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: isSelf ? 'default' : 'pointer',
                  flexShrink: 0,
                }}
              >
                <img
                  src={p.avatarUrl}
                  alt=""
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    opacity: isOnline ? 1 : 0.55,
                    filter: isOnline ? 'none' : 'saturate(0.6)',
                    transition: 'opacity 0.3s ease, filter 0.3s ease',
                    display: 'block',
                  }}
                />
                {/* Self indicator — solid accent ring + "YOU" tag below */}
                {isSelf && (
                  <>
                    <span
                      style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: 12,
                        border: '2px solid var(--pulse-accent)',
                        pointerEvents: 'none',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--pulse-accent)',
                        color: '#fff',
                        fontSize: 7,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        padding: '1px 5px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      You
                    </span>
                  </>
                )}
                {/* Typing pulse ring (overrides) */}
                {isTyping && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: -2,
                      borderRadius: 12,
                      border: `1.5px solid ${color}`,
                      pointerEvents: 'none',
                      animation: 'pulse-breathe 0.9s ease-in-out infinite',
                    }}
                  />
                )}
                {/* Typing badge: animated dots */}
                {isTyping && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      background: 'var(--pulse-accent)',
                      borderRadius: 8,
                      padding: '1px 4px',
                      display: 'flex',
                      gap: 1.5,
                      border: '2px solid var(--pulse-surface)',
                    }}
                  >
                    {[0, 1, 2].map(d => (
                      <span
                        key={d}
                        style={{
                          width: 2.5, height: 2.5, borderRadius: '50%',
                          background: '#fff',
                          animation: `pulse-breathe 0.9s ease-in-out ${d * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                )}
                {/* Online status dot (only when not typing to avoid clutter) */}
                {isOnline && !isTyping && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: '#2ecc71',
                      boxShadow: '0 0 4px #2ecc71',
                      border: '2px solid var(--pulse-surface)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        height: 48,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map(pill => (
        <Pill key={pill.id} pill={pill} />
      ))}
    </div>
  );
}
