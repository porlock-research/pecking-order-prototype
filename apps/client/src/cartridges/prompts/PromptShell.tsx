import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { useCartridgeStage } from '../CartridgeStageContext';

/**
 * Shared primitives for the six prompt cartridges. Prompts are
 * deliberately distinct from dilemmas: where dilemmas are cinematic
 * (halo portraits, centered drama), prompts are editorial — the prompt
 * text is the hero, choices feel like a conversation, post-submit reads
 * like an outgoing chat bubble.
 *
 * All tokens go through `--po-*` so the shell can retheme.
 */

export const PROMPT_ACCENT: Record<string, string> = {
  HOT_TAKE:          'var(--po-orange)', // heat, flame
  WOULD_YOU_RATHER:  'var(--po-violet)', // duality
  CONFESSION:        'var(--po-pink)',   // intimate, spicy
  GUESS_WHO:         'var(--po-blue)',   // mystery, detective
  PLAYER_PICK:       'var(--po-gold)',   // affinity, crown
  PREDICTION:        'var(--po-green)',  // forecast, hunch
};

/** Display label per type — matches what the player sees in the header pill. */
export const PROMPT_LABEL: Record<string, string> = {
  HOT_TAKE:          'Hot Take',
  WOULD_YOU_RATHER:  'Would You Rather',
  CONFESSION:        'Confession',
  GUESS_WHO:         'Guess Who',
  PLAYER_PICK:       'Player Pick',
  PREDICTION:        'Prediction',
};

/** Stable "how it works" copy per type — rule of the game, not phase hint.
 *  Hosted externally by the Pulse cartridge stage; inlined elsewhere.  */
export const PROMPT_HOW_IT_WORKS: Record<string, string> = {
  HOT_TAKE:
    'Pick Agree or Disagree. Being in the minority earns bonus silver.',
  WOULD_YOU_RATHER:
    'Pick A or B. Being in the minority earns bonus silver.',
  CONFESSION:
    'Write anonymously, then vote for the best. Best confession wins +15 silver.',
  GUESS_WHO:
    'Answer anonymously, then guess who wrote each. +5 per correct, +10 per player you fool.',
  PLAYER_PICK:
    'Pick another player. Mutual picks earn +10 silver each.',
  PREDICTION:
    'Predict who the group will pick. Matching the crowd earns bonus silver.',
};

/* ------------------------------------------------------------------ */
/*  PromptShell — outer chassis. Header + quote + active slot.         */
/* ------------------------------------------------------------------ */

interface PromptShellProps {
  type: string;
  accentColor: string;
  /** "3/6 decided" or phase-specific. */
  status: string;
  /** Green "Submitted" / "Voted" chip. Rendered right of status. */
  statusBadge?: string;
  /** The big italic quote. */
  promptText: string;
  /** Optional small helper line right under the quote — /clarify touch. */
  helper?: string;
  /** Participants data. If `respondedIds` is undefined the strip hides (use
   *  for anonymous phases where the server strips who has submitted). */
  eligibleIds?: string[];
  respondedIds?: string[];
  roster?: Record<string, SocialPlayer>;
  children: React.ReactNode;
}

