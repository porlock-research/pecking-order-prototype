import type { useGameEngine } from '../hooks/useGameEngine';

export type GameEngine = ReturnType<typeof useGameEngine>;

export interface ShellProps {
  playerId: string;
  engine: GameEngine;
  token: string | null;
}

export type ShellComponent = React.ComponentType<ShellProps>;

export interface ShellManifest {
  id: string;
  name: string;
  load: () => Promise<{ default: ShellComponent }>;
}
