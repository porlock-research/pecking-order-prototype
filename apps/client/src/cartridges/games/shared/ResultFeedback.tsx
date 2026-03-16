interface ResultFeedbackProps {
  correct: boolean;
  silver: number;
  speedBonus: number;
}

/**
 * Compact inline feedback shown after answering.
 * Uses a zero-height wrapper so it doesn't increase the cartridge size.
 */
export function ResultFeedback({ correct, silver, speedBonus }: ResultFeedbackProps) {
  return (
    <div style={{ height: 0, overflow: 'visible', position: 'relative', zIndex: 5 }}>
      <div
        className={`text-center py-1.5 px-3 rounded-lg ${correct ? 'bg-skin-green/10' : 'bg-skin-danger/10'} animate-fade-in`}
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        {correct ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-bold text-skin-green">Correct!</span>
            <span className="text-xs font-mono font-bold text-skin-green">+{silver} silver</span>
          </div>
        ) : (
          <span className="text-sm font-bold text-skin-danger">Wrong answer</span>
        )}
      </div>
    </div>
  );
}
