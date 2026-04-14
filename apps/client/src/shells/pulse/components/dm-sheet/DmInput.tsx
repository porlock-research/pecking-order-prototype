import { useState } from 'react';
import { usePulse } from '../../PulseShell';

interface Props {
  channelId: string | null;
  recipientIds: string[];
  placeholderName: string;
  disabled?: boolean;
}

export function DmInput({ channelId, recipientIds, placeholderName, disabled }: Props) {
  const { engine } = usePulse();
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim() || disabled) return;
    if (channelId) {
      engine.sendToChannel(channelId, text.trim());
    } else {
      engine.sendFirstMessage(recipientIds, text.trim());
    }
    setText('');
  };

  return (
    <div style={{
      padding: '8px 12px',
      borderTop: '1px solid var(--pulse-border)',
      background: 'var(--pulse-surface)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--pulse-bg)', borderRadius: 20, padding: '6px 8px 6px 14px',
        opacity: disabled ? 0.5 : 1,
      }}>
        <input
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
  );
}
