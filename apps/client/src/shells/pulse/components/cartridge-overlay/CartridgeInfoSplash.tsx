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
        // Kind-tinted ambient wash — anticipation lives in the kind's color.
        background: `radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in oklch, ${dotColor} 14%, transparent) 0%, transparent 70%)`,
        paddingTop: 'var(--pulse-space-2xl)',
        paddingLeft: 'var(--pulse-space-lg)',
        paddingRight: 'var(--pulse-space-lg)',
        paddingBottom: 'var(--pulse-space-2xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'var(--pulse-text-1)',
      }}
    >
      {/* Countdown chip — breathes when live, for extra anticipation */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--pulse-space-sm)',
          padding: 'var(--pulse-space-xs) var(--pulse-space-md)',
          marginBottom: 'var(--pulse-space-md)',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: dotColor,
          fontFamily: 'var(--po-font-body)',
          animation: isStarting ? 'pulse-breathe 1.4s ease-in-out infinite' : undefined,
        }}
      >
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
        {isStarting ? 'Starting now' : countdown ? `Starts in ${countdown}` : 'Scheduled'}
      </div>

      {/* Hero title — fluid display type, anchor of the splash */}
      <h1
        style={{
          fontSize: 'clamp(32px, 8vw, 44px)',
          fontWeight: 700,
          letterSpacing: -1.2,
          fontFamily: 'var(--po-font-display)',
          textAlign: 'center',
          margin: 0,
          marginBottom: 'var(--pulse-space-md)',
          lineHeight: 1.02,
          maxWidth: 520,
        }}
      >
        {displayName}
      </h1>

      {tagline && (
        <p
          style={{
            fontSize: 16,
            fontStyle: 'italic',
            color: 'var(--pulse-text-2)',
            textAlign: 'center',
            margin: 0,
            marginBottom: 'var(--pulse-space-md)',
            maxWidth: 340,
            fontFamily: 'var(--po-font-body)',
            lineHeight: 1.35,
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
            marginBottom: 'var(--pulse-space-xl)',
            maxWidth: 360,
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}

      {mechanics.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 'var(--pulse-space-lg)',
            borderRadius: 16,
            background: 'var(--pulse-surface-2)',
            border: `1px solid color-mix(in oklch, ${dotColor} 18%, var(--pulse-border))`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'var(--pulse-text-3)',
              marginBottom: 'var(--pulse-space-md)',
              fontFamily: 'var(--po-font-body)',
            }}
          >
            How it works
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--pulse-space-sm)' }}>
            {mechanics.map((m, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--pulse-space-sm)',
                  fontSize: 13,
                  color: 'var(--pulse-text-1)',
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 20,
                    height: 20,
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
            marginTop: 'var(--pulse-space-sm)',
            textAlign: 'center',
          }}
        >
          Starts soon.
        </p>
      )}
    </div>
  );
}
