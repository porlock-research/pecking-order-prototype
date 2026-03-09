// apps/client/src/shells/vivid/colors.ts

const PLAYER_COLORS = [
  '#FF6B6B', // coral red
  '#4ECDC4', // teal
  '#FFD93D', // gold
  '#A78BFA', // lavender
  '#F472B6', // pink
  '#34D399', // emerald
  '#FB923C', // orange
  '#60A5FA', // sky blue
  '#E879F9', // fuchsia
  '#FBBF24', // amber
] as const;

export function getPlayerColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
}

export function buildPlayerColorMap(playerIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  playerIds.forEach((id, i) => {
    map[id] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });
  return map;
}
