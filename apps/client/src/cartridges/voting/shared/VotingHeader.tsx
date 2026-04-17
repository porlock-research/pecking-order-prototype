import { useCartridgeStage } from '../../CartridgeStageContext';

interface VotingHeaderProps {
  /** Short mechanism name (info.name from VOTE_TYPE_INFO) — e.g. "Majority". */
  mechanismName: string;
  /** Atmospheric tagline rendered below the mechanism label — e.g. "Most votes go home". */
  moodSubtitle?: string;
  /** Call-to-action — e.g. "Who should go?" */
  cta: string;
  /** Full rules text — always visible inline, hidden when staged (host renders externally). */
  howItWorks: string;
  /** Accent color, expected to be a CSS var like 'var(--po-orange)'. */
  accentColor: string;
}

/**
 * Shell-agnostic voting header — mirrors PromptShell's header pattern.
 *
 * - Mechanism label + optional mood subtitle + CTA always render (cartridge identity).
 * - HowItWorks panel renders inline ONLY when not staged. When staged on
 *   the Pulse cartridge stage, the stage host renders HOW IT WORKS as a
 *   distinct neutral card above the cartridge — keeping the cartridge
 *   itself tight (header + action belong together).
 *
 * Always-open: rules card is never collapsed. Playtester feedback: no
 * veterans yet, hiding rules behind a button costs comprehension.
 */
export function VotingHeader({
  mechanismName,
  moodSubtitle,
  cta,
  howItWorks,
  accentColor,
}: VotingHeaderProps) {
  const { staged } = useCartridgeStage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Mechanism label + mood subtitle — title-card voice. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignSelf: 'flex-start' }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {mechanismName}
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
              fontStyle: 'normal',
            }}
          >
            {moodSubtitle}
          </span>
        )}
      </div>

      {/* CTA — primary statement of intent. */}
      {cta && (
        <p
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: -0.4,
            color: 'var(--po-text)',
            margin: 0,
          }}
          data-testid="voting-cta"
        >
          {cta}
        </p>
      )}

      {/* HowItWorks — only inline when not staged. */}
      {!staged && <HowItWorks text={howItWorks} accentColor={accentColor} />}
    </div>
  );
}

function HowItWorks({ text, accentColor }: { text: string; accentColor: string }) {
  return (
    <div
      style={{
        padding: '12px 14px 13px',
        borderRadius: 12,
        background: `color-mix(in oklch, ${accentColor} 9%, var(--po-bg-glass, rgba(255,255,255,0.04)))`,
        border: `1px solid color-mix(in oklch, ${accentColor} 26%, transparent)`,
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
          color: accentColor,
          textTransform: 'uppercase',
        }}
      >
        How it works
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          lineHeight: 1.45,
          color: 'var(--po-text)',
          fontWeight: 500,
        }}
      >
        {text}
      </p>
    </div>
  );
}
