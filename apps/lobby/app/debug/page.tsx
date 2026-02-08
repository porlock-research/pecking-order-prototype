'use client';

import { startGameStub } from "../actions";
import { useState } from "react";

export default function DebugPage() {
  const [status, setStatus] = useState<string>("Idle");
  const [gameId, setGameId] = useState<string | null>(null);

  async function handleStart() {
    setStatus("Sending Handoff...");
    setGameId(null);
    const result = await startGameStub();
    if (result.success) {
      setStatus(`Success! Game Created: ${result.gameId}`);
      setGameId(result.gameId);
    } else {
      setStatus(`Error: ${result.error}`);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Lobby Debugger</h1>
      
      <div className="border p-6 rounded-lg bg-white shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-2">Create Test Game</h2>
        <p className="mb-4 text-gray-600">
          Starts a new game instance on the server with a random ID and 8 bot players.
          The timeline will run fast (20s day).
        </p>
        <button 
          onClick={handleStart}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          Start New Game
        </button>
      </div>

      <div className="border p-6 rounded-lg bg-gray-50 shadow-inner">
        <h3 className="font-semibold text-gray-700 mb-2">Status Log</h3>
        <pre className="p-3 bg-gray-900 text-green-400 rounded text-sm overflow-x-auto">
          {status}
        </pre>

        {gameId && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="font-bold text-green-800 mb-2">Game Ready!</p>
            <p className="mb-2">Join as Player 1:</p>
            <a 
              href={`http://localhost:5173/?gameId=${gameId}&playerId=p1`}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 underline"
            >
              Open Client (Player 1)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
