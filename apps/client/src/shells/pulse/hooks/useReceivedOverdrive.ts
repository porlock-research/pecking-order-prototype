import { useEffect, useRef } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { TickerCategories } from '@pecking-order/shared-types';
import { resolvePersonaVariant } from '../../../utils/personaImage';

/**
 * Recipient overdrive — dispatches the existing `pulse:silver-burst` /
 * `pulse:nudge-burst` CustomEvents with `direction: 'received'` when the
 * local player has unseen silver / nudge events addressed to them.
 *
 * Covers two cases:
 *   1. Offline catch-up: player opens the app with queued events in ticker
 *      history. On mount, all unseen events are dispatched with 800ms
 *      stagger so each registers as its own moment.
 *   2. Live receive: once connected, new ticker events arrive via SYNC.
 *      The effect re-runs, finds the newly-unseen event, dispatches once.
 *
 * Coalescing: when a player returns with more than 3 queued receives of
 * the same kind, they're collapsed into a single summary burst ("+35
 * silver from 3 friends") so a long absence doesn't trigger a confetti
 * marathon.
 *
 * Dedup: a ref-backed Set keys on (kind, senderId, timestamp). Pre-
 * registered BEFORE the staggered setTimeout dispatches, so the effect
 * re-running during the stagger window doesn't re-enqueue anything.
 *
 * See also: prototype `docs/reports/pulse-mockups/12-recipient-overdrive.html`
 * and the received-variant branches in SilverBurst / NudgeBurst.
 */

const STAGGER_MS = 800;
const COALESCE_THRESHOLD = 3;

type SilverEvent = { senderId: string; amount: number; ts: number };
type NudgeEvent = { senderId: string; ts: number };

type SilverBurstItem = {
  kind: 'silver';
  amount: number;
  fromName: string;
  senderAvatarUrl: string | null;
  senderIds: string[];
  keys: string[];
};
type NudgeBurstItem = {
  kind: 'nudge';
  fromName: string;
  senderAvatarUrl: string | null;
  senderIds: string[];
  keys: string[];
};
type BurstItem = SilverBurstItem | NudgeBurstItem;

export function useReceivedOverdrive() {
  const playerId = useGameStore(s => s.playerId);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const roster = useGameStore(s => s.roster);
  const lastSeenSilverFrom = useGameStore(s => s.lastSeenSilverFrom);
  const lastSeenNudgeFrom = useGameStore(s => s.lastSeenNudgeFrom);
  const markSilverSeen = useGameStore(s => s.markSilverSeen);
  const markNudgeSeen = useGameStore(s => s.markNudgeSeen);

  const dispatched = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!playerId) return;

    const silvers: SilverEvent[] = [];
    const nudges: NudgeEvent[] = [];

    for (const m of tickerMessages) {
      const ids = m.involvedPlayerIds ?? [];
      if (ids.length < 2) continue;
      const [senderId, recipientId] = ids;
      if (recipientId !== playerId || !senderId || senderId === playerId) continue;
      const ts = typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp as any).getTime();
      if (!ts) continue;

      if (m.category === TickerCategories.SOCIAL_TRANSFER) {
        const lastSeen = lastSeenSilverFrom[senderId] ?? 0;
        if (ts <= lastSeen) continue;
        const key = `silver:${senderId}:${ts}`;
        if (dispatched.current.has(key)) continue;
        const amountMatch = (m.text ?? '').match(/sent\s+(\d+)\s+silver/i);
        const amount = amountMatch ? parseInt(amountMatch[1] ?? '0', 10) : 0;
        silvers.push({ senderId, amount, ts });
      } else if (m.category === TickerCategories.SOCIAL_NUDGE) {
        const lastSeen = lastSeenNudgeFrom[senderId] ?? 0;
        if (ts <= lastSeen) continue;
        const key = `nudge:${senderId}:${ts}`;
        if (dispatched.current.has(key)) continue;
        nudges.push({ senderId, ts });
      }
    }

    if (silvers.length === 0 && nudges.length === 0) return;

    const bursts: BurstItem[] = [];

    if (silvers.length > COALESCE_THRESHOLD) {
      const totalAmount = silvers.reduce((s, x) => s + x.amount, 0);
      const uniqueSenders = Array.from(new Set(silvers.map(s => s.senderId)));
      bursts.push({
        kind: 'silver',
        amount: totalAmount,
        fromName: `${uniqueSenders.length} friends`,
        senderAvatarUrl: null,
        senderIds: uniqueSenders,
        keys: silvers.map(s => `silver:${s.senderId}:${s.ts}`),
      });
    } else {
      for (const s of silvers) {
        bursts.push({
          kind: 'silver',
          amount: s.amount,
          fromName: roster[s.senderId]?.personaName ?? 'someone',
          senderAvatarUrl: resolvePersonaVariant(roster[s.senderId]?.avatarUrl, 'full'),
          senderIds: [s.senderId],
          keys: [`silver:${s.senderId}:${s.ts}`],
        });
      }
    }

    if (nudges.length > COALESCE_THRESHOLD) {
      const uniqueSenders = Array.from(new Set(nudges.map(n => n.senderId)));
      bursts.push({
        kind: 'nudge',
        fromName: `${uniqueSenders.length} friends`,
        senderAvatarUrl: null,
        senderIds: uniqueSenders,
        keys: nudges.map(n => `nudge:${n.senderId}:${n.ts}`),
      });
    } else {
      for (const n of nudges) {
        bursts.push({
          kind: 'nudge',
          fromName: roster[n.senderId]?.personaName ?? 'someone',
          senderAvatarUrl: resolvePersonaVariant(roster[n.senderId]?.avatarUrl, 'full'),
          senderIds: [n.senderId],
          keys: [`nudge:${n.senderId}:${n.ts}`],
        });
      }
    }

    // Register dedup keys INSIDE the setTimeout callback, not synchronously
    // before scheduling. Silver transfer triggers TICKER.UPDATE immediately
    // followed by SYSTEM.SYNC (roster silver counts changed) — the SYNC
    // re-runs this effect and its cleanup would clearTimeout the pending
    // dispatch. Registering keys up front would cause the next run to skip
    // the silver entirely (key already in `dispatched`), losing the burst.
    // Registering at dispatch time means a cancelled timer leaves the key
    // unregistered, so the next effect run re-schedules cleanly.
    const timers: number[] = [];
    bursts.forEach((burst, i) => {
      const t = window.setTimeout(() => {
        for (const k of burst.keys) dispatched.current.add(k);
        if (burst.kind === 'silver') {
          window.dispatchEvent(new CustomEvent('pulse:silver-burst', {
            detail: {
              direction: 'received',
              amount: burst.amount,
              from: burst.fromName,
              senderAvatarUrl: burst.senderAvatarUrl,
            },
          }));
          for (const sid of burst.senderIds) markSilverSeen(sid);
        } else {
          window.dispatchEvent(new CustomEvent('pulse:nudge-burst', {
            detail: {
              direction: 'received',
              from: burst.fromName,
              senderAvatarUrl: burst.senderAvatarUrl,
            },
          }));
          for (const sid of burst.senderIds) markNudgeSeen(sid);
        }
      }, i * STAGGER_MS);
      timers.push(t);
    });

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [playerId, tickerMessages, roster, lastSeenSilverFrom, lastSeenNudgeFrom, markSilverSeen, markNudgeSeen]);
}
