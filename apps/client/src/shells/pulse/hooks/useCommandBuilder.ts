import { useState, useCallback } from 'react';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';

export type Command = 'silver' | 'dm' | 'nudge' | 'whisper' | 'mention';

export type CommandMode =
  | { mode: 'idle' }
  | { mode: 'command-picker' }
  | { mode: 'player-picker'; command: Command }
  | { mode: 'amount-picker'; command: 'silver'; player: SocialPlayer; playerId: string }
  | { mode: 'preview'; command: 'silver'; player: SocialPlayer; playerId: string; amount: number }
  | { mode: 'whisper'; player: SocialPlayer; playerId: string }
  | { mode: 'reply'; replyTo: ChatMessage };

export function useCommandBuilder() {
  const [state, setState] = useState<CommandMode>({ mode: 'idle' });

  const openCommandPicker = useCallback(() => setState({ mode: 'command-picker' }), []);

  const selectCommand = useCallback((command: Command) => {
    setState({ mode: 'player-picker', command });
  }, []);

  const selectPlayer = useCallback((player: SocialPlayer, playerId: string) => {
    if (state.mode !== 'player-picker') return;
    const cmd = state.command;
    switch (cmd) {
      case 'silver':
        setState({ mode: 'amount-picker', command: 'silver', player, playerId });
        break;
      case 'dm':
        // DM navigates immediately — handled by caller
        setState({ mode: 'idle' });
        break;
      case 'nudge':
        // Nudge executes immediately — handled by caller
        setState({ mode: 'idle' });
        break;
      case 'whisper':
        setState({ mode: 'whisper', player, playerId });
        break;
      case 'mention':
        // Mention inserts text — handled by caller
        setState({ mode: 'idle' });
        break;
    }
  }, [state]);

  const selectAmount = useCallback((amount: number) => {
    if (state.mode !== 'amount-picker') return;
    setState({ mode: 'preview', command: 'silver', player: state.player, playerId: state.playerId, amount });
  }, [state]);

  const startReply = useCallback((msg: ChatMessage) => {
    setState({ mode: 'reply', replyTo: msg });
  }, []);

  const cancel = useCallback(() => setState({ mode: 'idle' }), []);

  const back = useCallback(() => {
    switch (state.mode) {
      case 'player-picker':
        setState({ mode: 'command-picker' });
        break;
      case 'amount-picker':
        setState({ mode: 'player-picker', command: 'silver' });
        break;
      case 'preview':
        setState({ mode: 'amount-picker', command: 'silver', player: state.player, playerId: state.playerId });
        break;
      default:
        setState({ mode: 'idle' });
    }
  }, [state]);

  return {
    commandMode: state,
    openCommandPicker,
    selectCommand,
    selectPlayer,
    selectAmount,
    startReply,
    cancel,
    back,
  };
}
