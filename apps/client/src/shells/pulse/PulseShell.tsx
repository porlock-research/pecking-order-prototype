import { useState, createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toast, Toaster } from 'sonner';
import './pulse-theme.css';
import type { ShellProps } from '../types';
import type { GameEngine } from '../types';
import { useGameStore, selectHaveINudged, selectPendingInvitesForMe } from '../../store/useGameStore';
import { useDeepLinkIntent } from '../../hooks/useDeepLinkIntent';
import { useRevealQueue } from './hooks/useRevealQueue';
import { useReceivedOverdrive } from './hooks/useReceivedOverdrive';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { DeepLinkIntent, CartridgeKind } from '@pecking-order/shared-types';
import { PULSE_Z } from './zIndex';
import { runViewTransition, supportsViewTransitions, prefersReducedMotion } from './viewTransitions';

const DM_REJECTION_LABELS: Record<string, string> = {
  DMS_CLOSED: 'DMs are closed right now',
  INVALID_MEMBERS: 'Invalid members',
  TARGET_ELIMINATED: 'That player has been eliminated',
  GROUP_LIMIT: 'Group DM limit reached',
  UNAUTHORIZED: 'Only the creator can add members',
};
import { AmbientBackground } from './components/AmbientBackground';
import { PulseBar } from './components/PulseBar';
import { ChatView } from './components/chat/ChatView';
import { CastStrip } from './components/caststrip/CastStrip';
import { PulseInput } from './components/input/PulseInput';
import { SendSilverSheet } from './components/popover/SendSilverSheet';
import { DmSheet } from './components/dm-sheet/DmSheet';
import { ConfessionBoothSheet } from './components/confession-booth/ConfessionBoothSheet';
import { ConfessionPhaseBanner } from './components/confession-booth/ConfessionPhaseBanner';
import { PregameDossierSheet } from './components/pregame/PregameDossierSheet';
import { SocialPanel } from './components/social-panel/SocialPanel';
import { PulseHeader } from './components/header/PulseHeader';
import { PickingBanner } from './components/caststrip/PickingBanner';
import { StartPickedCta } from './components/caststrip/StartPickedCta';
import { EliminationReveal } from './components/reveals/EliminationReveal';
import { WinnerReveal } from './components/reveals/WinnerReveal';
import { PhaseTransition } from './components/reveals/PhaseTransition';
import { CartridgeOverlay } from './components/cartridge-overlay/CartridgeOverlay';
import { SilverBurst } from './components/overdrive/SilverBurst';
import { NudgeBurst } from './components/overdrive/NudgeBurst';
import { PwaGate } from '../../components/PwaGate';
import { AnimatePresence } from 'framer-motion';

// Context to provide engine + playerId + overlay actions to all Pulse children.
// Phase 1.5 Option A: avatar tap → openDM directly (AvatarPopover retired).
// /silver and /nudge slash commands in PulseInput still drive the Silver/Nudge sheets.
export const PulseContext = createContext<{
  engine: GameEngine;
  playerId: string;
  openSendSilver: (targetId: string) => void;
  openNudge: (targetId: string) => void;
  openDM: (targetId: string, isGroup?: boolean) => void;
  openSocialPanel: () => void;
  openConfessionBooth: (channelId: string) => void;
  openDossier: (targetId: string) => void;
}>(null!);

export function usePulse() {
  return useContext(PulseContext);
}

