import { useState, useRef, useEffect, useCallback } from 'react';
import { Coins, PaperPlaneTilt } from '../../icons';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { useCommandBuilder } from '../../hooks/useCommandBuilder';
import { PULSE_TAP } from '../../springs';
import { PULSE_Z } from '../../zIndex';
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
  const mainCapabilities = useGameStore(s => s.channels?.['MAIN']?.capabilities);
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
    // Sender celebration — brief haptic + gold-iconed toast.
    try { navigator.vibrate?.(15); } catch { /* no-op */ }
    toast.success(`${commandMode.amount} silver → ${commandMode.player.personaName}`, {
      icon: <Coins size={18} weight="fill" style={{ color: 'var(--pulse-gold)' }} />,
    });
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

  // When chat is closed the ChatView renders its own "Chat opens at dawn"
  // notice in the empty chat area. Hiding the input bar here avoids a
  // duplicate copy of the same message stacked at the bottom of the viewport.
  if (!isSocialPhase) return null;

  return (
    <div style={{ borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', position: 'relative', zIndex: PULSE_Z.flow }}>
      {/* Command overlays */}
      {commandMode.mode === 'command-picker' && (
        <CommandPicker onSelect={selectCommand} onClose={cancel} />
      )}

      {commandMode.mode === 'player-picker' && (
        <PlayerPicker
          breadcrumb={getBreadcrumb()}
          command={commandMode.command}
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
          <HintChips
            onSelect={selectCommand}
            channelType="MAIN"
            capabilities={mainCapabilities}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-sm)', padding: 'var(--pulse-space-md) var(--pulse-space-md)' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              style={{
                flex: 1,
                padding: 'var(--pulse-space-md) var(--pulse-space-lg)',
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
                aria-label="Send message"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--pulse-accent)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--pulse-on-accent)',
                }}
              >
                <PaperPlaneTilt size={18} weight="fill" />
              </motion.button>
            )}
          </div>
        </>
      )}

      {/* Reply mode also shows input */}
      {commandMode.mode === 'reply' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-sm)', padding: 'var(--pulse-space-md) var(--pulse-space-md)' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            autoFocus
            style={{
              flex: 1, padding: 'var(--pulse-space-md) var(--pulse-space-lg)', borderRadius: 12,
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'var(--po-font-body)', outline: 'none',
            }}
          />
          <motion.button whileTap={PULSE_TAP.button} onClick={handleSend} disabled={!text.trim()}
            aria-label="Send reply"
            style={{
              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: text.trim() ? 'var(--pulse-accent)' : 'var(--pulse-surface-2)',
              border: 'none', cursor: text.trim() ? 'pointer' : 'default', color: 'var(--pulse-on-accent)',
            }}>
            <PaperPlaneTilt size={18} weight="fill" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
