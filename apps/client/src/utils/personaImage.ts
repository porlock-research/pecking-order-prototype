const LOBBY_HOST = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

/**
 * Resolves a persona avatar URL (relative to lobby) into an absolute URL.
 * Returns null for empty/undefined input (triggers fallback in PersonaAvatar).
 */
export function resolveAvatarUrl(avatarUrl: string | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  return `${LOBBY_HOST}${avatarUrl}`;
}

/**
 * Derive a different image variant from a headshot URL.
 * headshot.png → medium.png | full.png
 */
export function resolvePersonaVariant(
  avatarUrl: string | undefined,
  variant: 'medium' | 'full',
): string | null {
  if (!avatarUrl) return null;
  const swapped = avatarUrl.replace(/headshot\.png$/, `${variant}.png`);
  return resolveAvatarUrl(swapped);
}
