interface ResultFeedbackProps {
  correct: boolean;
  silver: number;
  speedBonus: number;
}

export function ResultFeedback({ correct, silver, speedBonus }: ResultFeedbackProps) {
  return (
    <div className={`text-center py-2 rounded-lg ${correct ? 'bg-skin-green/10' : 'bg-skin-danger/10'}`}>
      {correct ? (
        <div>
          <span className="text-sm font-bold text-skin-green">Correct!</span>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-skin-green">+{silver - speedBonus} base</span>
            {speedBonus > 0 && (
              <span className="text-xs font-mono text-skin-gold">+{speedBonus} speed</span>
            )}
            <span className="text-xs font-mono font-bold text-skin-green">= +{silver} silver</span>
          </div>
        </div>
      ) : (
        <span className="text-sm font-bold text-skin-danger">Wrong answer</span>
      )}
    </div>
  );
}
