import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendSquare, CloseCircle, Dollar, UserPlus } from '@solar-icons/react';
import type { ChatMessage, SocialPlayer, ChannelCapability } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

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
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPlaceholder(
  context: 'main' | 'dm' | 'group',
  targetName?: string,
  disabled?: boolean,
  serverState?: string | null,
): string {
  if (disabled) {
    return context === 'main' ? 'Chat closed...' : 'DMs closed...';
  }
  switch (context) {
    case 'main': {
      if (serverState && typeof serverState === 'string') {
        const s = serverState.toLowerCase();
        if (s.includes('voting')) return 'Quick, before votes close...';
        if (s.includes('game')) return 'Talk strategy...';
      }
      return 'Plot your next move...';
    }
    case 'dm':
      return `Whisper to ${targetName ?? 'them'}...`;
    case 'group':
      return 'Message the group...';
  }
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

type ActiveCapability = 'SILVER_TRANSFER' | 'INVITE_MEMBER' | null;

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
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeCapability, setActiveCapability] = useState<ActiveCapability>(null);
  const [silverAmount, setSilverAmount] = useState<number>(5);
  const [selectedInvitee, setSelectedInvitee] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { playerId, roster } = useGameStore();
  const typingPlayers = useGameStore((s) => s.typingPlayers);
  const groupChatOpen = useGameStore((s) => s.groupChatOpen);
  const dmsOpen = useGameStore((s) => s.dmsOpen);
  const serverState = useGameStore((s) => s.serverState);

  const channel = getChannel(context, targetId);
  const isDisabled = context === 'main' ? !groupChatOpen : !dmsOpen;

  // Input-area capabilities (exclude CHAT, REACTIONS, REPLIES — those are message-level)
  const inputCapabilities = useMemo(() =>
    (capabilities ?? []).filter(c => c !== 'CHAT' && c !== 'REACTIONS' && c !== 'REPLIES'),
    [capabilities]
  );

  const hasSilver = inputCapabilities.includes('SILVER_TRANSFER');
  const hasInvite = inputCapabilities.includes('INVITE_MEMBER');
  const hasToolbar = hasSilver || hasInvite;

  const replyName = replyTarget
    ? roster[replyTarget.senderId]?.personaName || 'Unknown'
    : '';

  // Silver: player balance
  const myBalance = playerId ? (roster[playerId]?.silver ?? 0) : 0;

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
        : !!inputValue.trim();

  /* -- Toggle capability ------------------------------------------- */

  const toggleCapability = (cap: ActiveCapability) => {
    if (activeCapability === cap) {
      setActiveCapability(null);
      setSelectedInvitee(null);
      // Refocus text input
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setActiveCapability(cap);
      setSelectedInvitee(null);
      setSilverAmount(5);
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

        {/* Closed banner */}
        {isDisabled && (
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
              ? 'Group chat is currently closed'
              : 'DMs are currently closed'}
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
                {activeCapability === null && (
                  <motion.div
                    key="text"
                    style={{ flex: 1, display: 'flex', alignItems: 'center' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <input
                      ref={inputRef}
                      data-testid="chat-input"
                      type="text"
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        if (e.target.value) {
                          engine.sendTyping(channel);
                        }
                      }}
                      placeholder={getPlaceholder(context, targetName, isDisabled, serverState)}
                      maxLength={280}
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 15,
                        fontFamily: 'var(--vivid-font-body)',
                        color: 'var(--vivid-text)',
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
                    <span style={CANNED_TEXT}>
                      silver{targetName ? ` to ${targetName}` : ''}
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
                            {player.personaName}
                          </motion.button>
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel button when capability active */}
              {activeCapability !== null && (
                <motion.button
                  type="button"
                  onClick={() => {
                    setActiveCapability(null);
                    setSelectedInvitee(null);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    color: 'var(--vivid-text-dim)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  whileTap={VIVID_TAP.button}
                >
                  <CloseCircle size={16} weight="Bold" />
                </motion.button>
              )}

              {/* Send button — always inline */}
              <motion.button
                data-testid="chat-send"
                type="submit"
                disabled={!canSend || isDisabled}
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
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
                <SendSquare size={16} weight="Bold" />
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
                {hasSilver && (
                  <motion.button
                    type="button"
                    onClick={() => toggleCapability('SILVER_TRANSFER')}
                    disabled={isDisabled}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
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
                    }}
                    whileTap={!isDisabled ? VIVID_TAP.button : undefined}
                  >
                    <Dollar size={16} weight="Bold" />
                  </motion.button>
                )}
                {hasInvite && (
                  <motion.button
                    type="button"
                    onClick={() => toggleCapability('INVITE_MEMBER')}
                    disabled={isDisabled}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
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
                    <UserPlus size={16} weight="Bold" />
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
