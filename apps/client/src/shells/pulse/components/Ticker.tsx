import { useRef, useEffect, useState } from 'react';
import { useTickerRetention } from '../hooks/useTickerRetention';
import { useGameStore } from '../../../store/useGameStore';
import { TickerCategories } from '@pecking-order/shared-types';

export function Ticker() {
  const messages = useTickerRetention();
  const roster = useGameStore(s => s.roster);
  const prevLenRef = useRef(messages.length);
  const [flash, setFlash] = useState<'gold' | 'coral' | null>(null);

  useEffect(() => {
    if (messages.length > prevLenRef.current && messages.length > 0) {
      const latest = messages[messages.length - 1];
      const isGold = latest.category === TickerCategories.SOCIAL_TRANSFER;
      setFlash(isGold ? 'gold' : 'coral');
      const t = setTimeout(() => setFlash(null), 600);
      prevLenRef.current = messages.length;
      return () => clearTimeout(t);
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          position: 'relative',
          zIndex: 2,
          borderBottom: '1px solid var(--pulse-border)',
          background: 'var(--pulse-surface)',
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--pulse-accent)',
            boxShadow: '0 0 8px var(--pulse-accent)',
            animation: 'pulse-breathe 1.5s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: 'var(--pulse-accent)', textTransform: 'uppercase' }}>Live</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>
          Waiting for activity...
        </span>
      </div>
    );
  }

  // Try to match player names in text to render headshots inline
  const renderItem = (text: string, id: string) => {
    // Find any persona name in the text, highlight it
    const names = Object.entries(roster).map(([pid, p]) => ({ pid, name: p.personaName, avatar: p.avatarUrl }));
    // Build segments
    const segments: Array<{ type: 'text'; value: string } | { type: 'player'; name: string; avatar: string }> = [];
    let rest = text;
    let safety = 0;
    while (rest.length > 0 && safety++ < 10) {
      let earliest: { name: string; avatar: string; idx: number } | null = null;
      for (const { name, avatar } of names) {
        const idx = rest.indexOf(name);
        if (idx >= 0 && (!earliest || idx < earliest.idx)) earliest = { name, avatar, idx };
      }
      if (!earliest) {
        segments.push({ type: 'text', value: rest });
        break;
      }
      if (earliest.idx > 0) segments.push({ type: 'text', value: rest.slice(0, earliest.idx) });
      segments.push({ type: 'player', name: earliest.name, avatar: earliest.avatar });
      rest = rest.slice(earliest.idx + earliest.name.length);
    }
    return (
      <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingRight: 28 }}>
        {segments.map((s, i) => s.type === 'text' ? (
          <span key={i} style={{ color: 'var(--pulse-text-3)' }}>{s.value}</span>
        ) : (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <img
              src={s.avatar}
              alt=""
              style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover', objectPosition: 'center top', flexShrink: 0 }}
            />
            <span style={{ color: 'var(--pulse-accent)', fontWeight: 700 }}>{s.name}</span>
          </span>
        ))}
      </span>
    );
  };

  const items = messages.map(m => ({ id: `${m.timestamp}-${m.text.slice(0, 20)}`, text: m.text }));
  const allItems = [...items, ...items];

  return (
    <div
      style={{
        height: 32,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: flash === 'gold'
          ? 'linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)'
          : flash === 'coral'
            ? 'linear-gradient(90deg, transparent, rgba(255,59,111,0.1), transparent)'
            : 'var(--pulse-surface)',
        transition: 'background 0.3s ease',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* LIVE badge */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 10px',
          height: '100%',
          borderRight: '1px solid var(--pulse-border)',
          background: 'var(--pulse-surface)',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#ff3b3b',
            boxShadow: '0 0 6px #ff3b3b',
            animation: 'pulse-breathe 1.2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#ff3b3b', textTransform: 'uppercase' }}>Live</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          whiteSpace: 'nowrap',
          animation: `pulse-ticker-scroll ${Math.max(items.length * 5, 18)}s linear infinite`,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--po-font-body)',
          paddingLeft: 16,
        }}
      >
        {allItems.map((item, i) => renderItem(item.text, `${item.id}-${i}`))}
      </div>
    </div>
  );
}
