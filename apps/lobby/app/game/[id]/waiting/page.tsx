'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getGameSessionStatus, startGame, sendEmailInvite, getGameInvites, sendGameEntryPush } from '../../../actions';
import type { GameSlot, SentInvite } from '../../../actions';

function personaMediumUrl(id: string): string {
  return `/api/persona-image/${id}/medium.png`;
}

export default function WaitingRoom() {
  const params = useParams();
  const code = params.id as string;

  const [status, setStatus] = useState<string>('LOADING');
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [clientHost, setClientHost] = useState('http://localhost:5173');
  const [mode, setMode] = useState<string | null>(null);

  // Invite by email state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pushSent, setPushSent] = useState<boolean | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await getGameSessionStatus(code);
        setStatus(result.status);
        setSlots(result.slots);
        if (result.tokens) setTokens(result.tokens);
        if (result.clientHost) setClientHost(result.clientHost);
        if (result.mode) setMode(result.mode);
        if (result.isHost) setIsHost(true);

        // Load sent invites (only returned for host)
        if (result.isHost) {
          const invitesResult = await getGameInvites(code);
          setSentInvites(invitesResult.invites);
        }
      } catch {
        setError('Failed to fetch game status');
      }
    }
    load();
  }, [code]);

  // Send push notification when game is STARTED and we have a token
  useEffect(() => {
    if (status !== 'STARTED' || !tokens) return;
    const token = Object.values(tokens)[0];
    if (!token) return;
    sendGameEntryPush(code, token).then(({ sent }) => setPushSent(sent)).catch(() => {});
  }, [status, tokens, code]);

  async function handleStart() {
    setIsStarting(true);
    setError(null);

    const result = await startGame(code);
    setIsStarting(false);

    if (result.success) {
      if (result.tokens) setTokens(result.tokens);
      setStatus('STARTED');
    } else {
      setError(result.error || 'Failed to start game');
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSendingInvite(true);
    setInviteError(null);
    setInviteStatus(null);

    const result = await sendEmailInvite(code, inviteEmail.trim());
    setIsSendingInvite(false);

    if (result.error) {
      setInviteError(result.error);
    } else if (result.sent) {
      setInviteStatus(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      // Refresh sent invites list
      const invitesResult = await getGameInvites(code);
      setSentInvites(invitesResult.invites);
    } else if (result.link) {
      setInviteStatus('Invite created (email not configured)');
      setInviteEmail('');
      const invitesResult = await getGameInvites(code);
      setSentInvites(invitesResult.invites);
    }
  }

  // Canonical share URL is /j/CODE — the frictionless welcome, not the
  // auth-walled /join/CODE. Strangers who tap the shared link land on a
  // welcome form instead of the magic-link wall.
  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/j/${code.toUpperCase()}`
      : '';

  // Brand mantra echoed in every host-share. Recipients see the verb stack
  // before the URL — the same hook they'd see if they tapped the link and
  // unfurled in iMessage. Repetition is the point.
  const shareText = `Vote. Ally. Betray. Survive. I’m running a Pecking Order game — you’re cast.`;

  // Robust clipboard write — `navigator.clipboard` is unavailable in
  // non-secure contexts (some embedded browsers, older iOS in-app webviews)
  // and rejects silently when the document isn't focused.
  async function writeClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleCopyLink() {
    const ok = await writeClipboard(shareLink);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Native Web Share API — preferred when available because the OS share
  // sheet covers iMessage/WhatsApp/Messenger/etc without us hard-coding each.
  // AbortError = user dismissed the sheet (deliberate cancel, not a failure).
  async function handleNativeShare() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: 'Pecking Order',
        text: shareText,
        url: shareLink,
      });
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      // Share-sheet open failed — fall back to copy so the host doesn't lose
      // the invite link to the void.
      handleCopyLink();
    }
  }

  function handleSmsShare() {
    // sms:?&body= is the cross-platform form (iOS + Android both honor it).
    window.location.href = `sms:?&body=${encodeURIComponent(`${shareText} ${shareLink}`)}`;
  }

  function handleWhatsAppShare() {
    // WA renders \n as visual line breaks — stack mantra over URL for
    // a poster-shaped chat preview.
    const text = `${shareText}\n\n${shareLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) window.location.href = url;
  }

  // Native share is rare on desktop, common on mobile. Capture once on
  // mount so the button row doesn't ship and immediately disappear.
  const [hasNativeShare, setHasNativeShare] = useState(false);
  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const filledSlots = slots.filter((s) => s.acceptedBy);
  const emptySlots = slots.filter((s) => !s.acceptedBy);
  const totalSlots = slots.length;
  const isReady = status === 'READY';
  const isStarted = status === 'STARTED';
  const isLoading = status === 'LOADING';

  const isConfigurableCycle = mode === 'CONFIGURABLE_CYCLE';
  const myPlayerId = tokens ? Object.keys(tokens)[0] : null;
  const myToken = tokens ? Object.values(tokens)[0] : null;
  const clientEntryUrl = myToken ? `${clientHost}/game/${code}?_t=${myToken}` : null;

  return (
    <div className="h-dvh flex flex-col bg-skin-deep bg-grid-pattern font-body text-skin-base relative selection:bg-skin-gold/30 overflow-hidden">
      {/* Variant A waiting room background — paper grid (on the wrapper)
          plus two soft red radial highlights, matching the wizard and
          docs/reports/lobby-mockups/05-variant-a-welcome-v4.html. The
          persona-as-blurred-bg treatment was retired alongside the
          wizard's; the cast portrait grid below is the visual anchor
          and shouldn't compete with a portrait scrim above it. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 30%, rgba(215,38,56,0.06) 0%, transparent 35%),
            radial-gradient(circle at 80% 75%, rgba(215,38,56,0.04) 0%, transparent 40%)
          `,
        }}
      />

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10 max-w-lg w-full mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Masthead — wordmark left, tear-off code stub right. Mirrors the
            /j/ welcome treatment so the host sees the same chrome the
            invitee will see when they tap in. */}
        <div className="flex items-center justify-between flex-shrink-0 pb-2 border-b-2 border-skin-base">
          <div className="font-display font-black text-base text-skin-base tracking-[0.16em] uppercase leading-none">
            Pecking Order
          </div>
          <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-skin-dim leading-none">
            <span className="opacity-60 mr-1">CODE</span>
            <span className="text-skin-base">{code.toUpperCase()}</span>
          </div>
        </div>

        <header className="text-center space-y-0.5 flex-shrink-0 mt-3">
          <div className="max-w-sm mx-auto space-y-2">
            <div className="text-[10px] font-display font-bold text-skin-dim uppercase tracking-widest text-left">
              Invite link
            </div>
            {/* Solid bg-skin-input (#1d1d1d) — was bg-skin-input/60, which
                is a 60% wash that on the page-bg ink barely lifts and
                made the URL hard to read. Per variant A brief: surfaces
                that hold typography land at solid input ink, not at a
                transparent fade of the page color. */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-skin-input border border-skin-base/15">
              <code className="flex-1 text-xs font-mono text-skin-base truncate text-left">
                {shareLink}
              </code>
              <button
                onClick={handleCopyLink}
                aria-label={copied ? 'Invite link copied' : 'Copy invite link'}
                className={`min-h-[36px] text-xs font-display font-bold px-3 py-2 rounded border transition-all whitespace-nowrap ${
                  copied
                    ? 'text-skin-pink border-skin-pink/60'
                    : 'text-skin-base border-skin-base/30 hover:border-skin-base/60'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Per-channel share row — sits below the link copy. On mobile,
                the native-share button leads (opens the OS share sheet,
                which covers iMessage/WhatsApp/Discord/etc in one tap). On
                desktop where the Web Share API is rare, SMS + WhatsApp
                shortcuts pick up the slack. Mantra-led text in every
                channel so unfurls and chat previews carry the brand. */}
            <div className="flex gap-2 pt-1">
              {hasNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-skin-pink text-skin-base text-xs font-display font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share
                </button>
              )}
              <button
                onClick={handleSmsShare}
                aria-label="Share via SMS"
                className={`${hasNativeShare ? 'w-10' : 'flex-1'} min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-display font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {!hasNativeShare && <span>SMS</span>}
              </button>
              <button
                onClick={handleWhatsAppShare}
                aria-label="Share via WhatsApp"
                className={`${hasNativeShare ? 'w-10' : 'flex-1'} min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#25D366] text-white text-xs font-display font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {!hasNativeShare && <span>WhatsApp</span>}
              </button>
            </div>
          </div>
        </header>

        {/* Status badge */}
        <div className="flex justify-center mt-2 flex-shrink-0">
          <motion.div
            role="status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-skin-glass-elevated text-xs font-display font-bold uppercase tracking-widest border
              ${
                isStarted
                  ? 'text-skin-green border-skin-green'
                  : isReady
                    ? 'text-skin-pink border-skin-pink'
                    : 'text-skin-dim border-skin-base'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isStarted ? 'bg-skin-green' : isReady ? 'bg-skin-pink' : 'bg-skin-dim'
              } ${!isStarted ? 'animate-pulse' : ''}`}
              aria-hidden
            />
            {isStarted
              ? 'Game Started'
              : isReady
                ? 'Ready to Launch'
                : isLoading
                  ? 'Cueing the room…'
                  : `Waiting for Players (${filledSlots.length}/${totalSlots})`}
          </motion.div>
        </div>

        {/* Cast title */}
        <div className="text-center mt-2 flex-shrink-0">
          <h2 className="text-base font-display font-black text-skin-pink uppercase tracking-widest">
            The Cast
          </h2>
        </div>

        {/* Cast grid */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 pb-2">
          {isLoading ? (
            /* Skeleton grid */
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-skin-input/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 gap-3"
            >
              {/* Filled slots — cast portrait cards. Only the most-recent join
                  (last in the list) gets the breathing glow, so the eye lands
                  on what just happened instead of every card competing. */}
              {filledSlots.map((slot, idx) => {
                const isMostRecent = idx === filledSlots.length - 1;
                return (
                  <motion.div
                    key={slot.slotIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.08, duration: 0.35 }}
                    className={`aspect-[3/4] relative rounded-2xl overflow-hidden ${isMostRecent ? 'glow-breathe' : ''}`}
                  >
                    {slot.personaId ? (
                      <img
                        src={personaMediumUrl(slot.personaId)}
                        alt={slot.personaName || ''}
                        loading={idx < 4 ? 'eager' : 'lazy'}
                        onError={(e) => {
                          // Persona CDN occasionally 404s on stale slot data;
                          // hide the broken-image icon and fall back to the
                          // ink-input placeholder behind the <img>.
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-skin-input" />
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-skin-deep via-skin-deep/40 via-30% to-transparent pointer-events-none" />
                    {/* Name + stereotype. Stereotype in red (was gold) per
                        variant A single-accent rule. text-glow dropped from
                        name (gold-tinted shadow leftover from old palette). */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                      <div className="text-sm font-display font-black text-skin-base leading-tight truncate">
                        {slot.personaName}
                      </div>
                      <div className="text-[9px] font-display font-bold text-skin-pink uppercase tracking-[0.15em] truncate">
                        {slot.personaStereotype}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Empty slots — casting-call placeholder, not "TBD" project-status. */}
              {emptySlots.map((slot) => (
                <motion.div
                  key={slot.slotIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: filledSlots.length * 0.08 + 0.1, duration: 0.3 }}
                  className="aspect-[3/4] relative rounded-2xl overflow-hidden border border-dashed border-skin-base/40 bg-skin-glass flex items-center justify-center"
                >
                  <div className="text-center space-y-1">
                    <div className="text-[10px] font-display font-bold text-skin-faint uppercase tracking-[0.2em]">
                      Open seat
                    </div>
                    <div className="text-xs text-skin-faint/70">Waiting on someone</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Invite Players Section — show when slots are unfilled OR dynamic (no predefined slots).
              For dynamic/CONFIGURABLE_CYCLE games, show even after STARTED since players can join during preGame. */}
          {isHost && !isLoading && (emptySlots.length > 0 || totalSlots === 0 || isConfigurableCycle) && (
            <div className="mt-4">
              <button
                onClick={() => setShowInviteSection(!showInviteSection)}
                aria-expanded={showInviteSection}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-skin-base/30 bg-skin-glass-elevated text-sm font-display font-bold text-skin-dim hover:text-skin-base hover:border-skin-gold/30 transition-all"
              >
                <span>Invite by Email</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`transition-transform duration-200 ${showInviteSection ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <AnimatePresence>
                {showInviteSection && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      <form onSubmit={handleSendInvite} className="flex gap-2">
                        <input
                          type="email"
                          inputMode="email"
                          autoComplete="off"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="player@example.com"
                          aria-label="Player email"
                          required
                          className="flex-1 bg-skin-input text-skin-base border border-skin-base rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 placeholder:text-skin-faint"
                        />
                        <button
                          type="submit"
                          disabled={isSendingInvite || !inviteEmail.trim()}
                          className={`px-4 py-2.5 rounded-lg font-display font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap
                            ${isSendingInvite || !inviteEmail.trim()
                              ? 'bg-skin-input text-skin-faint cursor-wait'
                              : 'bg-skin-pink text-skin-base hover:brightness-110 active:scale-[0.98]'
                            }`}
                        >
                          {isSendingInvite ? '...' : 'Send'}
                        </button>
                      </form>

                      {inviteStatus && (
                        <div role="status" className="p-2.5 rounded-lg bg-skin-green/10 border border-skin-green/30 text-skin-green text-xs text-center">
                          {inviteStatus}
                        </div>
                      )}

                      {inviteError && (
                        <div role="alert" className="p-2.5 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-xs text-center">
                          {inviteError}
                        </div>
                      )}

                      {sentInvites.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-display font-bold text-skin-faint uppercase tracking-widest px-1">
                            Sent Invites
                          </div>
                          {sentInvites.map((inv) => (
                            <div
                              key={inv.email + inv.createdAt}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg text-xs bg-skin-glass"
                            >
                              <span className="text-skin-dim truncate">{inv.email}</span>
                              <span className={`text-[10px] font-display font-bold uppercase tracking-wider ${inv.used ? 'text-skin-green' : 'text-skin-faint'}`}>
                                {inv.used ? 'Joined' : 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 relative z-20 bg-gradient-to-b from-skin-deep/0 to-skin-deep pt-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto">
          {error && (
            <div role="alert" className="p-3 mb-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm text-center">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isReady && !isStarted && !isConfigurableCycle && (
              <motion.div
                key="launch"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className={`w-full py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                    ${
                      isStarting
                        ? 'bg-skin-input text-skin-faint cursor-wait'
                        : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                    }`}
                >
                  {isStarting ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150" />
                    </>
                  ) : (
                    <>Launch Game</>
                  )}
                </button>
              </motion.div>
            )}

            {(isStarted || (isConfigurableCycle && clientEntryUrl)) && clientEntryUrl && (
              <motion.div
                key="enter"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {pushSent && (
                  <div role="status" className="p-3 rounded-lg bg-skin-green/10 border border-skin-green/30 text-skin-green text-xs text-center">
                    We sent a notification to your app. Tap it to enter!
                  </div>
                )}
                <motion.a
                  href={clientEntryUrl}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  whileHover={{ y: -1, filter: 'brightness(1.06)' }}
                  whileTap={{ scale: 0.995 }}
                  className="relative block w-full overflow-hidden rounded-2xl outline-none focus-visible:[outline:2px_solid_var(--po-gold)] focus-visible:[outline-offset:3px]"
                  style={{
                    backgroundColor:
                      'color-mix(in oklch, var(--po-bg-deep) 82%, var(--po-gold) 18%)',
                    boxShadow:
                      'inset 0 0 0 1px color-mix(in oklch, var(--po-gold) 45%, transparent), inset 0 30px 72px -36px color-mix(in oklch, var(--po-gold) 72%, transparent)',
                  }}
                >
                  <motion.span
                    aria-hidden
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] origin-left"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, var(--po-gold) 18%, var(--po-gold) 82%, transparent 100%)',
                      boxShadow:
                        '0 0 12px 0 color-mix(in oklch, var(--po-gold) 55%, transparent)',
                    }}
                  />

                  <span className="flex items-center gap-4 px-5 py-5">
                    {filledSlots.length > 0 && (
                      <span aria-hidden className="flex -space-x-2.5 shrink-0">
                        {filledSlots.slice(0, 4).map((slot, i) => (
                          <motion.span
                            key={slot.personaId || slot.slotIndex}
                            initial={{ opacity: 0, scale: 0.82 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: 0.34 + i * 0.08,
                              duration: 0.32,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="inline-block h-9 w-9 rounded-full bg-skin-input overflow-hidden"
                            style={{
                              boxShadow:
                                'inset 0 0 0 1.5px color-mix(in oklch, var(--po-gold) 60%, transparent), 0 0 0 2px var(--po-bg-deep)',
                            }}
                          >
                            {slot.personaId && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={personaMediumUrl(slot.personaId)}
                                alt=""
                                className="h-full w-full object-cover object-top"
                              />
                            )}
                          </motion.span>
                        ))}
                      </span>
                    )}

                    <span className="flex-1 min-w-0 text-left leading-[0.95]">
                      <span
                        className="block font-display font-black"
                        style={{
                          fontSize: 'clamp(30px, 8vw, 42px)',
                          letterSpacing: '-0.03em',
                          color: 'var(--po-gold)',
                        }}
                      >
                        Enter
                      </span>
                      <span
                        className="block mt-1.5 font-mono text-[12px] tracking-[0.08em] uppercase"
                        style={{
                          color: 'color-mix(in oklch, var(--po-gold) 62%, transparent)',
                        }}
                      >
                        as {myPlayerId?.toUpperCase()}
                      </span>
                    </span>

                    <motion.span
                      aria-hidden
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.46, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                      className="shrink-0 grid place-items-center h-10 w-10 rounded-full"
                      style={{
                        backgroundColor: 'color-mix(in oklch, var(--po-gold) 16%, transparent)',
                        boxShadow:
                          'inset 0 0 0 1px color-mix(in oklch, var(--po-gold) 52%, transparent)',
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="var(--po-gold)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </motion.span>
                  </span>
                </motion.a>
              </motion.div>
            )}

            {!isStarted && !isReady && !isLoading && !isConfigurableCycle && (
              <motion.div
                key="share"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-center text-xs text-skin-dim">
                  Share the invite code. We'll refresh when everyone joins.
                </p>
              </motion.div>
            )}

            {isConfigurableCycle && !clientEntryUrl && !isLoading && (
              <motion.div
                key="cc-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-center text-xs text-skin-dim">
                  Share the invite code. You can enter the game while waiting for other players.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
