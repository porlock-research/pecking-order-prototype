'use client';

import { startGameStub } from "../actions";
import { useState } from "react";

export default function DebugPage() {
  const [status, setStatus] = useState<string>("Idle");

  async function handleStart() {
    setStatus("Sending Handoff...");
    const result = await startGameStub();
    if (result.success) {
      setStatus(`Success! Room: ${result.data.room}`);
    } else {
      setStatus(`Error: ${result.error}`);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Lobby Debugger</h1>
      <div className="border p-4 rounded bg-gray-50">
        <p className="mb-4">Test the Game Server Handoff (Lobby -&gt; L1)</p>
        <button 
          onClick={handleStart}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Start Game Stub
        </button>
        <pre className="mt-4 p-2 bg-gray-200 rounded">{status}</pre>
      </div>
    </div>
  );
}
