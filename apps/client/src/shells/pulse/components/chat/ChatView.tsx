import { Fragment, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_Z } from '../../zIndex';
import { MessageCard } from './MessageCard';
import { BroadcastCard } from './BroadcastCard';
import { WhisperCard } from './WhisperCard';
import { SilverTransferCard } from './SilverTransferCard';
import { NudgeTransferCard } from './NudgeTransferCard';
import { TypingIndicator } from './TypingIndicator';
import { NarratorLine } from './NarratorLine';
import { PregameJoinLine } from './PregameJoinLine';
import { PregameRevealCard } from './PregameRevealCard';
import { ChatDivider } from './ChatDivider';
import { EventCard } from './EventCard';
import { DayPhases, GAME_MASTER_ID, TickerCategories } from '@pecking-order/shared-types';
import type { TickerMessage, VoteType } from '@pecking-order/shared-types';

// Predicate: is this ticker message a narrator line?
// Fact-driven pipeline (see finite-narrator-lines-fact-driven rule):
//   server fact → factToTicker → SOCIAL_INVITE | SOCIAL_PHASE category → this filter.
// Do NOT derive narrator content from channel shape.
export function isNarratorTicker(t: TickerMessage): boolean {
  return t.category === TickerCategories.SOCIAL_INVITE
    || t.category === TickerCategories.SOCIAL_PHASE;
}

// Map SOCIAL_INVITE ticker kind → NarratorLine visual kind.
// 'initial' covers 1:1 and small-group creation ('talking' / 'scheming' copy
// share the same calm accent color); alliance sizes trigger 'alliance' styling.
function socialInviteToNarratorKind(t: TickerMessage): 'talking' | 'scheming' | 'alliance' {
  if ((t.kind ?? 'initial') === 'add_member') return 'talking';
  // For initial invites, alliance = 5+ total (actor + 4+ recipients), otherwise talking/scheming share 'talking' visuals.
  const partnerCount = Math.max((t.involvedPlayerIds?.length ?? 1) - 1, 0);
  if (partnerCount >= 4) return 'alliance';
  if (partnerCount >= 2) return 'scheming';
  return 'talking';
}

