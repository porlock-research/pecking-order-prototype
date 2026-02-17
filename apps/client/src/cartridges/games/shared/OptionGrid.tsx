const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface OptionGridProps {
  options: string[];
  selectedAnswer: number | null;
  onSelect?: (idx: number) => void;
  correctIndex?: number;
  disabled?: boolean;
}

export function OptionGrid({ options, selectedAnswer, onSelect, correctIndex, disabled }: OptionGridProps) {
  const isResultMode = correctIndex !== undefined;

  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map((opt, idx) => {
        const isSelected = selectedAnswer === idx;
        const isCorrect = correctIndex === idx;

        if (isResultMode) {
          const isPlayerWrong = isSelected && !isCorrect;
          return (
            <div
              key={idx}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all
                ${isCorrect
                  ? 'bg-skin-green/15 border-skin-green/40 text-skin-green ring-1 ring-skin-green/30'
                  : isPlayerWrong
                    ? 'bg-skin-danger/15 border-skin-danger/40 text-skin-danger'
                    : 'bg-white/[0.02] border-white/[0.04] text-skin-dim opacity-40'
                }`}
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0
                ${isCorrect
                  ? 'bg-skin-green text-skin-inverted'
                  : isPlayerWrong
                    ? 'bg-skin-danger text-skin-inverted'
                    : 'bg-white/[0.06] text-skin-dim'
                }`}>
                {isCorrect ? '\u2713' : isPlayerWrong ? '\u2717' : OPTION_LABELS[idx]}
              </span>
              <span>{opt}</span>
            </div>
          );
        }

        return (
          <button
            key={idx}
            onClick={() => onSelect?.(idx)}
            disabled={disabled || selectedAnswer !== null}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm
              ${isSelected
                ? 'bg-skin-gold/20 border-skin-gold/50 text-skin-gold'
                : selectedAnswer !== null
                  ? 'bg-white/[0.02] border-white/[0.04] text-skin-dim opacity-50 cursor-default'
                  : 'bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]'
              }`}
          >
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0
              ${isSelected ? 'bg-skin-gold text-skin-inverted' : 'bg-white/[0.06] text-skin-dim'}`}>
              {OPTION_LABELS[idx]}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
