import usePartySocket from "partysocket/react";
import { useGameStore } from "../store/useGameStore";

export const useGameEngine = (gameId: string, playerId: string) => {
  const sync = useGameStore((s) => s.sync);
  const addChatMessage = useGameStore((s) => s.addChatMessage);
  const addTickerMessage = useGameStore((s) => s.addTickerMessage);
  const setTickerMessages = useGameStore((s) => s.setTickerMessages);
  const setDebugTicker = useGameStore((s) => s.setDebugTicker);
  const setDmRejection = useGameStore((s) => s.setDmRejection);

  const socket = usePartySocket({
    host: new URL(import.meta.env.VITE_GAME_SERVER_HOST || "http://localhost:8787").host,
    room: gameId,
    party: 'game-server',
    query: {
      playerId,
    },
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
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    },
  });

  const sendMessage = (content: string, targetId?: string) => {
    socket.send(JSON.stringify({
      type: "SOCIAL.SEND_MSG",
      content,
      targetId
    }));
  };

  const sendDM = (targetId: string, content: string) => {
    socket.send(JSON.stringify({
      type: "SOCIAL.SEND_MSG",
      content,
      targetId
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

  return {
    socket,
    sendMessage,
    sendDM,
    sendSilver,
    sendVoteAction,
    sendGameAction
  };
};
