import { useEffect, useRef } from 'react';

interface Props {
  onCleared: () => void;
}

export function ChatDivider({ onCleared }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting && e.boundingClientRect.top < 0) {
            onCleared();
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onCleared]);

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0 8px',
        color: 'var(--pulse-accent)',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--pulse-accent)', opacity: 0.5 }} />
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        New
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--pulse-accent)', opacity: 0.5 }} />
    </div>
  );
}
