import React from 'react';
import { motion } from 'framer-motion';
import { Crown } from '@solar-icons/react';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface ConversationCardProps {
  type: '1on1' | 'group' | 'gm';
  avatarUrl?: string;
  personaName?: string;
  memberAvatars?: Array<{ avatarUrl?: string; personaName?: string }>;
  lastMessage?: string;
  lastSenderName?: string;
  timestamp?: number;
  isOnline?: boolean;
  onClick: () => void;
  index?: number;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ConversationCard({
  type,
  avatarUrl,
  personaName,
  memberAvatars,
  lastMessage,
  lastSenderName,
  timestamp,
  isOnline,
  onClick,
  index,
}: ConversationCardProps) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 16,
        background: 'var(--vivid-bg-surface)',
        border: type === 'gm'
          ? '1px solid rgba(255, 217, 61, 0.2)'
          : '1px solid rgba(255, 255, 255, 0.06)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...VIVID_SPRING.gentle, delay: (index ?? 0) * 0.04 }}
      whileTap={VIVID_TAP.card}
    >
      {/* Avatar area */}
      {type === 'gm' && (
        <div
          style={{
            width: 48,
            height: 48,
            minWidth: 48,
            borderRadius: '50%',
            background: 'rgba(255, 217, 61, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Crown size={24} weight="BoldDuotone" color="var(--vivid-gold)" />
        </div>
      )}

      {type === '1on1' && (
        <div style={{ position: 'relative', width: 48, height: 48, minWidth: 48 }}>
          <PersonaAvatar
            avatarUrl={avatarUrl}
            personaName={personaName}
            size={48}
            isOnline={isOnline}
          />
        </div>
      )}

      {type === 'group' && (
        <div style={{ position: 'relative', width: 52, height: 52, minWidth: 52 }}>
          {(memberAvatars ?? []).slice(0, 3).map((member, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: idx * 12,
                left: idx * 12,
                zIndex: 3 - idx,
              }}
            >
              <PersonaAvatar
                avatarUrl={member.avatarUrl}
                personaName={member.personaName}
                size={36}
                className="ring-2 ring-[var(--vivid-bg-deep)]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: name + timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 15,
              color: type === 'gm' ? 'var(--vivid-gold)' : 'var(--vivid-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {type === 'gm' ? 'Game Master' : personaName ?? 'Unknown'}
          </span>
          {timestamp != null && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'var(--vivid-text-dim)',
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              {formatRelativeTime(timestamp)}
            </span>
          )}
        </div>

        {/* Bottom row: last message preview */}
        {lastMessage && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--vivid-text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            }}
          >
            {lastSenderName ? `${lastSenderName}: ` : ''}{lastMessage}
          </p>
        )}
      </div>
    </motion.button>
  );
}
