import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plain, CloseCircle, Dollar, UserPlus, FileText } from '@solar-icons/react';
import type { ChatMessage, SocialPlayer, ChannelCapability } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { AnimatedCounter } from './AnimatedCounter';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ChatInputProps {
  engine: {
    sendMessage: (content: string) => void;
    sendToChannel: (channelId: string, content: string) => void;
    sendFirstMessage: (recipientIds: string[], content: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
    sendSilver: (amount: number, targetId: string) => void;
    addMember: (channelId: string, memberIds: string[], message?: string) => void;
  };
  context: 'main' | 'dm' | 'group';
  targetId?: string;
  targetName?: string;
  replyTarget?: ChatMessage | null;
  onClearReply?: () => void;
  channelId?: string;
  capabilities?: ChannelCapability[];
  channelMemberIds?: string[];
  hints?: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPlaceholderFromHints(
  hints: string[] | undefined,
  disabled: boolean,
  context: 'main' | 'dm' | 'group',
  tick: number,
): string {
  if (disabled) {
    return context === 'main' ? 'Chat closed...' : 'DMs closed...';
  }
  if (!hints || hints.length === 0) return 'Type a message...';
  return hints[tick % hints.length];
}

function getChannel(context: 'main' | 'dm' | 'group', targetId?: string): string {
  return context === 'main' ? 'MAIN' : targetId ?? 'MAIN';
}

const SILVER_AMOUNTS = [1, 2, 5, 10] as const;

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--vivid-text-dim)',
        display: 'inline-block',
      }}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

function TypingIndicator({
  typingPlayers,
  playerId,
  roster,
  channel,
}: {
  typingPlayers: Record<string, string>;
  playerId: string | null;
  roster: Record<string, SocialPlayer>;
  channel: string;
}) {
  const typerIds = Object.entries(typingPlayers)
    .filter(([pid, ch]) => ch === channel && pid !== playerId)
    .map(([pid]) => pid);
  const typers = typerIds.map((pid) => roster[pid]?.personaName || 'Someone');

  if (typers.length === 0) return null;

  const firstTyper = roster[typerIds[0]];
  const text =
    typers.length === 1
      ? typers[0]
      : typers.length === 2
        ? `${typers[0]} and ${typers[1]}`
        : `${typers[0]} and ${typers.length - 1} others`;

  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        paddingBottom: 6,
      }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <PersonaAvatar
        avatarUrl={firstTyper?.avatarUrl}
        personaName={firstTyper?.personaName}
        size={24}
        isOnline
      />
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}
      >
        {text} is scheming...
      </span>
      <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TypingDot delay={0} />
        <TypingDot delay={0.15} />
        <TypingDot delay={0.3} />
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

/* Outer shell — wraps input row + optional capability sub-row */
const COMPOSER_SHELL: React.CSSProperties = {
  background: '#FFFFFF',
  border: '2px solid rgba(139, 115, 85, 0.12)',
  borderRadius: 18,
  overflow: 'hidden',
  transition: 'box-shadow 0.2s, border-color 0.2s',
  boxShadow: '0 1px 4px rgba(139, 115, 85, 0.06)',
};

const CANNED_TEXT: React.CSSProperties = {
  fontSize: 15,
  fontFamily: 'var(--vivid-font-body)',
  color: 'var(--vivid-text-dim)',
  whiteSpace: 'nowrap',
};

/* ------------------------------------------------------------------ */
/*  ChatInput                                                          */
/* ------------------------------------------------------------------ */

type ActiveCapability = 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'CHAR_INFO' | null;

