import { useRef, useEffect, useState } from 'react';
import { useTickerRetention } from '../hooks/useTickerRetention';
import { TickerCategories } from '@pecking-order/shared-types';

export function Ticker() {
  const messages = useTickerRetention();
  const prevLenRef = useRef(messages.length);
  const [flash, setFlash] = useState<'gold' | 'coral' | null>(null);

  // Flash when new messages arrive
  useEffect(() => {
    if (messages.length > prevLenRef.current && messages.length > 0) {
      const latest = messages[messages.length - 1];
      const isGold = latest.category === TickerCategories.SOCIAL_TRANSFER;
      setFlash(isGold ? 'gold' : 'coral');
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  if (messages.length === 0) return null;

  // Build display items
  const items = messages.map(m => {
    return { id: `${m.timestamp}-${m.text.slice(0, 20)}`, text: m.text };
  });

  // Duplicate for seamless scroll
  const allItems = [...items, ...items];

  return (
    <div
      style={{
        height: 30,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: flash === 'gold'
          ? 'linear-gradient(90deg, transparent, rgba(255,215,0,0.08), transparent)'
          : flash === 'coral'
            ? 'linear-gradient(90deg, transparent, rgba(255,59,111,0.06), transparent)'
            : 'var(--pulse-surface)',
        transition: 'background 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          whiteSpace: 'nowrap',
          animation: `pulse-ticker-scroll ${Math.max(items.length * 4, 15)}s linear infinite`,
        }}
      >
        {allItems.map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              paddingRight: 24,
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--pulse-text-3)',
              fontFamily: 'var(--po-font-body)',
            }}
          >
            <span>{item.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
