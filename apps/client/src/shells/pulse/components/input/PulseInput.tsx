import { useState, useRef, useEffect, useCallback } from 'react';
import { PaperPlaneTilt } from '../../icons';
import { motion } from 'framer-motion';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { useCommandBuilder } from '../../hooks/useCommandBuilder';
import { PULSE_TAP } from '../../springs';
import { HintChips } from './HintChips';
import { CommandPicker } from './CommandPicker';
import { PlayerPicker } from './PlayerPicker';
import { AmountPicker } from './AmountPicker';
import { CommandPreview } from './CommandPreview';
import { WhisperMode } from './WhisperMode';
import { ReplyBar } from './ReplyBar';
import { MentionAutocomplete } from './MentionAutocomplete';
import { DayPhases } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';

export function PulseInput() {
  const { engine, playerId, openDM, openNudge } = usePulse();
  const phase = useGameStore(s => s.phase);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    commandMode,
    openCommandPicker,
    selectCommand,
    selectPlayer,
    selectAmount,
    startReply,
    cancel,
    back,
  } = useCommandBuilder();

  // Listen for reply events from ReactionBar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setReplyTo(detail.message);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('pulse:reply', handler);
    return () => window.removeEventListener('pulse:reply', handler);
  }, []);

  const isSocialPhase = phase !== DayPhases.ELIMINATION && phase !== DayPhases.GAME_OVER;

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    engine.sendMessage(text.trim(), replyTo ? { replyTo: replyTo.id } : undefined);
    setText('');
    setReplyTo(null);
  }, [text, replyTo, engine]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (val === '/') {
      openCommandPicker();
      setText('');
      return;
    }
    // Send typing indicator (auto-stops after 3s on server side)
    if (val.length > 0) engine.sendTyping('MAIN');
  };

  // Detect @query for mention autocomplete
  const getMentionQuery = (val: string): string | null => {
    const atIdx = val.lastIndexOf('@');
    if (atIdx < 0) return null;
    const after = val.slice(atIdx + 1);
    // No space after @ — still showing autocomplete
    if (after.includes(' ')) return null;
    return after;
  };

  const handleMentionSelect = useCallback((playerName: string) => {
    const atIdx = text.lastIndexOf('@');
    if (atIdx < 0) return;
    const before = text.slice(0, atIdx);
    setText(`${before}@${playerName} `);
    inputRef.current?.focus();
  }, [text]);

  const mentionQuery = commandMode.mode === 'idle' ? getMentionQuery(text) : null;

  // Command flow handlers
  const handlePlayerSelect = useCallback((player: any, pid: string) => {
    if (commandMode.mode !== 'player-picker') return;
    const cmd = commandMode.command;

    if (cmd === 'dm') {
      openDM(pid);
      cancel();
      return;
    }

    if (cmd === 'nudge') {
      openNudge(pid);
      cancel();
      return;
    }

    if (cmd === 'mention') {
      setText(prev => prev + `@${player.personaName} `);
      cancel();
      inputRef.current?.focus();
      return;
    }

    selectPlayer(player, pid);
  }, [commandMode, engine, cancel, selectPlayer]);

  const handleSilverSend = useCallback(() => {
    if (commandMode.mode !== 'preview') return;
    engine.sendSilver(commandMode.amount, commandMode.playerId);
    cancel();
  }, [commandMode, engine, cancel]);

  const handleWhisperSend = useCallback((whisperText: string) => {
    if (commandMode.mode !== 'whisper') return;
    engine.sendWhisper(commandMode.playerId, whisperText);
    cancel();
  }, [commandMode, engine, cancel]);

  // Breadcrumb for player picker
  const getBreadcrumb = () => {
    if (commandMode.mode !== 'player-picker') return '';
    const labels: Record<string, string> = { silver: 'Send Silver', dm: 'Direct Message', nudge: 'Nudge', whisper: 'Whisper', mention: 'Mention' };
    return `${labels[commandMode.command] || ''} — pick a player`;
  };

  if (!isSocialPhase) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--pulse-text-3)', fontSize: 12, fontStyle: 'italic', borderTop: '1px solid var(--pulse-border)' }}>
        Chat opens at dawn
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', position: 'relative', zIndex: 5 }}>
      {/* Command overlays */}
      {commandMode.mode === 'command-picker' && (
        <CommandPicker onSelect={selectCommand} onClose={cancel} />
      )}

      {commandMode.mode === 'player-picker' && (
        <PlayerPicker
          breadcrumb={getBreadcrumb()}
          onSelect={handlePlayerSelect}
          onBack={back}
        />
      )}

      {commandMode.mode === 'amount-picker' && (
        <AmountPicker
          player={commandMode.player}
          playerId={commandMode.playerId}
          onSelect={selectAmount}
          onBack={back}
        />
      )}

      {commandMode.mode === 'preview' && (
        <CommandPreview
          player={commandMode.player}
          playerId={commandMode.playerId}
          amount={commandMode.amount}
          onSend={handleSilverSend}
          onCancel={cancel}
        />
      )}

      {commandMode.mode === 'whisper' && (
        <WhisperMode
          player={commandMode.player}
          playerId={commandMode.playerId}
          onSend={handleWhisperSend}
          onCancel={cancel}
        />
      )}

      {/* Reply bar */}
      {replyTo && commandMode.mode === 'idle' && (
        <ReplyBar message={replyTo} onCancel={() => setReplyTo(null)} />
      )}

      {/* Default input (idle mode) */}
      {commandMode.mode === 'idle' && (
        <>
          {/* Mention autocomplete */}
          {mentionQuery !== null && (
            <div style={{ position: 'relative' }}>
              <MentionAutocomplete
                query={mentionQuery}
                onSelect={handleMentionSelect}
                excludeId={playerId}
              />
            </div>
          )}
          <HintChips onSelect={selectCommand} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--pulse-surface-2)',
                border: '1px solid var(--pulse-border)',
                color: 'var(--pulse-text-1)',
                fontSize: 14,
                fontFamily: 'var(--po-font-body)',
                outline: 'none',
              }}
            />
            {text.trim() && (
              <motion.button
                whileTap={PULSE_TAP.button}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleSend}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--pulse-accent)',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </motion.button>
            )}
          </div>
        </>
      )}

      {/* Reply mode also shows input */}
      {commandMode.mode === 'reply' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            autoFocus
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'var(--po-font-body)', outline: 'none',
            }}
          />
          <motion.button whileTap={PULSE_TAP.button} onClick={handleSend} disabled={!text.trim()}
            style={{
              width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: text.trim() ? 'var(--pulse-accent)' : 'var(--pulse-surface-2)',
              border: 'none', cursor: text.trim() ? 'pointer' : 'default', color: '#fff',
            }}>
            <PaperPlaneTilt size={16} weight="fill" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