export function PromptShell({
  type,
  accentColor,
  status,
  statusBadge,
  promptText,
  helper,
  eligibleIds,
  respondedIds,
  roster,
  children,
}: PromptShellProps) {
  const { staged } = useCartridgeStage();
  // Only show the strip once at least one person has responded. Showing
  // all-grayscale dashed avatars before anyone votes adds noise without
  // meaning — viewers can't tell what they represent. Also hidden when
  // staged: the stage host renders a bigger cast strip below the card.
  const showStrip =
    !staged &&
    !!eligibleIds &&
    !!respondedIds &&
    !!roster &&
    eligibleIds.length > 0 &&
    respondedIds.length > 0;
  const reduce = useReducedMotion();
  const label = PROMPT_LABEL[type] || type;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        margin: '10px 0',
        borderRadius: 18,
        overflow: 'hidden',
        background: `linear-gradient(180deg, color-mix(in oklch, ${accentColor} 8%, var(--po-bg-panel, rgba(0,0,0,0.3))) 0%, var(--po-bg-panel, rgba(0,0,0,0.3)) 60%)`,
        border: `1px solid color-mix(in oklch, ${accentColor} 22%, transparent)`,
        boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
      }}
    >
      {/* Header — minimal strip, floating, no divider. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            {label}
          </span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'var(--po-text-dim)',
              opacity: 0.6,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--po-text-dim)',
              letterSpacing: '0.06em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {status}
          </span>
        </div>
        {statusBadge && (
          <motion.span
            initial={reduce ? undefined : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: 'var(--po-green, #4ade80)',
              textTransform: 'uppercase',
            }}
          >
            {statusBadge}
          </motion.span>
        )}
      </div>

      {/* Hero quote — the prompt text IS the hero in prompts. On the
          Pulse stage it scales up to billboard size and breathes more
          so the decision beat has room to land before the action. */}
      <div style={{ padding: staged ? '14px 22px 26px' : '14px 20px 14px' }}>
        <blockquote
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: staged
              ? 'clamp(28px, 7.5vw, 42px)'
              : 'clamp(20px, 5.2vw, 26px)',
            fontStyle: 'italic',
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: -0.5,
            color: 'var(--po-text)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: staged
                ? 'clamp(44px, 11vw, 62px)'
                : 'clamp(32px, 8vw, 42px)',
              fontWeight: 600,
              color: accentColor,
              opacity: 0.9,
              marginRight: 8,
              lineHeight: 0.4,
              verticalAlign: '-0.1em',
            }}
          >
            “
          </span>
          {promptText}
        </blockquote>
      </div>

      {/* Body — how-it-works (only when not staged) + participants + children.
          When staged, the host renders HOW IT WORKS as a distinct card above
          the cartridge, so we skip it here to keep the cartridge tight —
          hero quote and action belong together. */}
      <div
        style={{
          padding: staged ? '0 18px 22px' : '0 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: staged ? 18 : 14,
        }}
      >
        {helper && !staged && <HowItWorks text={helper} accentColor={accentColor} />}
        {showStrip && (
          <ParticipantsStrip
            eligibleIds={eligibleIds!}
            respondedIds={respondedIds!}
            roster={roster!}
            accentColor={accentColor}
          />
        )}
        {children}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ParticipantsStrip — who's responded so far. Same mechanic as the   */
/*  dilemma ParticipationStrip but composed differently: left-aligned, */
/*  smaller avatars, no duplicate "X of Y" text (already in header).   */
/* ------------------------------------------------------------------ */

