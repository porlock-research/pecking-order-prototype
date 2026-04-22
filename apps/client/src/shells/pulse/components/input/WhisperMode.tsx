import { useState, useRef, useEffect } from 'react';
import { Lock, X, PaperPlaneTilt } from '../../icons';
import { motion } from 'framer-motion';
import { PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface WhisperModeProps {
  player: SocialPlayer;
  playerId: string;
  onSend: (text: string) => void;
  onCancel: () => void;
  sending?: boolean;
}

export function WhisperMode({ player, playerId, onSend, onCancel, sending = false }: WhisperModeProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!text.trim() || sending) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <Lock size={18} weight="fill" style={{ color: 'var(--pulse-whisper)', flexShrink: 0 }} />

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
        disabled={!text.trim() || sending}
        aria-label="Send whisper"
        aria-busy={sending}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: text.trim() ? 'var(--pulse-whisper)' : 'var(--pulse-surface-2)',
          border: 'none', cursor: sending ? 'wait' : text.trim() ? 'pointer' : 'default',
          color: 'var(--pulse-on-accent)',
          opacity: sending ? 0.55 : 1,
          pointerEvents: sending ? 'none' : 'auto',
        }}
      >
        <PaperPlaneTilt size={18} weight="fill" />
      </motion.button>

      <button
        onClick={onCancel}
        aria-label="Cancel whisper"
        style={{
          width: 36, height: 36,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--pulse-text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}