export function ChatInput({
  engine,
  context,
  targetId,
  targetName,
  replyTarget,
  onClearReply,
  channelId,
  capabilities,
  channelMemberIds,
  hints,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeCapability, setActiveCapability] = useState<ActiveCapability>(null);
  const [silverAmount, setSilverAmount] = useState<number>(5);
  const [selectedInvitee, setSelectedInvitee] = useState<string | null>(null);
  const [stashedInput, setStashedInput] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { playerId, roster } = useGameStore();
  const typingPlayers = useGameStore((s) => s.typingPlayers);
  const groupChatOpen = useGameStore((s) => s.groupChatOpen);
  const dmsOpen = useGameStore((s) => s.dmsOpen);
  const dmStats = useGameStore((s) => s.dmStats);

  // Cycle placeholder text every 8 seconds
  const [placeholderTick, setPlaceholderTick] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setPlaceholderTick(t => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const channel = getChannel(context, targetId);
  const isDisabled = context === 'main' ? !groupChatOpen : !dmsOpen;
  const countdown = useCountdown(context === 'main' ? 'group' : 'dm');

  // Input-area capabilities (exclude CHAT, REACTIONS, REPLIES — those are message-level)
  const inputCapabilities = useMemo(() =>
    (capabilities ?? []).filter(c => c !== 'CHAT' && c !== 'REACTIONS' && c !== 'REPLIES'),
    [capabilities]
  );

  const hasSilver = inputCapabilities.includes('SILVER_TRANSFER');
  const hasInvite = inputCapabilities.includes('INVITE_MEMBER');

  const replyName = replyTarget
    ? roster[replyTarget.senderId]?.personaName || 'Unknown'
    : '';

  // Silver: player balance
  const myBalance = playerId ? (roster[playerId]?.silver ?? 0) : 0;

  // Char counter
  const isDmContext = context === 'dm' || context === 'group';
  const charsRemaining = isDmContext && dmStats
    ? Math.max(0, (dmStats.charsLimit ?? 0) - (dmStats.charsUsed ?? 0))
    : null;
  const charsLimit = dmStats?.charsLimit ?? 0;
  const charsRatio = charsLimit > 0 && charsRemaining !== null ? charsRemaining / charsLimit : 1;
  const charsColor = charsRatio < 0.15 ? '#D94073' : charsRatio < 0.3 ? '#D4960A' : 'var(--vivid-text-dim)';
  const hasCharCounter = isDmContext && charsRemaining !== null;

  const hasToolbar = hasSilver || hasInvite || hasCharCounter;

  // Silver send confirmation flash
  const [silverSentFlash, setSilverSentFlash] = useState<{ amount: number; target: string } | null>(null);

  // Invite: eligible players (not self, not eliminated, not already in channel)
  const eligible = useMemo(() => {
    if (!playerId || !roster) return [];
    return Object.entries(roster).filter(([pid, p]) =>
      pid !== playerId &&
      p.status !== 'ELIMINATED' &&
      !(channelMemberIds ?? []).includes(pid)
    );
  }, [playerId, roster, channelMemberIds]);

  /* -- Can send? --------------------------------------------------- */

  const canSend =
    activeCapability === 'SILVER_TRANSFER'
      ? silverAmount > 0 && silverAmount <= myBalance && !!targetId
      : activeCapability === 'INVITE_MEMBER'
        ? !!selectedInvitee && !!channelId
        : activeCapability === 'CHAR_INFO'
          ? false
          : !!inputValue.trim();

  /* -- Toggle capability ------------------------------------------- */

  const toggleCapability = (cap: ActiveCapability) => {
    if (activeCapability === cap) {
      if (cap === 'CHAR_INFO' && stashedInput !== null) {
        setInputValue(stashedInput);
        setStashedInput(null);
      }
      setActiveCapability(null);
      setSelectedInvitee(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (cap === 'CHAR_INFO') {
        setStashedInput(inputValue);
      } else if (activeCapability === 'CHAR_INFO' && stashedInput !== null) {
        setInputValue(stashedInput);
        setStashedInput(null);
      }
      setActiveCapability(cap);
      setSelectedInvitee(null);
      if (cap === 'SILVER_TRANSFER') setSilverAmount(5);
    }
  };

  /* -- Send -------------------------------------------------------- */

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled || !playerId) return;

    // Silver transfer
    if (activeCapability === 'SILVER_TRANSFER') {
      if (targetId && silverAmount > 0 && silverAmount <= myBalance) {
        engine.sendSilver(silverAmount, targetId);
        const tName = targetName ?? 'them';
        setSilverSentFlash({ amount: silverAmount, target: tName });
        setTimeout(() => setSilverSentFlash(null), 2500);
        setActiveCapability(null);
        setSilverAmount(5);
      }
      return;
    }

    // Invite member
    if (activeCapability === 'INVITE_MEMBER') {
      if (channelId && selectedInvitee) {
        engine.addMember(channelId, [selectedInvitee]);
        setActiveCapability(null);
        setSelectedInvitee(null);
      }
      return;
    }

    // Normal text message
    const text = inputValue.trim();
    if (!text) return;

    switch (context) {
      case 'main':
        engine.sendMessage(text);
        engine.stopTyping('MAIN');
        break;
      case 'dm':
        if (channelId) {
          engine.sendToChannel(channelId, text);
          engine.stopTyping(channelId);
        } else if (targetId) {
          engine.sendFirstMessage([targetId], text);
        }
        break;
      case 'group':
        if (targetId) {
          engine.sendToChannel(targetId, text);
          engine.stopTyping(targetId);
        }
        break;
    }

    setInputValue('');
    onClearReply?.();
  };

  /* -- Render ------------------------------------------------------ */

  // Border accent when a capability is active
  const containerBorderColor =
    activeCapability === 'SILVER_TRANSFER'
      ? 'rgba(196, 154, 32, 0.35)'
      : activeCapability === 'INVITE_MEMBER'
        ? 'rgba(59, 169, 156, 0.35)'
        : activeCapability === 'CHAR_INFO'
          ? 'rgba(139, 115, 85, 0.2)'
          : undefined;

  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--vivid-bg-surface)',
        borderTop: '1px solid rgba(139, 115, 85, 0.08)',
      }}
    >
      <div style={{ padding: '6px 12px 10px' }}>
        {/* Typing indicator */}
        <AnimatePresence>
          <TypingIndicator
            typingPlayers={typingPlayers}
            playerId={playerId}
            roster={roster}
            channel={channel}
          />
        </AnimatePresence>

        {/* Closed banner (only when no countdown — ADMIN mode fallback) */}
        {isDisabled && !countdown && (
          <div
            style={{
              marginBottom: 8,
              padding: '8px 12px',
              borderRadius: 14,
              background: 'var(--vivid-bg-elevated)',
              border: '1px solid rgba(139, 115, 85, 0.1)',
              color: 'var(--vivid-text-dim)',
              fontSize: 13,
              fontFamily: 'var(--vivid-font-body)',
              textAlign: 'center',
            }}
          >
            {context === 'main'
              ? 'Group chat closed'
              : 'DMs closed'}
          </div>
        )}

        {/* Reply preview */}
        <AnimatePresence>
          {replyTarget && (
            <motion.div
              style={{
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 14,
                background: 'var(--vivid-bg-elevated)',
                border: '1px solid rgba(139, 115, 85, 0.1)',
              }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={VIVID_SPRING.snappy}
            >
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  minHeight: 24,
                  background: 'var(--vivid-coral)',
                  borderRadius: 9999,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--vivid-coral)',
                    fontFamily: 'var(--vivid-font-display)',
                  }}
                >
                  {replyName}
                </span>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--vivid-text-dim)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {replyTarget.content}
                </p>
              </div>
              <button
                onClick={onClearReply}
                style={{
                  flexShrink: 0,
                  padding: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--vivid-text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <CloseCircle size={14} weight="Bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend}>
          {/* ---- Unified composer shell ---- */}
          <div
            style={{
              ...COMPOSER_SHELL,
              borderColor: containerBorderColor ?? 'rgba(139, 115, 85, 0.12)',
              opacity: isDisabled ? 0.4 : 1,
              cursor: isDisabled ? 'not-allowed' : undefined,
            }}
          >
            {/* Row 1: Input + Send button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 6px 8px 14px',
                gap: 8,
              }}
            >
              <AnimatePresence mode="wait">
                {/* Text mode */}
                {activeCapability === null && !silverSentFlash && (
                  <motion.div
                    key="text"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <input
                      ref={inputRef}
                      data-testid="chat-input"
                      type="text"
                      value={isDisabled && countdown
                        ? `${context === 'main' ? 'Group chat' : 'DMs'} open${countdown ? ` in ${countdown}` : ''}`
                        : inputValue}
                      onChange={(e) => {
                        if (isDisabled) return;
                        setInputValue(e.target.value);
                        if (e.target.value) {
                          engine.sendTyping(channel);
                        }
                      }}
                      placeholder={getPlaceholderFromHints(hints, isDisabled && !countdown, context, placeholderTick)}
                      maxLength={280}
                      readOnly={isDisabled}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 17,
                        fontFamily: isDisabled && countdown ? 'var(--vivid-font-display)' : 'var(--vivid-font-body)',
                        fontWeight: isDisabled && countdown ? 600 : undefined,
                        letterSpacing: isDisabled && countdown ? '0.02em' : undefined,
                        color: isDisabled && countdown ? 'var(--vivid-text-dim)' : 'var(--vivid-text)',
                        padding: 0,
                        width: '100%',
                      }}
                    />
                  </motion.div>
                )}

                {/* Silver transfer mode */}
                {activeCapability === 'SILVER_TRANSFER' && (
                  <motion.div
                    key="silver"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <span style={{ ...CANNED_TEXT, color: '#C49A20' }}>Send</span>
                    {SILVER_AMOUNTS.map(amt => (
                      <motion.button
                        key={amt}
                        type="button"
                        onClick={() => setSilverAmount(amt)}
                        disabled={amt > myBalance}
                        style={{
                          padding: '2px 10px',
                          borderRadius: 10,
                          background: amt === silverAmount
                            ? '#C49A20'
                            : 'rgba(196, 154, 32, 0.1)',
                          color: amt === silverAmount ? '#FFFFFF' : '#C49A20',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 14,
                          fontFamily: 'var(--vivid-font-display)',
                          cursor: amt > myBalance ? 'not-allowed' : 'pointer',
                          opacity: amt > myBalance ? 0.3 : 1,
                          lineHeight: '22px',
                        }}
                        whileTap={amt <= myBalance ? VIVID_TAP.button : undefined}
                      >
                        {amt}
                      </motion.button>
                    ))}
                    <span style={CANNED_TEXT}>silver</span>
                    {targetId && (
                      <PersonaAvatar
                        avatarUrl={roster[targetId]?.avatarUrl}
                        personaName={roster[targetId]?.personaName}
                        size={22}
                      />
                    )}
                  </motion.div>
                )}

                {/* Silver sent confirmation flash */}
                {silverSentFlash && !activeCapability && (
                  <motion.div
                    key="silver-sent"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#FFF',
                      flexShrink: 0,
                    }}>$</span>
                    <span style={{
                      ...CANNED_TEXT,
                      color: '#7C3AED',
                      fontWeight: 600,
                    }}>
                      Sent {silverSentFlash.amount} silver to {silverSentFlash.target}
                    </span>
                  </motion.div>
                )}

                {/* Invite member mode */}
                {activeCapability === 'INVITE_MEMBER' && (
                  <motion.div
                    key="invite"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {!channelId ? (
                      <span style={CANNED_TEXT}>
                        Send a message first to start the conversation
                      </span>
                    ) : eligible.length === 0 ? (
                      <span style={CANNED_TEXT}>
                        No eligible players to invite
                      </span>
                    ) : (
                      <>
                        <span style={{ ...CANNED_TEXT, color: '#3BA99C' }}>Invite</span>
                        {eligible.map(([pid, player]) => (
                          <motion.button
                            key={pid}
                            type="button"
                            onClick={() => setSelectedInvitee(
                              selectedInvitee === pid ? null : pid
                            )}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 10px 2px 4px',
                              borderRadius: 9999,
                              background: pid === selectedInvitee
                                ? '#3BA99C'
                                : 'rgba(59, 169, 156, 0.1)',
                              color: pid === selectedInvitee ? '#FFFFFF' : '#3BA99C',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: 13,
                              fontFamily: 'var(--vivid-font-display)',
                              cursor: 'pointer',
                              lineHeight: '22px',
                            }}
                            whileTap={VIVID_TAP.button}
                          >
                            <PersonaAvatar
                              avatarUrl={player.avatarUrl}
                              personaName={player.personaName}
                              size={20}
                            />
                            {player.personaName.split(' ')[0]}
                          </motion.button>
                        ))}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Char info mode */}
                {activeCapability === 'CHAR_INFO' && (
                  <motion.div
                    key="char-info"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <span style={{
                      fontSize: 14,
                      fontFamily: 'var(--vivid-font-body)',
                      color: 'var(--vivid-text-dim)',
                      fontStyle: 'italic',
                    }}>
                      <span style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontWeight: 700,
                        fontStyle: 'normal',
                        color: charsColor,
                      }}>
                        {charsRemaining}
                      </span>
                      {' of '}
                      <span style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontWeight: 700,
                        fontStyle: 'normal',
                      }}>
                        {charsLimit}
                      </span>
                      {' chars remaining today'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send button — always inline */}
              <motion.button
                data-testid="chat-send"
                type="submit"
                disabled={!canSend || isDisabled}
                style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: canSend && !isDisabled ? 'var(--vivid-coral)' : 'rgba(139, 115, 85, 0.08)',
                  color: canSend && !isDisabled ? '#FFFFFF' : 'var(--vivid-text-dim)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: !canSend || isDisabled ? 'default' : 'pointer',
                  opacity: !canSend || isDisabled ? 0.4 : 1,
                  transition: 'background 0.2s, opacity 0.2s',
                }}
                whileTap={canSend && !isDisabled ? VIVID_TAP.button : undefined}
                transition={VIVID_SPRING.bouncy}
              >
                <Plain size={20} weight="Bold" />
              </motion.button>
            </div>

            {/* Row 2: Capability action icons (only when capabilities exist) */}
            {hasToolbar && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: '4px 10px 6px',
                  borderTop: '1px solid rgba(139, 115, 85, 0.06)',
                }}
              >
                {hasCharCounter && (
                  <motion.button
                    type="button"
                    onClick={() => toggleCapability('CHAR_INFO')}
                    disabled={isDisabled}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: activeCapability === 'CHAR_INFO'
                        ? 'rgba(139, 115, 85, 0.1)'
                        : 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activeCapability === 'CHAR_INFO'
                        ? 'var(--vivid-text)'
                        : 'var(--vivid-text-dim)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      padding: 0,
                      position: 'relative',
                    }}
                    whileTap={!isDisabled ? VIVID_TAP.button : undefined}
                  >
                    <FileText size={20} weight="Bold" />
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -6,
                        minWidth: 18,
                        height: 14,
                        borderRadius: 7,
                        background: charsRatio < 0.15 ? '#D94073' : charsRatio < 0.3 ? '#D4960A' : 'rgba(139, 115, 85, 0.5)',
                        color: '#FFFFFF',
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 8,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 3px',
                        lineHeight: 1,
                      }}
                    >
                      {charsRemaining}
                    </span>
                  </motion.button>
                )}
                {hasSilver && (
                  <motion.button
                    type="button"
                    onClick={() => toggleCapability('SILVER_TRANSFER')}
                    disabled={isDisabled}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: activeCapability === 'SILVER_TRANSFER'
                        ? 'rgba(196, 154, 32, 0.12)'
                        : 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activeCapability === 'SILVER_TRANSFER'
                        ? '#C49A20'
                        : 'var(--vivid-text-dim)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      padding: 0,
                      position: 'relative',
                    }}
                    whileTap={!isDisabled ? VIVID_TAP.button : undefined}
                  >
                    <Dollar size={20} weight="Bold" />
                    {/* Silver balance badge */}
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        background: '#D4960A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 3px',
                        lineHeight: 1,
                        overflow: 'visible',
                      }}
                    >
                      <AnimatedCounter
                        value={myBalance}
                        style={{
                          fontFamily: 'var(--vivid-font-mono)',
                          fontSize: 9,
                          fontWeight: 800,
                          color: '#FFFFFF',
                        }}
                        decreaseColor="#D94073"
                        increaseColor="#D4960A"
                      />
                    </span>
                  </motion.button>
                )}
                {hasInvite && (
                  <motion.button
                    type="button"
                    onClick={() => toggleCapability('INVITE_MEMBER')}
                    disabled={isDisabled}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: activeCapability === 'INVITE_MEMBER'
                        ? 'rgba(59, 169, 156, 0.12)'
                        : 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activeCapability === 'INVITE_MEMBER'
                        ? '#3BA99C'
                        : 'var(--vivid-text-dim)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      padding: 0,
                    }}
                    whileTap={!isDisabled ? VIVID_TAP.button : undefined}
                  >
                    <UserPlus size={20} weight="Bold" />
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
