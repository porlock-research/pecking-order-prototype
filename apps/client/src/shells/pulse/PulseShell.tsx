import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import './pulse-theme.css';
import type { ShellProps } from '../types';
import type { GameEngine } from '../types';
import { useGameStore, selectHaveINudged, selectPendingInvitesForMe } from '../../store/useGameStore';
import { useDeepLinkIntent } from '../../hooks/useDeepLinkIntent';
import { useRevealQueue } from './hooks/useRevealQueue';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { DeepLinkIntent, CartridgeKind } from '@pecking-order/shared-types';
import { PULSE_Z } from './zIndex';

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
import { SocialPanel } from './components/social-panel/SocialPanel';
import { PulseHeader } from './components/header/PulseHeader';
import { PickingBanner } from './components/caststrip/PickingBanner';
import { StartPickedCta } from './components/caststrip/StartPickedCta';
import { EliminationReveal } from './components/reveals/EliminationReveal';
import { WinnerReveal } from './components/reveals/WinnerReveal';
import { PhaseTransition } from './components/reveals/PhaseTransition';
import { CartridgeOverlay } from './components/cartridge-overlay/CartridgeOverlay';
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
}>(null!);

export function usePulse() {
  return useContext(PulseContext);
}

export default function PulseShell({ playerId, engine, token: _token }: ShellProps) {
  const gameId = useGameStore(s => s.gameId);
  const hydrateLastRead = useGameStore(s => s.hydrateLastRead);
  const startPicking = useGameStore(s => s.startPicking);
  const pickingActive = useGameStore(s => s.pickingMode !== null);

  // Hydrate Phase 1.5 lastReadTimestamp from localStorage, namespaced per (gameId, playerId)
  useEffect(() => {
    if (gameId && playerId) hydrateLastRead(gameId, playerId);
  }, [gameId, playerId, hydrateLastRead]);

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
        markCartridgeSeen(intent.cartridgeId);
        focusCartridge(intent.cartridgeId, intent.cartridgeKind, 'push');
        return true;
      }
      case 'cartridge_result': {
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
  const openNudge = useCallback((targetId: string) => {
    const state = useGameStore.getState();
    const name = state.roster[targetId]?.personaName ?? 'them';
    if (selectHaveINudged(state, targetId)) {
      toast.message(`Already nudged ${name} today`);
      return;
    }
    engine.sendNudge(targetId);
    toast.success(`Nudged ${name}`);
  }, [engine]);
  const openDM = useCallback((targetId: string, isGroup = false) => {
    setDmTarget(targetId);
    setDmIsGroup(isGroup);
    setSocialPanelOpen(false);
  }, []);
  const openSocialPanel = useCallback(() => setSocialPanelOpen(true), []);

  return (
    <PulseContext.Provider value={{ engine, playerId, openSendSilver, openNudge, openDM, openSocialPanel }}>
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
              onClose={() => { setDmTarget(null); setDmIsGroup(false); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {socialPanelOpen && (
            <SocialPanel onClose={() => setSocialPanelOpen(false)} />
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
        <Toaster position="top-center" theme="dark" richColors closeButton={false} />
      </div>
    </PulseContext.Provider>
  );
}
