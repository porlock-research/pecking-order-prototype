import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { PaperPlaneTilt } from '../../icons';
import { AnimatePresence } from 'framer-motion';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { useCommandBuilder } from '../../hooks/useCommandBuilder';
import { useInFlight } from '../../hooks/useInFlight';
import { PULSE_Z } from '../../zIndex';
import { runViewTransition, supportsViewTransitions, prefersReducedMotion } from '../../viewTransitions';
import { HintChips } from './HintChips';
import { CommandPicker } from './CommandPicker';
import { PlayerPicker } from './PlayerPicker';
import { AmountPicker } from './AmountPicker';
import { CommandPreview } from './CommandPreview';
import { WhisperMode } from './WhisperMode';
import { ReplyBar } from './ReplyBar';
import { MentionAutocomplete } from './MentionAutocomplete';
import { SendButton } from './SendButton';
import { VoteFloatingChip } from '../VoteFloatingChip';
import { DayPhases } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';

export function PulseInput() {
  const { engine, playerId, openDM, openNudge } = usePulse();
  const phase = useGameStore(s => s.phase);
  const mainCapabilities = useGameStore(s => s.channels?.['MAIN']?.capabilities);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const focusCartridge = useGameStore(s => s.focusCartridge);
  const dayIndex = useGameStore(s => s.dayIndex);
  const voting = useGameStore(s => s.activeVotingCartridge);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending: sending, run: guard } = useInFlight();
  const { pending: silverSending, run: guardSilver } = useInFlight();
  const { pending: whisperSending, run: guardWhisper } = useInFlight();

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

  // Wrap commandMode transitions in a view transition so the hint-chip bar
  // morphs into the picker panel (and back). All panels carry the same
  // `command-panel` view-transition-name on a wrapper div — exactly one is
  // rendered at a time, so there's no duplicate-name collision.
  const withMorph = useCallback((fn: () => void) => {
    if (!supportsViewTransitions() || prefersReducedMotion()) {
      fn();
      return;
    }
    runViewTransition(() => flushSync(fn));
  }, []);
  const vtActive = supportsViewTransitions() && !prefersReducedMotion();
  const panelVtStyle: React.CSSProperties = vtActive
    ? { viewTransitionName: 'command-panel' }
    : {};

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
  // During pregame, group chat is closed but whispers are allowed — enable the
  // composer so the user can reach the /whisper command via HintChips or the
  // slash picker. Plain-text send stays gated on groupChatOpen (handleSend).
  const isPregame = phase === DayPhases.PREGAME;
  const composerEnabled = groupChatOpen || isPregame;

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    if (!groupChatOpen) return; // defensive — input is also disabled visually
    guard(() => {
      engine.sendMessage(text.trim(), replyTo ? { replyTo: replyTo.id } : undefined);
      setText('');
      setReplyTo(null);
    });
  }, [text, replyTo, engine, groupChatOpen, guard]);

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
    guardSilver(() => {
      engine.sendSilver(commandMode.amount, commandMode.playerId);
      // Sender celebration — haptic + SilverBurst overdrive layer. Toast
      // dropped; SOCIAL_TRANSFER chat card carries the announcement.
      try { navigator.vibrate?.(25); } catch { /* no-op */ }
      window.dispatchEvent(new CustomEvent('pulse:silver-burst', {
        detail: { amount: commandMode.amount, recipient: commandMode.player.personaName },
      }));
      cancel();
    });
  }, [commandMode, engine, cancel, guardSilver]);

  const handleWhisperSend = useCallback((whisperText: string) => {
    if (commandMode.mode !== 'whisper') return;
    guardWhisper(() => {
      engine.sendWhisper(commandMode.playerId, whisperText);
      cancel();
    });
  }, [commandMode, engine, cancel, guardWhisper]);

  // When chat is closed the ChatView renders its own "Chat opens at dawn"
  // notice in the empty chat area. Hiding the input bar here avoids a
  // duplicate copy of the same message stacked at the bottom of the viewport.
  if (!isSocialPhase) return null;

  return (
    <div style={{ borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', position: 'relative', zIndex: PULSE_Z.flow }}>
      {/* Floating vote chip — mounted at the input's outer wrapper (not
          inside the idle-mode block) so it survives command/reply/whisper
          mode transitions. Voting urgency shouldn't disappear when the user
          starts typing /silver. */}
      <VoteFloatingChip
        onTap={() => {
          if (!voting) return;
          const typeKey = (voting as any).mechanism || (voting as any).voteType || 'UNKNOWN';
          focusCartridge(`voting-${dayIndex}-${typeKey}`, 'voting', 'manual');
        }}
      />
      {/* Command overlays — each panel wrapper carries `view-transition-name:
          command-panel` so the hint-chip bar morphs into whichever panel is
          active next (and back on cancel/back). */}
      {commandMode.mode === 'command-picker' && (
        <div style={panelVtStyle}>
          <CommandPicker
            onSelect={(cmd) => withMorph(() => selectCommand(cmd))}
            onClose={() => withMorph(() => cancel())}
            dmsOpen={dmsOpen}
            capabilities={mainCapabilities}
            phase={phase}
          />
        </div>
      )}

      {commandMode.mode === 'player-picker' && (
        <div style={panelVtStyle}>
          <PlayerPicker
            command={commandMode.command}
            onSelect={(player, pid) => withMorph(() => handlePlayerSelect(player, pid))}
            onBack={() => withMorph(() => back())}
            phase={phase}
          />
        </div>
      )}

      {commandMode.mode === 'amount-picker' && (
        <div style={panelVtStyle}>
          <AmountPicker
            player={commandMode.player}
            playerId={commandMode.playerId}
            onSelect={(amount) => withMorph(() => selectAmount(amount))}
            onBack={() => withMorph(() => back())}
          />
        </div>
      )}

      {commandMode.mode === 'preview' && (
        <div style={panelVtStyle}>
          <CommandPreview
            player={commandMode.player}
            playerId={commandMode.playerId}
            amount={commandMode.amount}
            onSend={handleSilverSend}
            onCancel={() => withMorph(() => cancel())}
            sending={silverSending}
          />
        </div>
      )}

      {commandMode.mode === 'whisper' && (
        <div style={panelVtStyle}>
          <WhisperMode
            player={commandMode.player}
            playerId={commandMode.playerId}
            onSend={handleWhisperSend}
            onCancel={() => withMorph(() => cancel())}
            sending={whisperSending}
          />
        </div>
      )}

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && commandMode.mode === 'idle' && (
          <ReplyBar message={replyTo} onCancel={() => setReplyTo(null)} />
        )}
      </AnimatePresence>

      {/* Default input (idle mode) */}
      {commandMode.mode === 'idle' && (
        <div style={panelVtStyle}>
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
          <div style={{ padding: '6px 12px 2px' }}>
            <HintChips
              onSelect={(cmd) => withMorph(() => selectCommand(cmd))}
              channelType="MAIN"
              capabilities={mainCapabilities}
              groupChatOpen={groupChatOpen}
              dmsOpen={dmsOpen}
              phase={phase}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-sm)', padding: 'var(--pulse-space-md) var(--pulse-space-md)' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!composerEnabled}
              placeholder={
                groupChatOpen ? 'Message the chat…'
                : isPregame ? 'Whisper a cast member — try /whisper'
                : 'Group chat is closed'
              }
              style={{
                flex: 1,
                padding: 'var(--pulse-space-md) var(--pulse-space-lg)',
                borderRadius: 'var(--pulse-radius-md)',
                background: 'var(--pulse-surface-2)',
                border: '1px solid var(--pulse-border)',
                color: 'var(--pulse-text-1)',
                fontSize: 14,
                fontFamily: 'var(--po-font-body)',
                outline: 'none',
                opacity: composerEnabled ? 1 : 0.55,
                cursor: composerEnabled ? 'text' : 'not-allowed',
              }}
            />
            {text.trim() && (
              <SendButton
                variant="accent"
                shape="icon"
                onClick={handleSend}
                pending={sending}
                ariaLabel="Send message"
                animateIn
              >
                <PaperPlaneTilt size={18} weight="fill" />
              </SendButton>
            )}
          </div>
        </div>
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
              flex: 1, padding: 'var(--pulse-space-md) var(--pulse-space-lg)', borderRadius: 'var(--pulse-radius-md)',
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'var(--po-font-body)', outline: 'none',
            }}
          />
          <SendButton
            variant="accent"
            shape="icon"
            onClick={handleSend}
            disabled={!text.trim()}
            pending={sending}
            ariaLabel="Send reply"
            style={!text.trim() ? { background: 'var(--pulse-surface-2)' } : undefined}
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </SendButton>
        </div>
      )}
    </div>
  );
}
