const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface OptionGridProps {
  options: string[];
  selectedAnswer: number | null;
  onSelect?: (idx: number) => void;
  correctIndex?: number;
  disabled?: boolean;
  /** Per-game accent for the selected/correct state. Defaults to gold. */
  accent?: string;
}

/**
 * Multiple-choice option grid for trivia-style games. Shell-agnostic
 * via inline --po-* tokens. Correct/wrong colors come from --po-green
 * and --po-pink (no --po-danger token; pink is the warning accent).
 */
export function OptionGrid({
  options,
  selectedAnswer,
  onSelect,
  correctIndex,
  disabled,
  accent = 'var(--po-gold)',
}: OptionGridProps) {
  const isResultMode = correctIndex !== undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((opt, idx) => {
        const isSelected = selectedAnswer === idx;
        const isCorrect = correctIndex === idx;
        const isPlayerWrong = isSelected && isResultMode && !isCorrect;
        const isInteractive = !isResultMode && selectedAnswer === null && !disabled;

        const baseStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 12,
          fontFamily: 'var(--po-font-body)',
          fontSize: 14,
          textAlign: 'left' as const,
          minHeight: 48,
          transition: 'background 200ms ease, border-color 200ms ease, opacity 200ms ease',
          cursor: isInteractive ? 'pointer' : 'default',
        };

        let background: string;
        let border: string;
        let textColor: string;
        let opacity = 1;
        let badgeBg: string;
        let badgeColor: string;
        let badgeChar: string;

        if (isResultMode) {
          if (isCorrect) {
            background = `color-mix(in oklch, var(--po-green) 14%, transparent)`;
            border = `1px solid color-mix(in oklch, var(--po-green) 38%, transparent)`;
            textColor = 'var(--po-green)';
            badgeBg = 'var(--po-green)';
            badgeColor = 'var(--po-bg-deep)';
            badgeChar = '✓';
          } else if (isPlayerWrong) {
            background = `color-mix(in oklch, var(--po-pink) 14%, transparent)`;
            border = `1px solid color-mix(in oklch, var(--po-pink) 38%, transparent)`;
            textColor = 'var(--po-pink)';
            badgeBg = 'var(--po-pink)';
            badgeColor = 'var(--po-bg-deep)';
            badgeChar = '✕';
          } else {
            background = 'var(--po-bg-glass)';
            border = '1px solid transparent';
            textColor = 'var(--po-text-dim)';
            opacity = 0.4;
            badgeBg = `color-mix(in oklch, var(--po-text) 8%, transparent)`;
            badgeColor = 'var(--po-text-dim)';
            badgeChar = OPTION_LABELS[idx];
          }
        } else if (isSelected) {
          background = `color-mix(in oklch, ${accent} 16%, transparent)`;
          border = `1px solid color-mix(in oklch, ${accent} 44%, transparent)`;
          textColor = accent;
          badgeBg = accent;
          badgeColor = 'var(--po-bg-deep)';
          badgeChar = OPTION_LABELS[idx];
        } else if (selectedAnswer !== null) {
          background = 'var(--po-bg-glass)';
          border = '1px solid transparent';
          textColor = 'var(--po-text-dim)';
          opacity = 0.5;
          badgeBg = `color-mix(in oklch, var(--po-text) 8%, transparent)`;
          badgeColor = 'var(--po-text-dim)';
          badgeChar = OPTION_LABELS[idx];
        } else {
          background = 'var(--po-bg-glass)';
          border = `1px solid var(--po-border)`;
          textColor = 'var(--po-text)';
          badgeBg = `color-mix(in oklch, var(--po-text) 8%, transparent)`;
          badgeColor = 'var(--po-text-dim)';
          badgeChar = OPTION_LABELS[idx];
        }

        if (isResultMode) {
          return (
            <div
              key={idx}
              style={{ ...baseStyle, background, border, color: textColor, opacity }}
            >
              <OptionBadge bg={badgeBg} color={badgeColor}>{badgeChar}</OptionBadge>
              <span>{opt}</span>
            </div>
          );
        }

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect?.(idx)}
            disabled={disabled || selectedAnswer !== null}
            aria-pressed={isSelected}
            style={{ ...baseStyle, background, border, color: textColor, opacity }}
          >
            <OptionBadge bg={badgeBg} color={badgeColor}>{badgeChar}</OptionBadge>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function OptionBadge({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        fontFamily: 'var(--po-font-display)',
        fontSize: 13,
        fontWeight: 800,
        background: bg,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  );
}
