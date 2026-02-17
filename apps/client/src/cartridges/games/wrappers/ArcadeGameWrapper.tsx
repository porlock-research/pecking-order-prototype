import React, { useState, useEffect, type ReactNode } from 'react';
import type { ArcadeGameProjection, ArcadeRendererProps, SocialPlayer } from '@pecking-order/shared-types';
import {
  CountdownBar,
  CartridgeContainer,
  CartridgeHeader,
  CelebrationSequence,
} from '../shared';

interface ArcadeGameWrapperProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  title: string;
  description: string;
  Renderer: React.ComponentType<ArcadeRendererProps>;
  renderBreakdown?: (result: Record<string, number>, silverReward: number) => ReactNode;
}

export default function ArcadeGameWrapper({
  cartridge,
  engine,
  onDismiss,
  title,
  description,
  Renderer,
  renderBreakdown,
}: ArcadeGameWrapperProps) {
  const { status, silverReward, goldContribution, seed, timeLimit, difficulty, gameType } = cartridge;

  const [gamePhase, setGamePhase] = useState<'NOT_STARTED' | 'PLAYING' | 'DEAD' | 'COMPLETED'>(
    status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED'
  );
  const [gameDeadline, setGameDeadline] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<Record<string, number>>(
    cartridge.result || {}
  );

  const handleStart = () => {
    engine.sendGameAction(`GAME.${gameType}.START`);
    setGamePhase('PLAYING');
    setGameDeadline(Date.now() + timeLimit);
  };

  const handleResult = (result: Record<string, number>) => {
    setFinalResult(result);
    setGamePhase('DEAD');
    engine.sendGameAction(`GAME.${gameType}.RESULT`, result);
  };

  // Transition from DEAD -> COMPLETED when server confirms
  useEffect(() => {
    if (status === 'COMPLETED' && gamePhase === 'DEAD') {
      const timer = setTimeout(() => setGamePhase('COMPLETED'), 1200);
      return () => clearTimeout(timer);
    }
    if (status === 'COMPLETED' && gamePhase === 'NOT_STARTED') {
      setGamePhase('COMPLETED');
    }
  }, [status, gamePhase]);

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label={title}
        score={gamePhase === 'COMPLETED' ? silverReward : undefined}
        showScore={gamePhase === 'COMPLETED'}
      />

      {gamePhase === 'PLAYING' && gameDeadline && (
        <div className="px-4 pt-2">
          <CountdownBar deadline={gameDeadline} totalMs={timeLimit} />
        </div>
      )}

      {/* NOT_STARTED: Start Screen */}
      {gamePhase === 'NOT_STARTED' && (
        <div className="p-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-skin-base">{title}</p>
            <p className="text-xs text-skin-dim leading-relaxed">{description}</p>
          </div>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
          >
            Start
          </button>
        </div>
      )}

      {/* PLAYING: Renderer */}
      {gamePhase === 'PLAYING' && (
        <Renderer
          seed={seed}
          difficulty={difficulty}
          timeLimit={timeLimit}
          onResult={handleResult}
        />
      )}

      {/* DEAD: Brief game-over overlay */}
      {gamePhase === 'DEAD' && (
        <div className="p-6 text-center space-y-3 animate-fade-in">
          <p className="text-sm font-mono text-skin-dim animate-pulse">Calculating score...</p>
        </div>
      )}

      {/* COMPLETED: Celebration */}
      {gamePhase === 'COMPLETED' && (
        <CelebrationSequence
          title={`${title} Complete`}
          silverEarned={silverReward}
          goldContribution={goldContribution}
          onDismiss={onDismiss}
          breakdown={renderBreakdown?.(finalResult, silverReward)}
        />
      )}
    </CartridgeContainer>
  );
}
