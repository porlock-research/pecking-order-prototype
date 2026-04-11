import { useState, createContext, useContext } from 'react';
import './pulse-theme.css';
import type { ShellProps } from '../types';
import type { GameEngine } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { AmbientBackground } from './components/AmbientBackground';
import { Ticker } from './components/Ticker';
import { PulseBar } from './components/PulseBar';
import { TabBar } from './components/TabBar';
import { ChatView } from './components/chat/ChatView';
import { CastGrid } from './components/cast/CastGrid';
import { PulseInput } from './components/input/PulseInput';
import { EliminationReveal } from './components/reveals/EliminationReveal';
import { WinnerReveal } from './components/reveals/WinnerReveal';
import { PhaseTransition } from './components/reveals/PhaseTransition';

// Context to provide engine + playerId to all Pulse children
export const PulseContext = createContext<{
  engine: GameEngine;
  playerId: string;
}>(null!);

export function usePulse() {
  return useContext(PulseContext);
}

export default function PulseShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'cast'>('chat');
  const phase = useGameStore(s => s.phase);

  return (
    <PulseContext.Provider value={{ engine, playerId }}>
      <div
        className="pulse-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AmbientBackground />
        <Ticker />
        <PulseBar />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          {activeTab === 'chat' ? <ChatView /> : <CastGrid />}
        </div>
        <PulseInput />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Overlays */}
        <EliminationReveal />
        <WinnerReveal />
        <PhaseTransition />
      </div>
    </PulseContext.Provider>
  );
}
