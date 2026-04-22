/**
 * ClosedPlate — replaces ConfessionInput once the confession phase ends.
 * Tapes stay browsable; the composer is locked behind a rubber-stamp plate.
 * Design contract: mockup 13 state 04 (docs/reports/pulse-mockups/13-confessions-booth.html).
 */
export function ClosedPlate() {
  return (
    <div style={plateStyle.wrap}>
      <div style={plateStyle.stamp}>BOOTH CLOSED</div>
      <div style={plateStyle.meta}>
        The door&rsquo;s locked. Tapes from tonight stay here until the game ends. A new booth opens tomorrow.
      </div>
    </div>
  );
}

const plateStyle = {
  wrap: {
    flexShrink: 0,
    padding: '22px 20px 26px',
    borderTop: '1px solid var(--pulse-border)',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.4))',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    zIndex: 2,
  },
  stamp: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: '0.28em',
    color: 'var(--pulse-text-3)',
    padding: '8px 18px',
    border: '2px solid var(--pulse-text-4)',
    borderRadius: 'var(--pulse-radius-sm)',
    transform: 'rotate(-3deg)',
    display: 'inline-block',
  },
  meta: {
    fontFamily: 'Outfit, sans-serif',
    fontSize: 12,
    color: 'var(--pulse-text-3)',
    maxWidth: 300,
    lineHeight: 1.45,
  },
} satisfies Record<string, React.CSSProperties>;
