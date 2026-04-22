import { TapeLabel, formatHandleForLabel } from '../input/ConfessionInput';

interface CassetteProps {
  handle: string;
  text: string;
  ts: number;
  /** When true, apply the "incoming drop" animation (recipient variant). */
  isNew?: boolean;
  /** When provided, the text element carries a view-transition-name for the sender morph. */
  viewTransitionName?: string;
}

/**
 * Cassette card — the visual container for a single confession post.
 * Design contract: mockup 14 (docs/reports/pulse-mockups/14-confession-send-moment.html).
 * Layout: tape-label on top, quoted text in middle, two-reel tape transport above the footer.
 */
export function Cassette({ handle, text, ts, isNew, viewTransitionName }: CassetteProps) {
  const tc = formatTimecode(ts);
  const handleLabel = formatHandleForLabel(handle);

  const textStyle: React.CSSProperties = {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 500,
    fontSize: 19,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    color: 'var(--pulse-text-1)',
    position: 'relative',
    zIndex: 1,
  };
  if (viewTransitionName) textStyle.viewTransitionName = viewTransitionName;

  return (
    <div
      className={isNew ? 'pulse-cassette pulse-cassette-new' : 'pulse-cassette'}
      style={cassetteStyle.wrap}
    >
      <TapeLabel text={handleLabel} size="sm" />
      <div style={cassetteStyle.quote}>&ldquo;</div>
      <div style={textStyle}>{text}</div>
      <div style={cassetteStyle.transport}>
        <div style={cassetteStyle.reel} aria-hidden="true" />
        <div style={cassetteStyle.tapePath} aria-hidden="true" />
        <div style={cassetteStyle.reel} aria-hidden="true" />
      </div>
      <div style={cassetteStyle.foot}>
        <span>just now</span>
        <span style={cassetteStyle.tc}>{tc}</span>
      </div>
    </div>
  );
}

function formatTimecode(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const cassetteStyle: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    background:
      'radial-gradient(ellipse 80% 70% at 50% 0%, rgba(249,169,74,0.09), transparent 60%),' +
      'linear-gradient(180deg, var(--pulse-surface-2), var(--pulse-surface))',
    border: '1px solid var(--pulse-border-2)',
    borderRadius: 'var(--pulse-radius-md)',
    padding: '20px 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
  },
  quote: {
    position: 'absolute',
    top: 10,
    right: 18,
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 700,
    fontSize: 80,
    lineHeight: 1,
    color: 'var(--pulse-accent)',
    opacity: 0.1,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 2px 2px',
    position: 'relative',
    zIndex: 1,
  },
  reel: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: '50%',
    background:
      'radial-gradient(circle at 50% 50%, #18131e 0%, #0b080f 45%, #1d1826 100%)',
    position: 'relative',
    boxShadow:
      'inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 2px 3px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)',
  },
  tapePath: {
    flex: 1,
    height: 8,
    position: 'relative',
    background:
      'linear-gradient(180deg, transparent 0 30%, #2a1f38 30% 70%, transparent 70% 100%)',
    borderRadius: 2,
    overflow: 'hidden',
    backgroundImage:
      'repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0 2px, transparent 2px 5px)',
  },
  foot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
    color: 'var(--pulse-text-3)',
    letterSpacing: '0.04em',
    position: 'relative',
    zIndex: 1,
  },
  tc: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 10,
    color: 'var(--pulse-text-3)',
    letterSpacing: '0.05em',
    opacity: 0.8,
  },
};
