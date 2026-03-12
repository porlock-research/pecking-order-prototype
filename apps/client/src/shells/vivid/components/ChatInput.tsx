import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendSquare, CloseCircle, Dollar, UserPlus } from '@solar-icons/react';
import type { ChatMessage, SocialPlayer, ChannelCapability } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { SilverTransferFlow } from './SilverTransferFlow';
import { InviteMemberFlow } from './InviteMemberFlow';

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

/* ------------------------------------------------------------------ */
/*  Typing indicator sub-components                                    */
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

  const replyName = replyTarget
    ? roster[replyTarget.senderId]?.personaName || 'Unknown'
    : '';

  /* -- Send -------------------------------------------------------- */

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || !playerId) return;

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

  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--vivid-bg-surface)',
        borderTop: '1px solid rgba(139, 115, 85, 0.08)',
      }}
    >
      <div style={{ padding: '6px 12px 12px' }}>
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
              {/* Coral left border bar */}
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

        {/* Active capability flow panels */}
        <AnimatePresence>
          {activeCapability === 'SILVER_TRANSFER' && (
            <SilverTransferFlow
              playerId={playerId}
              targetId={targetId}
              targetName={targetName}
              channelId={channelId}
              roster={roster}
              context={context}
              onSend={(amount, recipientId) => {
                engine.sendSilver(amount, recipientId);
                setActiveCapability(null);
              }}
              onCancel={() => setActiveCapability(null)}
            />
          )}
          {activeCapability === 'INVITE_MEMBER' && (
            <InviteMemberFlow
              playerId={playerId}
              channelId={channelId}
              roster={roster}
              channelMemberIds={channelMemberIds ?? []}
              onInvite={(memberIds) => {
                if (channelId) {
                  engine.addMember(channelId, memberIds);
                }
                setActiveCapability(null);
              }}
              onCancel={() => setActiveCapability(null)}
            />
          )}
        </AnimatePresence>

        {/* Input row */}
        <form
          onSubmit={handleSend}
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
        >
          {/* Text input */}
          <input
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
              background: '#FFFFFF',
              border: '2px solid rgba(139, 115, 85, 0.12)',
              borderRadius: 9999,
              padding: '12px 20px',
              fontSize: 16,
              fontFamily: 'var(--vivid-font-body)',
              color: 'var(--vivid-text)',
              outline: 'none',
              opacity: isDisabled ? 0.4 : 1,
              cursor: isDisabled ? 'not-allowed' : 'text',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              boxShadow: '0 1px 4px rgba(139, 115, 85, 0.06)',
            }}
            onFocus={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(59, 169, 156, 0.15)';
                e.currentTarget.style.borderColor = 'var(--vivid-phase-accent)';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(139, 115, 85, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(139, 115, 85, 0.12)';
            }}
          />

          {/* Capability action icons — small, inline, always visible */}
          {hasSilver && (
            <motion.button
              type="button"
              onClick={() => setActiveCapability(activeCapability === 'SILVER_TRANSFER' ? null : 'SILVER_TRANSFER')}
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeCapability === 'SILVER_TRANSFER' ? '#C49A20' : 'var(--vivid-text-dim)',
                cursor: 'pointer',
                padding: 0,
              }}
              whileTap={VIVID_TAP.button}
            >
              <Dollar size={20} weight="Bold" />
            </motion.button>
          )}
          {hasInvite && (
            <motion.button
              type="button"
              onClick={() => setActiveCapability(activeCapability === 'INVITE_MEMBER' ? null : 'INVITE_MEMBER')}
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeCapability === 'INVITE_MEMBER' ? '#3BA99C' : 'var(--vivid-text-dim)',
                cursor: 'pointer',
                padding: 0,
              }}
              whileTap={VIVID_TAP.button}
            >
              <UserPlus size={20} weight="Bold" />
            </motion.button>
          )}

          {/* Send button */}
          <motion.button
            data-testid="chat-send"
            type="submit"
            disabled={!inputValue.trim() || isDisabled}
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--vivid-coral)',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor:
                !inputValue.trim() || isDisabled ? 'not-allowed' : 'pointer',
              opacity: !inputValue.trim() || isDisabled ? 0.4 : 1,
              boxShadow: '0 3px 10px rgba(232, 97, 77, 0.25)',
            }}
            whileTap={VIVID_TAP.fab}
            transition={VIVID_SPRING.bouncy}
          >
            <SendSquare size={20} weight="Bold" />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