export default function PulseShell({ playerId, engine, token }: ShellProps) {
  const gameId = useGameStore(s => s.gameId);
  const hydrateLastRead = useGameStore(s => s.hydrateLastRead);
  const startPicking = useGameStore(s => s.startPicking);
  const pickingActive = useGameStore(s => s.pickingMode !== null);

  // Hydrate Phase 1.5 lastReadTimestamp from localStorage, namespaced per (gameId, playerId)
  useEffect(() => {
    if (gameId && playerId) hydrateLastRead(gameId, playerId);
  }, [gameId, playerId, hydrateLastRead]);

  // Recipient overdrive — fires received-variant bursts for unseen silver /
  // nudge events addressed to the local player. Handles both offline
  // catch-up (on mount) and live receive (on ticker arrival).
  useReceivedOverdrive();

  // Surface DM/channel rejections as toasts (e.g., creator-only ADD_MEMBER guard).
  const dmRejection = useGameStore(s => s.dmRejection);
  const clearDmRejection = useGameStore(s => s.clearDmRejection);
  useEffect(() => {
    if (!dmRejection) return;
    toast.error(DM_REJECTION_LABELS[dmRejection.reason] ?? dmRejection.reason);
    clearDmRejection();
  }, [dmRejection, clearDmRejection]);

  // Overlay state
  const [silverTarget, setSilverTarget] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const [dmIsGroup, setDmIsGroup] = useState(false);
  const [socialPanelOpen, setSocialPanelOpen] = useState(false);
  const [confessionChannelId, setConfessionChannelId] = useState<string | null>(null);
  const [dossierTargetId, setDossierTargetId] = useState<string | null>(null);

  // Cartridge overlay — store-driven (shell-agnostic intent + Pulse rendering)
  const focusedCartridge = useGameStore(s => s.focusedCartridge);

  // Deep-link intent routing (push notifications → shell surfaces)
  const focusCartridge = useGameStore(s => s.focusCartridge);
  const markCartridgeSeen = useGameStore(s => s.markCartridgeSeen);
  const { forcePlay } = useRevealQueue();

  const resolveIntent = useCallback((intent: DeepLinkIntent, _origin: 'push'): boolean => {
    const state = useGameStore.getState();
    switch (intent.kind) {
      case 'main':
        return true;
      case 'dm': {
        const ch = state.channels[intent.channelId];
        if (!ch) return false;
        const targetId = ch.memberIds.find((m: string) => m !== playerId);
        if (!targetId) return false;
        setDmTarget(targetId);
        setDmIsGroup(ch.type === ChannelTypes.GROUP_DM);
        setSocialPanelOpen(false);
        return true;
      }
      case 'dm_invite': {
        const inviteChannels = selectPendingInvitesForMe(state);
        const match = inviteChannels.find((ch: any) => ch.createdBy === intent.senderId);
        if (!match) return false;
        setDmTarget(intent.senderId);
        setDmIsGroup(false);
        setSocialPanelOpen(false);
        return true;
      }
      case 'cartridge_active': {
        // Don't commit until SYNC has hydrated the manifest; otherwise the
        // overlay's pill-match lookup (usePillStates → active slots +
        // completedCartridges) has nothing to resolve against and
        // CartridgeOverlay unfocuses with "Activity unavailable" before the
        // pill arrives. Returning false leaves the intent pending so the
        // retry loop picks it up once the store is populated.
        if (!state.manifest) return false;
        markCartridgeSeen(intent.cartridgeId);
        focusCartridge(intent.cartridgeId, intent.cartridgeKind, 'push');
        return true;
      }
      case 'cartridge_result': {
        if (!state.manifest) return false;
        markCartridgeSeen(intent.cartridgeId);
        const kind = (intent.cartridgeId.split('-')[0] ?? 'voting') as CartridgeKind;
        focusCartridge(intent.cartridgeId, kind, 'push');
        return true;
      }
      case 'elimination_reveal':
        forcePlay({ kind: 'elimination', dayIndex: intent.dayIndex });
        return true;
      case 'winner_reveal':
        forcePlay({ kind: 'winner' });
        return true;
    }
  }, [playerId, focusCartridge, markCartridgeSeen, forcePlay]);

  useDeepLinkIntent(resolveIntent);

  const openSendSilver = useCallback((targetId: string) => setSilverTarget(targetId), []);
  // Nudge fires immediately + toasts; the recipient's cast chip shakes via the
  // SOCIAL_NUDGE ticker arriving on their client. No modal confirmation — it was
  // cosmetic and (worse) the previous code never actually called engine.sendNudge.
  // Mirror the server's per-day guard client-side so we don't toast a false
  // success when the server would silently drop the event.
  // Per-target double-tap guard: the SOCIAL_NUDGE ticker round-trips through the
  // server before selectHaveINudged flips true, so rapid taps in the window
  // before that would otherwise fire multiple WS events. 1s ceiling covers it.
  const nudgeInFlight = useRef<Set<string>>(new Set());
  const openNudge = useCallback((targetId: string) => {
    if (nudgeInFlight.current.has(targetId)) return;
    const state = useGameStore.getState();
    const name = state.roster[targetId]?.personaName ?? 'them';
    if (selectHaveINudged(state, targetId)) {
      toast.message(`Already nudged ${name} today`);
      return;
    }
    nudgeInFlight.current.add(targetId);
    setTimeout(() => nudgeInFlight.current.delete(targetId), 1000);
    engine.sendNudge(targetId);
    // Sender celebration — three-pulse haptic + NudgeBurst overdrive layer.
    // Success toast dropped in favor of the burst (inline public chat card
    // still lands via SOCIAL_NUDGE ticker, so a11y info isn't lost).
    try { navigator.vibrate?.([20, 40, 20]); } catch { /* no-op */ }
    window.dispatchEvent(new CustomEvent('pulse:nudge-burst', { detail: { recipient: name } }));
  }, [engine]);
  const openDM = useCallback((targetId: string, isGroup = false) => {
    // 1:1 DMs morph from the tapped cast chip into the DmHero portrait via
    // the `chip-${playerId}` view-transition-name. Group DMs don't have a
    // single-face hero (DmGroupHero is a multi-avatar composition), so we
    // skip the source tag and let the sheet slide in normally.
    const vtActive = supportsViewTransitions() && !prefersReducedMotion();
    const chipEl = vtActive && !isGroup
      ? document.querySelector<HTMLElement>(`[data-chip-player-id="${targetId}"]`)
      : null;
    if (chipEl) chipEl.style.viewTransitionName = `chip-${targetId}`;

    runViewTransition(() => {
      // Clear the source tag inside the callback so the "new" snapshot
      // has the name only on the DmHero PersonaImage — duplicate names
      // across source + destination abort the transition.
      if (chipEl) chipEl.style.viewTransitionName = '';
      flushSync(() => {
        setDmTarget(targetId);
        setDmIsGroup(isGroup);
        setSocialPanelOpen(false);
      });
    });
  }, []);
  const closeDM = useCallback(() => {
    const targetId = dmTarget;
    const isGroup = dmIsGroup;
    if (!targetId) {
      setDmTarget(null);
      setDmIsGroup(false);
      return;
    }
    // Reverse morph: for the "new" snapshot we need only the chip tagged
    // `chip-${targetId}`. AnimatePresence keeps DmSheet around during exit,
    // so the DmHero wrapper (data-dm-hero-player-id) still has the tag at
    // that point — clear it inside the callback so the tag doesn't collide
    // with the chip's and abort the transition. Skip for groups (no single
    // face to morph to).
    const vtActive = supportsViewTransitions() && !prefersReducedMotion();
    const chipEl = vtActive && !isGroup
      ? document.querySelector<HTMLElement>(`[data-chip-player-id="${targetId}"]`)
      : null;

    runViewTransition(() => {
      // Commit the state change first — after flushSync, AnimatePresence
      // holds the now-removed DmSheet during its (0-duration) exit. React
      // won't reconcile the held DOM again, so the style mutations below
      // stick through the browser's NEW-snapshot capture.
      flushSync(() => {
        setDmTarget(null);
        setDmIsGroup(false);
      });
      const heroEl = vtActive && !isGroup
        ? document.querySelector<HTMLElement>(`[data-dm-hero-player-id="${targetId}"]`)
        : null;
      if (heroEl) heroEl.style.viewTransitionName = '';
      if (chipEl) chipEl.style.viewTransitionName = `chip-${targetId}`;
    }).finally(() => {
      if (chipEl) chipEl.style.viewTransitionName = '';
    });
  }, [dmTarget, dmIsGroup]);
  const openSocialPanel = useCallback(() => setSocialPanelOpen(true), []);
  const openConfessionBooth = useCallback((channelId: string) => {
    setConfessionChannelId(channelId);
    setSocialPanelOpen(false);
  }, []);
  const openDossier = useCallback((targetId: string) => {
    setDossierTargetId(targetId);
    setSocialPanelOpen(false);
  }, []);

  // Auto-open the Confession Booth on phase open for participants. The ref
  // is set once we've actually opened (or once the phase ends), so a manual
  // close stays closed and a SYNC race that delays channel/handle data
  // doesn't cause us to miss the open. Narrator tap remains the re-entry path.
  const confessionActive = useGameStore(s => s.confessionPhase.active);
  const confessionMyHandle = useGameStore(s => s.confessionPhase.myHandle);
  const liveConfessionChannelId = useGameStore(s =>
    Object.values(s.channels).find(ch => ch.type === ChannelTypes.CONFESSION)?.id ?? null
  );
  const autoOpenedConfessionRef = useRef(false);
  useEffect(() => {
    if (!confessionActive) {
      autoOpenedConfessionRef.current = false;
      return;
    }
    if (autoOpenedConfessionRef.current) return;
    if (!confessionMyHandle || !liveConfessionChannelId) return;
    setConfessionChannelId(liveConfessionChannelId);
    setSocialPanelOpen(false);
    autoOpenedConfessionRef.current = true;
  }, [confessionActive, confessionMyHandle, liveConfessionChannelId]);

  return (
    <PulseContext.Provider value={{ engine, playerId, openSendSilver, openNudge, openDM, openSocialPanel, openConfessionBooth, openDossier }}>
      <div
        className="pulse-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AmbientBackground />
        <PulseHeader onCompose={startPicking} onOpenPanel={openSocialPanel} />
        <AnimatePresence>
          {confessionActive && <ConfessionPhaseBanner key="confession-banner" />}
        </AnimatePresence>
        {pickingActive && <PickingBanner />}
        <CastStrip />
        <PulseBar />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: PULSE_Z.base }}>
          <ChatView />
        </main>
        <PulseInput />

        {/* Overlays */}
        <AnimatePresence>
          {silverTarget && (
            <SendSilverSheet targetId={silverTarget} onClose={() => setSilverTarget(null)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {dmTarget && (
            <DmSheet
              key={`${dmTarget}-${dmIsGroup}`}
              targetId={dmTarget}
              isGroup={dmIsGroup}
              onClose={closeDM}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {socialPanelOpen && (
            <SocialPanel onClose={() => setSocialPanelOpen(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {confessionChannelId && (
            <ConfessionBoothSheet
              key={confessionChannelId}
              channelId={confessionChannelId}
              onClose={() => setConfessionChannelId(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {dossierTargetId && (
            <PregameDossierSheet
              key={dossierTargetId}
              targetId={dossierTargetId}
              onClose={() => setDossierTargetId(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pickingActive && <StartPickedCta />}
        </AnimatePresence>

        <AnimatePresence>
          {focusedCartridge && <CartridgeOverlay key="cartridge-overlay" />}
        </AnimatePresence>

        <EliminationReveal />
        <WinnerReveal />
        <PhaseTransition />
        {/* Overdrive layers — sender celebration bursts. Listen for
            pulse:silver-burst / pulse:nudge-burst window CustomEvents. */}
        <SilverBurst />
        <NudgeBurst />
        <Toaster position="top-center" theme="dark" richColors closeButton={false} />
        <PwaGate token={token} />
      </div>
    </PulseContext.Provider>
  );
}
