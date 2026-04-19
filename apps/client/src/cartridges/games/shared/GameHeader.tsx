import { useCartridgeStage } from '../../CartridgeStageContext';

interface GameHeaderProps {
  /** Display name from CARTRIDGE_INFO — e.g. "Snake". */
  gameName: string;
  /** Atmospheric subtitle (mood from GAME_INFO, falls back to tagline). */
  moodSubtitle?: string;
  /** Optional status line — "Round 2/5", "Best run yet", "First flight". */
  status?: string;
  /** Per-game accent (CSS var like 'var(--po-green)'). */
  accent: string;
  /** Full description text — always visible inline, hidden when staged
   *  (host renders externally via PlayableCartridgeMount.useHowItWorks). */
  howItWorks?: string;
}

/**
 * Shell-agnostic game header — mirrors VotingHeader.
 *
 * - Accent-tinted "GAME" eyebrow + game name (display font, large) + mood subtitle
 *   always render (cartridge identity).
 * - Status line renders right-aligned when present (round info, score, etc.).
 * - HowItWorks panel renders inline ONLY when not staged. When staged on the
 *   Pulse cartridge stage, the stage host renders it as a distinct neutral
 *   card above the cartridge.
 */
export function GameHeader({
  gameName,
  moodSubtitle,
  status,
  accent,
  howItWorks,
}: GameHeaderProps) {
  const { staged } = useCartridgeStage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: accent,
              textTransform: 'uppercase',
            }}
          >
            Game
          </span>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 'clamp(20px, 5vw, 26px)',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: -0.4,
              color: 'var(--po-text)',
            }}
          >
            {gameName}
          </span>
          {moodSubtitle && (
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: -0.1,
                color: 'var(--po-text-dim)',
              }}
            >
              {moodSubtitle}
            </span>
          )}
        </div>

        {status && (
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              fontVariantNumeric: 'tabular-nums',
              alignSelf: 'flex-start',
              padding: '4px 10px',
              borderRadius: 999,
              background: `color-mix(in oklch, ${accent} 14%, transparent)`,
              border: `1px solid color-mix(in oklch, ${accent} 30%, transparent)`,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </span>
        )}
      </div>

      {!staged && howItWorks && <InlineHowItWorks text={howItWorks} accent={accent} />}
    </div>
  );
}

function InlineHowItWorks({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      style={{
        padding: '12px 14px 13px',
        borderRadius: 12,
        background: `color-mix(in oklch, ${accent} 9%, var(--po-bg-glass))`,
        border: `1px solid color-mix(in oklch, ${accent} 26%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.26em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        How it works
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-body)',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--po-text)',
        }}
      >
        {text}
      </p>
    </div>
  );
}
