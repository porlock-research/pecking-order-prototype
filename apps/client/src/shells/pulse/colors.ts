export const PLAYER_COLORS = [
  '#e8a87c', '#7ec8a0', '#e85d75', '#8b9dc3', '#b19cd9',
  '#e0a060', '#6ec6c8', '#c97ab5', '#a0c878', '#d4a76a',
] as const;

export function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
