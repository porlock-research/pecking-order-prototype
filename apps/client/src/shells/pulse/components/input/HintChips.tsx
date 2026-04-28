import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChannelType, ChannelCapability, DayPhase } from '@pecking-order/shared-types';
import { DayPhases } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

type ChipVisibility =
  | { kind: 'capability'; cap: ChannelCapability }
  | { kind: 'channelType'; allow: ChannelType[] };

/**
 * `requires` is a phase gate: the chip only shows when the named flag is true.
 * Separate from `visibility` (which is channel/capability-scoped and static for
 * the session) — these flags flip during the day as OPEN_* / CLOSE_* fire.
 */
// `description` is the plain-language tooltip shown via aria-label + title.
// First-time players see slash-commands and need to know what they do without
// having to tap to find out. Keep each under ~60 chars so the native tooltip
// doesn't wrap awkwardly on desktop and screen readers don't drone.
const chips: Array<{
  label: string;
  command: Command;
  color: string;
  description: string;
  visibility: ChipVisibility;
  requires?: 'groupChatOpen' | 'dmsOpen';
}> = [
  { label: '/silver',  command: 'silver',  color: 'var(--pulse-gold)',    description: 'Send silver to a cast member.',                                  visibility: { kind: 'capability',  cap: 'SILVER_TRANSFER' } },
  { label: '/nudge',   command: 'nudge',   color: 'var(--pulse-nudge)',   description: 'Nudge a quiet player to say something.',                         visibility: { kind: 'capability',  cap: 'NUDGE' } },
  { label: '/dm',      command: 'dm',      color: 'var(--pulse-accent)',  description: 'Open a private DM with one player.',                             visibility: { kind: 'channelType', allow: ['MAIN'] }, requires: 'dmsOpen' },
  { label: '/whisper', command: 'whisper', color: 'var(--pulse-whisper)', description: 'Whisper privately — others see a lock, only your target reads.', visibility: { kind: 'capability',  cap: 'WHISPER' }, requires: 'dmsOpen' },
  { label: '@mention', command: 'mention', color: 'var(--pulse-text-2)',  description: 'Tag a player by name in your message.',                          visibility: { kind: 'channelType', allow: ['MAIN', 'GROUP_DM'] }, requires: 'groupChatOpen' },
];

interface HintChipsProps {
  onSelect: (command: Command) => void;
  channelType?: ChannelType;
  capabilities?: ChannelCapability[];
  groupChatOpen?: boolean;
  dmsOpen?: boolean;
  /** Phase-aware bypass: /whisper is valid during pregame even though
   *  dmsOpen is false (l3-pregame's canWhisper guard skips the dmsOpen
   *  check by design). */
  phase?: DayPhase;
}

// One-shot helper text shown beneath the chips on first encounter, dismissed
// after the user taps any chip or the explicit ×. Title/aria tooltips only
// fire on desktop hover — mobile players (the target audience) need a visible
// affordance to learn what slash-commands do. The localStorage key is global
// (not gameId/playerId-scoped) because chip semantics don't change per game;
// once a player learns, they shouldn't see the hint again next time.
const HINT_SEEN_KEY = 'po-pulse-hint-chips-seen';

function useHintSeen(): { seen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState(true); // optimistic: assume seen until checked
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(HINT_SEEN_KEY) === '1');
    } catch {
      setSeen(true); // localStorage unavailable → don't pester
    }
  }, []);
  const markSeen = () => {
    setSeen(true);
    try { localStorage.setItem(HINT_SEEN_KEY, '1'); } catch {}
  };
  return { seen, markSeen };
}

export function HintChips({
  onSelect,
  channelType = 'MAIN',
  capabilities = [],
  groupChatOpen = true,
  dmsOpen = true,
  phase,
}: HintChipsProps) {
  const { seen, markSeen } = useHintSeen();
  const visible = chips.filter(c => {
    const staticOk = c.visibility.kind === 'capability'
      ? capabilities.includes(c.visibility.cap)
      : c.visibility.allow.includes(channelType);
    if (!staticOk) return false;
    if (c.requires === 'groupChatOpen' && !groupChatOpen) return false;
    if (c.requires === 'dmsOpen' && !dmsOpen) {
      // Pregame exception: whisper is always allowed in pregame.
      const whisperInPregame = c.command === 'whisper' && phase === DayPhases.PREGAME;
      if (!whisperInPregame) return false;
    }
    return true;
  });

  if (visible.length === 0) return null;

  const handleSelect = (command: Command) => {
    markSeen();
    onSelect(command);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {visible.map(h => (
        <motion.button
          key={h.label}
          whileTap={{ scale: 0.94, backgroundColor: `${h.color}22` }}
          transition={{ backgroundColor: { duration: 0.12 } }}
          onClick={() => handleSelect(h.command)}
          aria-label={`${h.label} — ${h.description}`}
          title={h.description}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px 5px 9px',
            borderRadius: 'var(--pulse-radius-md)',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--po-font-body)',
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
            color: 'var(--pulse-text-2)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {/* Leading dot carries the command's accent — hue is type-identity,
              not decoration, so only one pixel-scale worth of color per chip. */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: h.color,
              flexShrink: 0,
            }}
          />
          {h.label}
        </motion.button>
      ))}
      </div>
      <AnimatePresence>
        {!seen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--pulse-text-3)',
              fontStyle: 'italic',
              fontFamily: 'var(--po-font-body)',
              paddingLeft: 4,
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.35 }}>
              Tap a chip to act on a player — silver, nudge, DM, whisper.
            </span>
            <button
              onClick={markSeen}
              aria-label="Dismiss hint"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                border: 'none',
                background: 'transparent',
                color: 'var(--pulse-text-3)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
