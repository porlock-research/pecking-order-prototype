import { useRef, useCallback } from "react";
import usePartySocket from "partysocket/react";
import { useGameStore } from "../store/useGameStore";
import { dmChannelId } from "@pecking-order/shared-types";

export const useGameEngine = (gameId: string, playerId: string, token?: string | null) => {
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

  const socket = usePartySocket({
    host: new URL(import.meta.env.VITE_GAME_SERVER_HOST || "http://localhost:8787").host,
    room: gameId,
    party: 'game-server',
    query,
    onMessage(event) {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "SYSTEM.SYNC") {
          sync(data);
        } else if (data.type === "SOCIAL.MSG_RECEIVED") {
          addChatMessage(data.payload);
        } else if (data.type === "TICKER.UPDATE") {
          addTickerMessage(data.message);
        } else if (data.type === "TICKER.HISTORY") {
          setTickerMessages(data.messages);
        } else if (data.type === "TICKER.DEBUG") {
          setDebugTicker(data.summary);
        } else if (data.type === "DM.REJECTED") {
          setDmRejection(data.reason);
        } else if (data.type === "SILVER_TRANSFER.REJECTED") {
          setSilverTransferRejection(data.reason);
        } else if (data.type === "PERK.RESULT" || data.type === "PERK.REJECTED") {
          setPerkResult(data);
        } else if (data.type === "PRESENCE.UPDATE") {
          setOnlinePlayers(data.onlinePlayers);
        } else if (data.type === "CHANNEL.REJECTED") {
          setDmRejection(data.reason);
        } else if (data.type === "PRESENCE.TYPING") {
          setTyping(data.playerId, data.channel);
        } else if (data.type === "PRESENCE.STOP_TYPING") {
          clearTyping(data.playerId);
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    },
  });

  const sendMessage = (content: string, targetId?: string) => {
    const channelId = targetId ? dmChannelId(playerId, targetId) : 'MAIN';
    socket.send(JSON.stringify({
      type: "SOCIAL.SEND_MSG",
      content,
      channelId,
      targetId,  // kept for backward compat
    }));
  };

  const sendDM = (targetId: string, content: string) => {
    const channelId = dmChannelId(playerId, targetId);
    socket.send(JSON.stringify({
      type: "SOCIAL.SEND_MSG",
      content,
      channelId,
      targetId,  // kept for backward compat
    }));
  };

  const sendSilver = (amount: number, targetId: string) => {
    socket.send(JSON.stringify({
      type: "SOCIAL.SEND_SILVER",
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
      type: "SOCIAL.SEND_MSG",
      content,
      channelId,
    }));
  };

  const createGroupDm = (memberIds: string[]) => {
    socket.send(JSON.stringify({ type: 'SOCIAL.CREATE_CHANNEL', memberIds }));
  };

  const sendPerk = (perkType: string, targetId?: string) => {
    socket.send(JSON.stringify({ type: 'SOCIAL.USE_PERK', perkType, targetId }));
  };

  // Typing indicators with auto-stop after 3s of no keystrokes
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sendTyping = useCallback((channel: string = 'MAIN') => {
    socket.send(JSON.stringify({ type: 'PRESENCE.TYPING', channel }));
    if (typingTimeoutRef.current[channel]) clearTimeout(typingTimeoutRef.current[channel]);
    typingTimeoutRef.current[channel] = setTimeout(() => {
      socket.send(JSON.stringify({ type: 'PRESENCE.STOP_TYPING', channel }));
      delete typingTimeoutRef.current[channel];
    }, 3000);
  }, [socket]);

  const stopTyping = useCallback((channel: string = 'MAIN') => {
    socket.send(JSON.stringify({ type: 'PRESENCE.STOP_TYPING', channel }));
    if (typingTimeoutRef.current[channel]) {
      clearTimeout(typingTimeoutRef.current[channel]);
      delete typingTimeoutRef.current[channel];
    }
  }, [socket]);

  return {
    socket,
    sendMessage,
    sendDM,
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
