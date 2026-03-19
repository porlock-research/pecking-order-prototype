import { useRef, useCallback } from "react";
import usePartySocket from "partysocket/react";
import * as Sentry from "@sentry/react";
import { useGameStore } from "../store/useGameStore";
import { Events } from "@pecking-order/shared-types";

export const useGameEngine = (gameId: string, playerId: string, token?: string | null, party: string = 'game-server') => {
  const sync = useGameStore((s) => s.sync);
  const addChatMessage = useGameStore((s) => s.addChatMessage);
  const addTickerMessage = useGameStore((s) => s.addTickerMessage);
  const setTickerMessages = useGameStore((s) => s.setTickerMessages);
  const setDebugTicker = useGameStore((s) => s.setDebugTicker);
  const setDmRejection = useGameStore((s) => s.setDmRejection);
  const setSilverTransferRejection = useGameStore((s) => s.setSilverTransferRejection);
  const setPerkResult = useGameStore((s) => s.setPerkResult);
  const setOnlinePlayers = useGameStore((s) => s.setOnlinePlayers);
  const setTyping = useGameStore((s) => s.setTyping);
  const clearTyping = useGameStore((s) => s.clearTyping);

  // Use token-based auth when available, fall back to plain playerId for debug
  const query = token ? { token } : { playerId };
  if (!token) {
    console.warn('[WS] Connecting without token — using playerId fallback (debug mode)');
  }

  const socket = usePartySocket({
    host: new URL(import.meta.env.VITE_GAME_SERVER_HOST || "http://localhost:8787").host,
    room: gameId,
    party,
    query,
    onOpen() {
      console.log('[WS] Connected to game', gameId, 'as', playerId);
    },
    onClose(event) {
      console.warn('[WS] Connection closed', { code: event.code, reason: event.reason, gameId });
      if (event.code === 4001 || event.code === 4003) {
        Sentry.addBreadcrumb({
          category: 'websocket',
          message: `Connection rejected (code ${event.code})`,
          level: 'warning',
          data: { code: event.code, reason: event.reason, gameId },
        });
        // Clear ALL cached tokens for this game to prevent reconnect loop
        // (covers secret rotation, game cleanup, token expiry)
        const code = window.location.pathname.match(/\/game\/([A-Za-z0-9]+)/)?.[1];
        if (code) {
          localStorage.removeItem(`po_token_${code}`);
          document.cookie = `po_token_${code}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          caches.open('po-tokens-v1').then(c =>
            c.delete(new Request(`/po-token-cache/po_token_${code}`))
          ).catch(() => {});
        }
        window.location.replace('/');
      }
    },
    onError(event) {
      console.error('[WS] Connection error', { gameId });
      Sentry.addBreadcrumb({
        category: 'websocket',
        message: 'Connection error',
        level: 'error',
        data: { gameId },
      });
    },
    onMessage(event) {
      try {
        const data = JSON.parse(event.data);

        if (data.type === Events.System.SYNC) {
          sync(data);
        } else if (data.type === "SOCIAL.MSG_RECEIVED") {
          addChatMessage(data.payload);
        } else if (data.type === Events.Ticker.UPDATE) {
          addTickerMessage(data.message);
        } else if (data.type === Events.Ticker.HISTORY) {
          setTickerMessages(data.messages);
        } else if (data.type === Events.Ticker.DEBUG) {
          setDebugTicker(data.summary);
        } else if (data.type === Events.Rejection.DM) {
          setDmRejection(data.reason);
        } else if (data.type === Events.Rejection.SILVER_TRANSFER) {
          setSilverTransferRejection(data.reason);
        } else if (data.type === Events.Perk.RESULT || data.type === Events.Rejection.PERK) {
          setPerkResult(data);
        } else if (data.type === Events.Presence.UPDATE) {
          setOnlinePlayers(data.onlinePlayers);
        } else if (data.type === Events.Rejection.CHANNEL) {
          setDmRejection(data.reason);
        } else if (data.type === Events.Presence.TYPING) {
          setTyping(data.playerId, data.channel);
        } else if (data.type === Events.Presence.STOP_TYPING) {
          clearTyping(data.playerId);
        } else {
          console.warn('[WS] Unhandled message type:', data.type, data);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err, event.data?.substring?.(0, 200));
      }
    },
  });

  const sendMessage = (content: string) => {
    socket.send(JSON.stringify({
      type: Events.Social.SEND_MSG,
      content,
      channelId: 'MAIN',
    }));
  };

  const sendFirstMessage = (recipientIds: string[], content: string) => {
    socket.send(JSON.stringify({
      type: Events.Social.SEND_MSG,
      content,
      recipientIds,
    }));
  };

  const addMember = (channelId: string, memberIds: string[], message?: string) => {
    socket.send(JSON.stringify({
      type: Events.Social.ADD_MEMBER,
      channelId,
      memberIds,
      ...(message ? { message } : {}),
    }));
  };

  const sendSilver = (amount: number, targetId: string) => {
    socket.send(JSON.stringify({
      type: Events.Social.SEND_SILVER,
      amount,
      targetId
    }));
  };

  const sendVoteAction = (type: string, targetId: string) => {
    socket.send(JSON.stringify({ type, targetId }));
  };

  const sendGameAction = (type: string, payload?: Record<string, any>) => {
    socket.send(JSON.stringify({ type, ...payload }));
  };

  const sendActivityAction = (type: string, payload?: Record<string, any>) => {
    socket.send(JSON.stringify({ type, ...payload }));
  };

  const sendToChannel = (channelId: string, content: string) => {
    socket.send(JSON.stringify({
      type: Events.Social.SEND_MSG,
      content,
      channelId,
    }));
  };

  const createGroupDm = (memberIds: string[]) => {
    socket.send(JSON.stringify({ type: Events.Social.CREATE_CHANNEL, memberIds }));
  };

  const sendPerk = (perkType: string, targetId?: string) => {
    socket.send(JSON.stringify({ type: Events.Social.USE_PERK, perkType, targetId }));
  };

  // Typing indicators with auto-stop after 3s of no keystrokes
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sendTyping = useCallback((channel: string = 'MAIN') => {
    socket.send(JSON.stringify({ type: Events.Presence.TYPING, channel }));
    if (typingTimeoutRef.current[channel]) clearTimeout(typingTimeoutRef.current[channel]);
    typingTimeoutRef.current[channel] = setTimeout(() => {
      socket.send(JSON.stringify({ type: Events.Presence.STOP_TYPING, channel }));
      delete typingTimeoutRef.current[channel];
    }, 3000);
  }, [socket]);

  const stopTyping = useCallback((channel: string = 'MAIN') => {
    socket.send(JSON.stringify({ type: Events.Presence.STOP_TYPING, channel }));
    if (typingTimeoutRef.current[channel]) {
      clearTimeout(typingTimeoutRef.current[channel]);
      delete typingTimeoutRef.current[channel];
    }
  }, [socket]);

  return {
    socket,
    sendMessage,
    sendFirstMessage,
    addMember,
    sendSilver,
    sendToChannel,
    createGroupDm,
    sendVoteAction,
    sendGameAction,
    sendActivityAction,
    sendPerk,
    sendTyping,
    stopTyping,
  };
};
