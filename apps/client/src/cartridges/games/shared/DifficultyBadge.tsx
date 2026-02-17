const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-skin-green/15 text-skin-green border-skin-green/30',
  medium: 'bg-skin-gold/15 text-skin-gold border-skin-gold/30',
  hard: 'bg-skin-danger/15 text-skin-danger border-skin-danger/30',
};

interface DifficultyBadgeProps {
  category?: string;
  difficulty?: string;
}

export function DifficultyBadge({ category, difficulty }: DifficultyBadgeProps) {
  if (!category && !difficulty) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {category && (
        <span className="text-[9px] font-mono text-skin-dim bg-white/[0.04] border border-white/[0.08] rounded-pill px-2 py-0.5 uppercase tracking-wider">
          {category}
        </span>
      )}
      {difficulty && (
        <span className={`text-[9px] font-mono border rounded-pill px-2 py-0.5 uppercase tracking-wider ${DIFFICULTY_COLORS[difficulty] || ''}`}>
          {difficulty}
        </span>
      )}
    </div>
  );
}
