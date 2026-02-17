interface CartridgeHeaderProps {
  label: string;
  roundInfo?: string;
  score?: number;
  showScore?: boolean;
}

export function CartridgeHeader({ label, roundInfo, score, showScore = true }: CartridgeHeaderProps) {
  return (
    <div className="px-4 py-3 bg-skin-gold/5 border-b border-white/[0.06] flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2.5 py-0.5 text-skin-gold uppercase tracking-widest">
          {label}
        </span>
        {roundInfo && (
          <span className="text-xs font-mono text-skin-dim">
            {roundInfo}
          </span>
        )}
      </div>
      {showScore && score !== undefined && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-skin-gold">
          <span className="text-skin-dim">Silver:</span>
          <span className="font-bold">{score}</span>
        </div>
      )}
    </div>
  );
}