export function ChatView() {
  const chatLog = useGameStore(s => s.chatLog);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const phase = useGameStore(s => s.phase);
  const pregame = useGameStore(s => s.pregame);
  const roster = useGameStore(s => s.roster);
  const mainLastRead = useGameStore(s => s.lastReadTimestamp?.MAIN ?? 0);
  const markChannelRead = useGameStore(s => s.markChannelRead);
  const manifest = useGameStore(s => s.manifest);
  const { playerId, openConfessionBooth } = usePulse();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  // Filter to MAIN channel messages
  const mainMessages = chatLog.filter(
    m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'),
  );

  // First unread MAIN message timestamp — divider anchors here.
  // null if every MAIN message has been read or there are none.
  const firstUnreadMainTs = useMemo(() => {
    for (const m of mainMessages) {
      if (m.timestamp > mainLastRead) return m.timestamp;
    }
    return null;
  }, [mainMessages, mainLastRead]);

  const handleDividerCleared = useCallback(() => {
    markChannelRead('MAIN');
  }, [markChannelRead]);

  // Social events from ticker that should render as inline broadcast cards
  // (silver transfers, nudges, perks — these are facts, not chat messages).
  // Nudges get a dedicated transfer-style card; perks fall back to BroadcastCard.
  const socialEvents: TickerMessage[] = tickerMessages.filter(
    t => t.category === TickerCategories.SOCIAL_TRANSFER
      || t.category === TickerCategories.SOCIAL_NUDGE
      || t.category === TickerCategories.SOCIAL_PERK,
  );

  // Narrator lines come from SOCIAL_INVITE + SOCIAL_PHASE ticker events (fact-driven).
  // Public intrigue copy only — never names targets, never viewer-relative.
  const narratorTickers: TickerMessage[] = tickerMessages.filter(isNarratorTicker);

  // Pregame "First Impressions" — players reveal one of their own pre-game
  // interview answers publicly. Pregame slice is null outside phase==='pregame',
  // so reveals naturally drop from the timeline once Day 1 starts (the journal
  // in D1 still has the record). Render as NarratorLine, not chat bubbles —
  // these are public flair, not conversation.
  const pregameReveals: Array<{ ts: number; actorId: string; question: string; answer: string }> = useMemo(() => {
    if (!pregame?.revealedAnswers) return [];
    return Object.entries(pregame.revealedAnswers).map(([actorId, r]) => ({
      ts: r.revealedAt,
      actorId,
      question: r.question,
      answer: r.answer,
    }));
  }, [pregame]);

  // Pregame "joined the cast" lines — derived from the SYNC pregame.players slice.
  // Skip self (you don't need to see yourself arrive). Like reveals, these drop
  // automatically once Day 1 starts and the slice goes away.
  const pregameJoins: Array<{ ts: number; actorId: string }> = useMemo(() => {
    if (!pregame?.players) return [];
    return Object.entries(pregame.players)
      .filter(([actorId]) => actorId !== playerId)
      .map(([actorId, p]) => ({ ts: p.joinedAt, actorId }));
  }, [pregame, playerId]);

  // Dramatic event cards — ELIMINATION + PHASE_WINNER tickers are the day's
  // peak-end beats. Server already emits these via factToTicker; we render
  // them inline as mechanism-aware <EventCard>.
  const eventTickers: TickerMessage[] = tickerMessages.filter(
    t => t.category === TickerCategories.ELIMINATION
      || t.category === TickerCategories.PHASE_WINNER,
  );

  // Interleave messages, social events, narrator lines, and event cards by timestamp
  type TimelineEntry =
    | { type: 'msg'; data: any; ts: number }
    | { type: 'social'; data: TickerMessage; ts: number }
    | { type: 'narrator'; data: TickerMessage; ts: number }
    | { type: 'event'; data: TickerMessage; ts: number }
    | { type: 'pregame-reveal'; data: { actorId: string; question: string; answer: string }; ts: number }
    | { type: 'pregame-join'; data: { actorId: string }; ts: number };

  const timeline: TimelineEntry[] = [
    ...mainMessages.map(m => ({ type: 'msg' as const, data: m, ts: m.timestamp })),
    ...socialEvents.map(t => ({ type: 'social' as const, data: t, ts: t.timestamp })),
    ...narratorTickers.map(t => ({ type: 'narrator' as const, data: t, ts: t.timestamp })),
    ...eventTickers.map(t => ({ type: 'event' as const, data: t, ts: t.timestamp })),
    ...pregameReveals.map(r => ({
      type: 'pregame-reveal' as const,
      data: { actorId: r.actorId, question: r.question, answer: r.answer },
      ts: r.ts,
    })),
    ...pregameJoins.map(j => ({
      type: 'pregame-join' as const,
      data: { actorId: j.actorId },
      ts: j.ts,
    })),
  ].sort((a, b) => a.ts - b.ts);

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const isSocialPhase = phase !== DayPhases.ELIMINATION && phase !== DayPhases.GAME_OVER;

  // Group consecutive messages from the same sender.
  //
  // Window is asymmetric: self messages coalesce for up to 10 minutes so
  // "spam your own thought" sessions don't each get a fresh avatar + fresh
  // bubble (the "wall of pink self" critique, v3). Other senders use the
  // usual 2-minute window — rapid replies from other players group tight,
  // but conversation gaps break the group so the persona avatar returns
  // to remind you who's talking.
  //
  // continuationDepth is 0 for the first message of a stack, 1+ for
  // continuations. MessageCard uses it to fade the self-bubble fill on
  // successive messages so a stack has visible rhythm.
  const SELF_STACK_WINDOW_MS = 600_000; // 10 min
  const OTHER_STACK_WINDOW_MS = 120_000; // 2 min
  const grouped: Array<{ entry: TimelineEntry; showHeader: boolean; continuationDepth: number }> = [];
  let depth = 0;
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    const prev = i > 0 ? timeline[i - 1] : null;
    let showHeader = true;
    if (entry.type === 'msg' && prev?.type === 'msg') {
      const sameSender = prev.data.senderId === entry.data.senderId;
      const isSelf = entry.data.senderId === playerId;
      const windowMs = isSelf ? SELF_STACK_WINDOW_MS : OTHER_STACK_WINDOW_MS;
      const withinWindow = entry.data.timestamp - prev.data.timestamp <= windowMs;
      showHeader = !sameSender || !withinWindow;
    }
    depth = showHeader ? 0 : depth + 1;
    grouped.push({ entry, showHeader, continuationDepth: depth });
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: 'var(--pulse-space-sm) var(--pulse-space-md)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {!isSocialPhase && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--pulse-text-3)',
            fontSize: 12,
            padding: 16,
            fontStyle: 'italic',
          }}
        >
          Chat opens at dawn
        </div>
      )}

      {grouped.map(({ entry, showHeader, continuationDepth }, i) => {
        // Insert the "New" divider before the first unread MAIN message
        // (only possible before an entry of type 'msg' with channelId MAIN).
        const isFirstUnreadMain =
          firstUnreadMainTs !== null &&
          entry.type === 'msg' &&
          (entry.data.channelId === 'MAIN' || (!entry.data.channelId && entry.data.channel === 'MAIN')) &&
          entry.data.timestamp === firstUnreadMainTs;
        const divider = isFirstUnreadMain
          ? <ChatDivider key={`divider-${i}`} onCleared={handleDividerCleared} />
          : null;

        if (entry.type === 'narrator') {
          // SOCIAL_PHASE tickers carry an entry action — tap opens the booth.
          const t = entry.data;
          const isConfessionOpen = t.category === TickerCategories.SOCIAL_PHASE
            && (t as any).channelId
            && t.kind === 'confession-open';
          return (
            <NarratorLine
              key={t.id}
              kind={t.category === TickerCategories.SOCIAL_PHASE ? 'alliance' : socialInviteToNarratorKind(t)}
              text={t.text}
              onTap={isConfessionOpen ? () => openConfessionBooth((t as any).channelId) : undefined}
            />
          );
        }
        if (entry.type === 'pregame-join') {
          return (
            <PregameJoinLine
              key={`pregame-join-${entry.data.actorId}-${entry.ts}`}
              actorId={entry.data.actorId}
            />
          );
        }
        if (entry.type === 'pregame-reveal') {
          // First Impressions — public self-reveal of one QA answer. Bespoke
          // PregameRevealCard ("ON THE RECORD" magazine treatment) since the
          // whisper-tier NarratorLine doesn't carry enough weight for what
          // is, in v2, the only way to learn anything substantive about a
          // cast member (dossier QAs default to sealed).
          const r = entry.data;
          return (
            <PregameRevealCard
              key={`pregame-reveal-${r.actorId}-${entry.ts}`}
              actorId={r.actorId}
              question={r.question}
              answer={r.answer}
            />
          );
        }
        // Dramatic event card — ELIMINATION / PHASE_WINNER tickers.
        if (entry.type === 'event') {
          const t = entry.data;
          const playerId = t.involvedPlayerIds?.[0];
          if (!playerId) return null;
          const p = roster[playerId] as { personaName?: string; avatarUrl?: string; eliminatedOnDay?: number } | undefined;
          if (!p) return null;
          const playerIndex = Object.keys(roster).indexOf(playerId);
          const isWinner = t.category === TickerCategories.PHASE_WINNER;
          const days = manifest?.days ?? [];
          // For elim, look up the day the player fell. For winner, use the
          // last scheduled voting day (always FINALS by convention).
          const dayIdx = isWinner
            ? days.length
            : (p.eliminatedOnDay ?? 0);
          const dayEntry = days[dayIdx - 1];
          const voteType = (dayEntry?.voteType ?? (isWinner ? 'FINALS' : 'MAJORITY')) as VoteType;
          return (
            <EventCard
              key={t.id}
              kind={isWinner ? 'winner' : 'elimination'}
              player={{
                id: playerId,
                personaName: p.personaName ?? '',
                avatarUrl: p.avatarUrl,
              }}
              playerIndex={playerIndex >= 0 ? playerIndex : 0}
              dayIndex={dayIdx}
              voteType={voteType}
            />
          );
        }
        // Social event from ticker (silver, nudge, perk) — inline broadcast card
        if (entry.type === 'social') {
          const t = entry.data;
          // Silver transfers get the richer avatar-based card
          if (t.category === TickerCategories.SOCIAL_TRANSFER) {
            return (
              <SilverTransferCard
                key={`social-${t.timestamp}-${t.text.slice(0, 20)}`}
                text={t.text}
                timestamp={t.timestamp}
              />
            );
          }
          // Nudges get a matching avatar-based pill (same grammar as silver).
          if (t.category === TickerCategories.SOCIAL_NUDGE) {
            return (
              <NudgeTransferCard
                key={`social-${t.timestamp}-${t.text.slice(0, 20)}`}
                text={t.text}
                timestamp={t.timestamp}
              />
            );
          }
          // Other social events (perk) use the simpler broadcast card
          return (
            <BroadcastCard
              key={`social-${t.timestamp}-${t.text.slice(0, 20)}`}
              message={{
                id: `social-${t.timestamp}`,
                senderId: 'SYSTEM',
                timestamp: t.timestamp,
                content: t.text,
                channelId: 'MAIN',
              } as any}
            />
          );
        }

        const msg = entry.data;
        // Redacted whisper
        if (msg.whisperTarget && msg.redacted) {
          return <Fragment key={msg.id}>{divider}<WhisperCard message={msg} /></Fragment>;
        }

        // Broadcast event cards (system messages, GM briefings)
        if (msg.senderId === 'SYSTEM' || msg.senderId === 'GM' || msg.senderId === GAME_MASTER_ID) {
          return <Fragment key={msg.id}>{divider}<BroadcastCard message={msg} /></Fragment>;
        }

        return (
          <Fragment key={msg.id}>
            {divider}
            <MessageCard
              message={msg}
              showHeader={showHeader}
              isSelf={msg.senderId === playerId}
              continuationDepth={continuationDepth}
              openReactionId={openReactionId}
              onOpenReaction={setOpenReactionId}
            />
          </Fragment>
        );
      })}

      <TypingIndicator channelId="MAIN" />

      {/* Jump to latest — pink-glow pill, shows unread count when present */}
      {!autoScroll && (() => {
        const unreadCount = firstUnreadMainTs
          ? mainMessages.filter(m => m.timestamp >= firstUnreadMainTs).length
          : 0;
        return (
          <button
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                setAutoScroll(true);
              }
            }}
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--pulse-radius-pill)',
              background: 'var(--pulse-accent)',
              color: 'var(--pulse-on-accent)',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.1,
              cursor: 'pointer',
              fontFamily: 'var(--po-font-body)',
              // Pink-tinted layered glow instead of generic drop shadow —
              // the button earns its accent weight.
              boxShadow:
                '0 0 0 1px color-mix(in oklch, var(--pulse-accent) 40%, transparent), 0 10px 28px -8px color-mix(in oklch, var(--pulse-accent) 55%, transparent)',
              zIndex: PULSE_Z.elevated,
            }}
          >
            {unreadCount > 0 ? `${unreadCount} new` : 'Jump to latest'}
            <span
              style={{
                display: 'inline-block',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid currentColor',
                marginBottom: -1,
              }}
            />
          </button>
        );
      })()}
    </div>
  );
}