function ParticipantsStrip({
  eligibleIds,
  respondedIds,
  roster,
  accentColor,
}: {
  eligibleIds: string[];
  respondedIds: string[];
  roster: Record<string, SocialPlayer>;
  accentColor: string;
}) {
  const respondedSet = new Set(respondedIds);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {eligibleIds.map((pid) => {
        const player = roster[pid];
        if (!player) return null;
        const did = respondedSet.has(pid);
        return (
          <div
            key={pid}
            title={player.personaName}
            style={{
              position: 'relative',
              borderRadius: '50%',
              padding: 1.5,
              background: did
                ? `conic-gradient(from 180deg, ${accentColor}, color-mix(in oklch, ${accentColor} 40%, transparent), ${accentColor})`
                : 'transparent',
              border: did ? 'none' : '1.5px dashed var(--po-border, rgba(255,255,255,0.14))',
              opacity: did ? 1 : 0.55,
              transition: 'opacity 0.25s ease',
              filter: did ? 'none' : 'grayscale(35%)',
            }}
          >
            <PersonaAvatar
              avatarUrl={player.avatarUrl}
              personaName={player.personaName}
              size={30}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HowItWorks — stakes-copy panel. Readable, authoritative; drops the */
/*  italic/caption whisper in favor of a micro-labeled rule block.     */
/* ------------------------------------------------------------------ */

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
          fontSize: 14.5,
          lineHeight: 1.5,
          fontWeight: 500,
          color: 'var(--po-text)',
          letterSpacing: 0.05,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LockedInReceipt — post-submit chat-bubble style. Distinct from     */
/*  dilemma's centered halo card.                                      */
/* ------------------------------------------------------------------ */

export function LockedInReceipt({
  accentColor,
  label,
  value,
  waitingText = 'Waiting for the rest…',
}: {
  accentColor: string;
  /** e.g. "You voted", "You picked", "You predicted" */
  label: string;
  /** Display content — short string or node */
  value: React.ReactNode;
  waitingText?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        marginTop: 4,
      }}
    >
      {/* Outgoing chat-bubble style — right-aligned, accent-filled */}
      <div
        style={{
          maxWidth: '86%',
          padding: '10px 14px',
          borderRadius: '14px 14px 4px 14px',
          background: `color-mix(in oklch, ${accentColor} 18%, transparent)`,
          border: `1px solid color-mix(in oklch, ${accentColor} 38%, transparent)`,
          boxShadow: `0 0 18px color-mix(in oklch, ${accentColor} 24%, transparent)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: -0.2,
            color: 'var(--po-text)',
            lineHeight: 1.25,
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 11,
          color: 'var(--po-text-dim)',
          letterSpacing: 0.1,
          fontStyle: 'italic',
          paddingRight: 6,
        }}
      >
        {waitingText}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  PersonaPicker — 2-col grid of big persona tiles with Lock-in CTA   */
/*  shared by PlayerPick + Prediction.                                 */
/* ------------------------------------------------------------------ */

export function PersonaPicker({
  candidates,
  roster,
  accentColor,
  selectedId,
  onSelect,
  ctaLabel,
  onConfirm,
}: {
  candidates: string[];
  roster: Record<string, SocialPlayer>;
  accentColor: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  ctaLabel: string;
  onConfirm: () => void;
}) {
  const reduce = useReducedMotion();
  const selectedName = selectedId
    ? (roster[selectedId]?.personaName || selectedId).split(' ')[0]
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 10,
        }}
      >
        {candidates.map((pid, i) => {
          const player = roster[pid];
          if (!player) return null;
          const isSelected = selectedId === pid;
          const firstName = (player.personaName || pid).split(' ')[0];
          const someoneElseSelected = selectedId !== null && !isSelected;
          return (
            <motion.button
              key={pid}
              onClick={() => onSelect(pid)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: 'spring', stiffness: 400, damping: 25, delay: i * 0.025 }
              }
              whileTap={reduce ? undefined : { scale: 0.97 }}
              whileHover={reduce ? undefined : { y: -2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '10px 6px 12px',
                borderRadius: 14,
                background: isSelected
                  ? `color-mix(in oklch, ${accentColor} 14%, transparent)`
                  : 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                border: `1.5px solid ${
                  isSelected ? accentColor : 'var(--po-border, rgba(255,255,255,0.08))'
                }`,
                cursor: 'pointer',
                boxShadow: isSelected
                  ? `0 0 18px color-mix(in oklch, ${accentColor} 38%, transparent)`
                  : 'none',
                opacity: someoneElseSelected ? 0.55 : 1,
                transition:
                  'opacity 0.2s, box-shadow 0.25s, border-color 0.2s, background 0.2s',
              }}
            >
              <PersonaAvatar
                avatarUrl={player.avatarUrl}
                personaName={player.personaName}
                size={88}
              />
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.1,
                  color: isSelected ? accentColor : 'var(--po-text)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  transition: 'color 0.2s',
                }}
              >
                {firstName}
              </span>
            </motion.button>
          );
        })}
      </div>

      {selectedId && (
        <motion.button
          onClick={onConfirm}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          style={{
            padding: '14px 28px',
            borderRadius: 9999,
            background: accentColor,
            color: 'var(--po-text-inverted, #111)',
            border: 'none',
            fontWeight: 800,
            fontSize: 14,
            fontFamily: 'var(--po-font-display)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            cursor: 'pointer',
            boxShadow: `0 4px 22px color-mix(in oklch, ${accentColor} 50%, transparent)`,
            alignSelf: 'center',
          }}
        >
          {ctaLabel} {selectedName}
        </motion.button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WinnerSpread — magazine-spread horizontal winner portrait. Distinct*/
/*  from dilemma's vertical centered cinema frame.                     */
/* ------------------------------------------------------------------ */

export function WinnerSpread({
  player,
  accentColor,
  label,
  name,
  sublabel,
}: {
  player?: SocialPlayer;
  accentColor: string;
  /** e.g. "MOST PICKED", "BEST CONFESSION", "GROUP PREDICTION" */
  label: string;
  name: string;
  /** e.g. "4 picks", "+15 silver", "Unanimous" */
  sublabel?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -10, scale: 0.97 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: [0.97, 1.02, 1] }}
      transition={{ duration: 0.55, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 16,
        background: `linear-gradient(90deg, color-mix(in oklch, ${accentColor} 18%, transparent) 0%, color-mix(in oklch, ${accentColor} 6%, transparent) 60%, transparent 100%)`,
        border: `1.5px solid color-mix(in oklch, ${accentColor} 38%, transparent)`,
        boxShadow: `0 0 32px color-mix(in oklch, ${accentColor} 22%, transparent)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 88,
          height: 88,
          borderRadius: '50%',
          padding: 2.5,
          background: `conic-gradient(from 210deg, ${accentColor}, color-mix(in oklch, ${accentColor} 35%, transparent), ${accentColor})`,
          boxShadow: `0 0 22px color-mix(in oklch, ${accentColor} 45%, transparent)`,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--po-bg-panel)',
          }}
        >
          <PersonaAvatar
            avatarUrl={player?.avatarUrl}
            personaName={player?.personaName}
            size={88}
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.28em',
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(22px, 5.5vw, 28px)',
            fontWeight: 700,
            letterSpacing: -0.5,
            lineHeight: 1.05,
            color: 'var(--po-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        {sublabel && (
          <span
            style={{
              marginTop: 2,
              fontFamily: 'var(--po-font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: accentColor,
              letterSpacing: 0.1,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  SilverEarned — shared "You Earned +N silver" beat. Gold hero.     */
/* ------------------------------------------------------------------ */

export function SilverEarned({ amount }: { amount: number }) {
  const reduce = useReducedMotion();
  if (amount === 0) return null;
  const positive = amount > 0;
  const accent = positive ? 'var(--po-gold)' : 'var(--po-pink)';
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.9, 1.08, 1] }}
      transition={{ duration: 0.55, times: [0, 0.55, 1], delay: 0.25 }}
      style={{
        textAlign: 'center',
        padding: '8px 0 2px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--po-text-dim)',
          marginBottom: 4,
        }}
      >
        You Earned
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800,
          letterSpacing: -0.7,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 24px color-mix(in oklch, ${accent} 40%, transparent)`,
        }}
      >
        {positive ? '+' : ''}
        {amount} silver
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  SectionLabel — small caps section divider inside results.          */
/* ------------------------------------------------------------------ */

export function SectionLabel({
  children,
  accentColor = 'var(--po-text-dim)',
}: {
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--po-font-display)',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.24em',
        color: accentColor,
        textTransform: 'uppercase',
        textAlign: 'center',
        opacity: 0.85,
      }}
    >
      {children}
    </p>
  );
}
