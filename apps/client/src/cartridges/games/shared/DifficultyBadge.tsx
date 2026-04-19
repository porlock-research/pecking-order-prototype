interface DifficultyBadgeProps {
  category?: string;
  difficulty?: string;
}

const DIFFICULTY_TONE: Record<string, string> = {
  easy: 'var(--po-green)',
  medium: 'var(--po-gold)',
  hard: 'var(--po-pink)',
};

/**
 * Small category + difficulty pills shown above a trivia question.
 * Shell-agnostic via --po-* tokens.
 */
export function DifficultyBadge({ category, difficulty }: DifficultyBadgeProps) {
  if (!category && !difficulty) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {category && <Pill text={category} tone="var(--po-text-dim)" muted />}
      {difficulty && (
        <Pill text={difficulty} tone={DIFFICULTY_TONE[difficulty] ?? 'var(--po-text-dim)'} />
      )}
    </div>
  );
}

function Pill({ text, tone, muted }: { text: string; tone: string; muted?: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'var(--po-font-display)',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: tone,
        background: muted
          ? `color-mix(in oklch, var(--po-text) 6%, transparent)`
          : `color-mix(in oklch, ${tone} 12%, transparent)`,
        border: muted
          ? `1px solid var(--po-border)`
          : `1px solid color-mix(in oklch, ${tone} 28%, transparent)`,
        borderRadius: 999,
        padding: '3px 9px',
      }}
    >
      {text}
    </span>
  );
}
