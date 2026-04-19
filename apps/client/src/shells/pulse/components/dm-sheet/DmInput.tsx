import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ChannelCapability, ChannelType } from '@pecking-order/shared-types';
import { ChannelTypes } from '@pecking-order/shared-types';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { HintChips } from '../input/HintChips';
import { SilverPip } from '../common/SilverPip';
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
  const { engine, openSendSilver, openNudge, playerId } = usePulse();
  const channel = useGameStore(s => (channelId ? s.channels[channelId] : undefined));
  const ownSilver = useGameStore(s => s.roster[playerId]?.silver ?? 0);
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  const isGroup = recipientIds.length > 1;
  const channelType: ChannelType = channel?.type ?? (isGroup ? ChannelTypes.GROUP_DM : ChannelTypes.DM);
  const capabilities = channel?.capabilities ?? (isGroup ? DEFAULT_GROUP_CAPS : DEFAULT_DM_CAPS);
  const noSilver = ownSilver === 0;
  // Phase gate takes precedence over silver: if DMs are closed, no message can
  // land regardless of wallet. Server's isChannelMessageAllowed already rejects
  // these, but the UI must reflect it so the player doesn't keep typing.
  const sendDisabled = disabled || !dmsOpen || noSilver;

  const placeholder = !dmsOpen
    ? 'DMs are closed'
    : noSilver
      ? 'Out of silver'
      : `Message ${placeholderName}…`;

  const submit = () => {
    if (!text.trim() || sendDisabled) return;
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
      {/* Pip + hint chips share a row — pip sits leftmost, in the same
          metadata register as the chips. Silver cost is type-identity here,
          not a separate HUD. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <SilverPip variant="compose" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <HintChips
            onSelect={handleChip}
            channelType={channelType}
            capabilities={capabilities}
            groupChatOpen={groupChatOpen}
            dmsOpen={dmsOpen}
          />
        </div>
      </div>
      {dmsOpen && noSilver && (
        <div style={{
          padding: '4px 12px 6px',
          fontSize: 11,
          color: 'var(--pulse-pending)',
          fontWeight: 600,
          fontFamily: 'var(--po-font-body)',
        }}>
          Out of silver — play today's game to earn more.
        </div>
      )}
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--pulse-bg)', borderRadius: 20, padding: '6px 8px 6px 14px',
          opacity: disabled || !dmsOpen ? 0.55 : 1,
        }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            disabled={sendDisabled}
            placeholder={placeholder}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={submit}
            disabled={sendDisabled || !text.trim()}
            style={{
              background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
              border: 'none', borderRadius: 16, padding: '6px 14px',
              fontWeight: 700, cursor: 'pointer',
              opacity: (sendDisabled || !text.trim()) ? 0.5 : 1,
            }}
          >Send</button>
        </div>
      </div>
    </div>
  );
}
