import { useGameStore } from '../../../store/useGameStore';

interface StatusRingProps {
  playerId: string;
  size: number;
  children: React.ReactNode;
}

export function StatusRing({ playerId, size, children }: StatusRingProps) {
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const isOnline = onlinePlayers.includes(playerId);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {children}
      {isOnline && (
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: size > 40 ? 'var(--pulse-radius-md)' : 'var(--pulse-radius-sm)',
            border: '2px solid var(--pulse-accent)',
            pointerEvents: 'none',
            animation: 'pulse-breathe 2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
