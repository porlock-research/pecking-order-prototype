interface ResultFeedbackProps {
  correct: boolean;
  silver: number;
  /** Currently unused — preserved for API compatibility with renderers. */
  speedBonus?: number;
}

/**
 * Compact inline feedback shown after answering. Shell-agnostic via
 * --po-* tokens; correct/wrong tones are --po-green / --po-pink.
 * No backdrop-filter — sits on the cartridge surface, not glass.
 */
export function ResultFeedback({ correct, silver }: ResultFeedbackProps) {
  const tone = correct ? 'var(--po-green)' : 'var(--po-pink)';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        textAlign: 'center',
        padding: '8px 12px',
        borderRadius: 10,
        background: `color-mix(in oklch, ${tone} 12%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tone} 26%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'center',
        margin: '0 auto',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: tone,
          letterSpacing: 0.04,
        }}
      >
        {correct ? 'Correct' : 'Wrong'}
      </span>
      {correct && silver > 0 && (
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 12,
            fontWeight: 700,
            color: tone,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          +{silver} silver
        </span>
      )}
    </div>
  );
}
