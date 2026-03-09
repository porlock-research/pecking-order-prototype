// apps/client/src/shells/vivid/colors.ts

const PLAYER_COLORS = [
  '#D4654B', // terracotta
  '#3BA99C', // warm teal
  '#D4960A', // honeycomb gold
  '#8B6CC1', // wisteria
  '#D94073', // raspberry
  '#6B9E6E', // sage green
  '#E89B3A', // warm amber
  '#5B8DAF', // dusty blue
  '#C4713B', // burnt sienna
  '#9B7BB5', // soft plum
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
