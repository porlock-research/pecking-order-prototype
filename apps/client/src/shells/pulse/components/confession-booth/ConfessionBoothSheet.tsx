import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { PULSE_SPRING } from '../../springs';
import { Cassette } from './Cassette';
import { ConfessionInput } from '../input/ConfessionInput';

interface Props {
  /** Channel id of the CONFESSION channel, e.g. "CONFESSION-d2". */
  channelId: string;
  onClose: () => void;
}

/**
 * The Confession Booth — overlay sheet that takes over the shell while a
 * confession phase is live. Reads per-recipient projection from store
 * (`confessionPhase.myHandle`, `.posts`). Every newly-arrived cassette
 * animates in via `pulse-cassette-new` (drop-from-above + rim-light pulse);
 * see pulse-theme.css. Sender mic-frame also pink-flashes on submit
 * (ConfessionInput owns that flash internally — ambient context).
 *
 * Overdrive contract: View Transitions API was considered for a sender-only
 * "text-to-cassette morph" (Direction C in mockup 14) but the post arrives
 * async via server SYNC, so there's no in-tick DOM change to morph. The
 * drop-in animation is used uniformly and still reads as dramatic.
 */
export function ConfessionBoothSheet({ channelId, onClose }: Props) {
  const confessionPhase = useGameStore(s => s.confessionPhase);
  const dayIndex = useGameStore(s => s.dayIndex);
  const { engine } = usePulse();

  const myHandle = confessionPhase?.myHandle ?? null;
  const posts = confessionPhase?.posts ?? [];
  // Newest at top of the reel — the latest tape is the most interesting.
  const sortedPosts = [...posts].sort((a, b) => b.ts - a.ts);

  // Track which post-ids we've already seen so newly-arrived ones get the
  // drop-in animation exactly once. Key = `${handle}-${ts}` (the Cassette
  // component uses the same key for React reconciliation).
  const seenRef = useRef<Set<string>>(new Set());
  const [, forceRerender] = useState(0);

  useEffect(() => {
    // Mark current posts as seen after paint so subsequent arrivals can be
    // detected. First render: mark all as already-seen (we don't animate
    // backfill on mount). Subsequent renders: only NEW keys are animated.
    for (const p of posts) {
      seenRef.current.add(`${p.handle}-${p.ts}`);
    }
    // trigger one rerender so our computed `isNew` check below sees the
    // freshly-populated ref — otherwise the first render under a post
    // gets a spurious animation.
    forceRerender((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  const handleSend = useCallback((text: string) => {
    if (!myHandle) return;
    engine.sendConfession(channelId, text);
  }, [channelId, engine, myHandle]);

  return (
    <>
      {/* Backdrop / tap-to-close */}
      <motion.div
        role="presentation"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 4, 10, 0.72)',
          zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />

      <motion.div
        role="dialog"
        aria-label="Confession Booth"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SPRING.page}
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 55% at 18% 12%, rgba(249,169,74,0.16), transparent 60%),' +
            'radial-gradient(ellipse 90% 90% at 90% 100%, rgba(255,59,111,0.08), transparent 60%),' +
            'linear-gradient(180deg, var(--pulse-bg) 0%, var(--pulse-bg-2) 100%)',
          zIndex: PULSE_Z.drawer,
          display: 'flex',
          flexDirection: 'column',
          isolation: 'isolate',
        }}
      >
        {/* VHS scan-line texture overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)',
            mixBlendMode: 'overlay',
            opacity: 0.6,
          }}
        />

        {/* Header */}
        <div style={headerStyle.wrap}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Confession Booth"
            style={headerStyle.back}
          >
            <svg viewBox="0 0 12 12" style={{ width: 14, height: 14, fill: 'currentColor' }}>
              <path d="M8 1 L3 6 L8 11" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
          <div style={headerStyle.title}>
            <div style={headerStyle.eyebrow}>
              <span>DAY {dayIndex} ·</span>
              <OnAirPip active={confessionPhase?.active ?? false} />
            </div>
            <div style={headerStyle.name}>Confession Booth</div>
          </div>
          <div style={{ width: 34 }} />
        </div>

        <div style={headerStyle.meta}>
          <span>{sortedPosts.length} {sortedPosts.length === 1 ? 'tape' : 'tapes'} tonight</span>
          <span style={headerStyle.sep} />
          <span>anonymous to everyone</span>
        </div>

        {/* Feed */}
        <div style={feedStyle}>
          {sortedPosts.length === 0 ? (
            <div style={emptyStateStyle.wrap}>
              <div style={emptyStateStyle.title}>No tapes yet.</div>
              <div style={emptyStateStyle.body}>
                The booth is on air. Drop something in &mdash; everyone sees the tape, no one sees the name.
              </div>
            </div>
          ) : (
            sortedPosts.map((post) => {
              const key = `${post.handle}-${post.ts}`;
              const isNew = !seenRef.current.has(key);
              return (
                <Cassette
                  key={key}
                  handle={post.handle}
                  text={post.text}
                  ts={post.ts}
                  isNew={isNew}
                />
              );
            })
          )}
        </div>

        {/* Composer */}
        <ConfessionInput myHandle={myHandle} onSend={handleSend} />
      </motion.div>
    </>
  );
}

function OnAirPip({ active }: { active: boolean }) {
  const color = active ? '#ff2a3d' : 'var(--pulse-text-3)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 800,
        fontSize: 10,
        letterSpacing: '0.24em',
        color,
        padding: '3px 7px',
        background: active ? 'rgba(255,42,61,0.08)' : 'transparent',
        border: `1px solid ${active ? 'rgba(255,42,61,0.22)' : 'var(--pulse-border)'}`,
        borderRadius: 6,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: active ? '0 0 10px rgba(255,42,61,0.4)' : 'none',
          animation: active ? 'pulse-breathe 1.6s ease-in-out infinite' : 'none',
        }}
      />
      {active ? 'ON AIR' : 'OFF AIR'}
    </span>
  );
}

const headerStyle = {
  wrap: {
    padding: '12px 16px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 2,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'var(--pulse-surface)',
    border: '1px solid var(--pulse-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--pulse-text-2)',
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  eyebrow: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: '0.22em',
    color: 'var(--pulse-text-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  name: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: '-0.02em',
    marginTop: 2,
    color: 'var(--pulse-text-1)',
  },
  meta: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    fontSize: 11,
    color: 'var(--pulse-text-3)',
    letterSpacing: '0.03em',
    paddingBottom: 10,
    borderBottom: '1px solid var(--pulse-border)',
    position: 'relative',
    zIndex: 2,
  },
  sep: {
    width: 3,
    height: 3,
    background: 'var(--pulse-text-4)',
    borderRadius: '50%',
  },
} satisfies Record<string, React.CSSProperties>;

const feedStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 14px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
  zIndex: 1,
};

const emptyStateStyle = {
  wrap: {
    padding: '48px 28px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--pulse-text-2)',
  },
  body: {
    fontSize: 13,
    color: 'var(--pulse-text-3)',
    lineHeight: 1.5,
    maxWidth: 280,
    margin: '0 auto',
  },
} satisfies Record<string, React.CSSProperties>;
