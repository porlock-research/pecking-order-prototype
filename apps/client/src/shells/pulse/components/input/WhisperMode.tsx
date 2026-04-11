import { useState, useRef, useEffect } from 'react';
import { Lock, X, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface WhisperModeProps {
  player: SocialPlayer;
  playerId: string;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function WhisperMode({ player, playerId, onSend, onCancel }: WhisperModeProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <Lock size={16} style={{ color: 'var(--pulse-whisper)', flexShrink: 0 }} />

      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder={`Whisper to ${player.personaName}...`}
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(155, 89, 182, 0.08)',
          border: '1px solid rgba(155, 89, 182, 0.3)',
          color: 'var(--pulse-text-1)',
          fontSize: 14,
          fontFamily: 'var(--po-font-body)',
          outline: 'none',
        }}
      />

      <motion.button
        whileTap={PULSE_TAP.button}
        onClick={handleSubmit}
        disabled={!text.trim()}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: text.trim() ? 'var(--pulse-whisper)' : 'var(--pulse-surface-2)',
          border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          color: '#fff',
        }}
      >
        <Send size={16} />
      </motion.button>

      <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-3)', display: 'flex' }}>
        <X size={16} />
      </button>
    </div>
  );
}
