import { useState, useEffect } from 'react';
import { CARTRIDGE_INFO, type CartridgeInfoEntry, type CartridgeKind } from '@pecking-order/shared-types';

interface Props {
  kind: CartridgeKind;
  typeKey: string;
  fallbackLabel: string;
  /** Scheduled epoch ms. If set and isStarting=false, countdown shows "starts in MM:SS". */
  scheduledAt: number | null;
  /** When true, microcopy reads "Starting now…" and countdown is hidden. */
  isStarting: boolean;
}

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

function useLiveCountdown(targetMs: number | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  const diff = Math.max(0, targetMs - now);
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function CartridgeInfoSplash({ kind, typeKey, fallbackLabel, scheduledAt, isStarting }: Props) {
  const entry: CartridgeInfoEntry | undefined = CARTRIDGE_INFO[typeKey];
  const countdown = useLiveCountdown(isStarting ? null : scheduledAt);
  const dotColor = KIND_COLORS[kind];

  const displayName = entry?.displayName ?? fallbackLabel;
  const tagline = entry?.tagline;
  const description = entry?.description;
  const mechanics = entry?.mechanics ?? [];

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        color: 'var(--pulse-text-1)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: dotColor,
        }}
      >
        {isStarting ? 'Starting now…' : countdown ? `Starts in ${countdown}` : 'Scheduled'}
      </div>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 900,
          fontFamily: 'var(--po-font-display, var(--po-font-body))',
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {displayName}
      </h1>

      {tagline && (
        <p
          style={{
            fontSize: 15,
            fontStyle: 'italic',
            color: 'var(--pulse-text-2)',
            textAlign: 'center',
            margin: 0,
            maxWidth: 340,
          }}
        >
          {tagline}
        </p>
      )}

      {description && (
        <p
          style={{
            fontSize: 14,
            color: 'var(--pulse-text-2)',
            textAlign: 'center',
            margin: 0,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {mechanics.length > 0 && (
        <div
          style={{
            marginTop: 8,
            width: '100%',
            maxWidth: 360,
            padding: 16,
            borderRadius: 14,
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--pulse-text-3)',
              marginBottom: 10,
            }}
          >
            How it works
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mechanics.map((m, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--pulse-text-1)',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: `${dotColor}22`,
                    color: dotColor,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!entry && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--pulse-text-3)',
            fontStyle: 'italic',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Starts soon.
        </p>
      )}
    </div>
  );
}
