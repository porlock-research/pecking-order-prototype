import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ChannelCapability, ChannelType } from '@pecking-order/shared-types';
import { ChannelTypes } from '@pecking-order/shared-types';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { HintChips } from '../input/HintChips';
import type { Command } from '../../hooks/useCommandBuilder';

interface Props {
  channelId: string | null;
  recipientIds: string[];
  placeholderName: string;
  disabled?: boolean;
}

// Defaults used before the server-side channel exists (first-message flow).
// Match what l3-social.ts will create so chip affordance stays consistent.
const DEFAULT_DM_CAPS: ChannelCapability[] = ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE'];
const DEFAULT_GROUP_CAPS: ChannelCapability[] = ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'];

export function DmInput({ channelId, recipientIds, placeholderName, disabled }: Props) {
  const { engine, openSendSilver, openNudge } = usePulse();
  const channel = useGameStore(s => (channelId ? s.channels[channelId] : undefined));
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  const isGroup = recipientIds.length > 1;
  const channelType: ChannelType = channel?.type ?? (isGroup ? ChannelTypes.GROUP_DM : ChannelTypes.DM);
  const capabilities = channel?.capabilities ?? (isGroup ? DEFAULT_GROUP_CAPS : DEFAULT_DM_CAPS);

  const submit = () => {
    if (!text.trim() || disabled) return;
    if (channelId) {
      engine.sendToChannel(channelId, text.trim());
    } else {
      engine.sendFirstMessage(recipientIds, text.trim());
    }
    setText('');
  };

  const handleChip = (command: Command) => {
    if (command === 'silver') {
      if (!isGroup) {
        openSendSilver(recipientIds[0]);
      } else {
        // Group silver picker not yet built — point the user at the member list.
        toast.message('Tap a member above to send silver');
      }
      return;
    }
    if (command === 'nudge') {
      if (!isGroup) openNudge(recipientIds[0]);
      return;
    }
    if (command === 'mention') {
      setText(t => (t.length > 0 && !t.endsWith(' ') ? `${t} @` : `${t}@`));
      inputRef.current?.focus();
      return;
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--pulse-border)',
      background: 'var(--pulse-surface)',
    }}>
      <HintChips
        onSelect={handleChip}
        channelType={channelType}
        capabilities={capabilities}
      />
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--pulse-bg)', borderRadius: 20, padding: '6px 8px 6px 14px',
          opacity: disabled ? 0.5 : 1,
        }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            disabled={disabled}
            placeholder={`Message ${placeholderName}…`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={submit}
            disabled={disabled || !text.trim()}
            style={{
              background: 'var(--pulse-accent)', color: '#fff',
              border: 'none', borderRadius: 16, padding: '6px 14px',
              fontWeight: 700, cursor: 'pointer',
              opacity: (disabled || !text.trim()) ? 0.5 : 1,
            }}
          >Send</button>
        </div>
      </div>
    </div>
  );
}
