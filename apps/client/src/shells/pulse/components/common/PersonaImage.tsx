import { useEffect, useState } from 'react';
import { resolveAvatarUrl, resolvePersonaVariant } from '../../../../utils/personaImage';

export type PersonaVariant = 'headshot' | 'medium' | 'full';
type VariantOrFallback = PersonaVariant | 'initials';

interface PersonaImageProps {
  /** The player's stored avatar URL (expected to end in `headshot.png`). */
  avatarUrl: string | undefined;
  /** Stable identifier for cache keying (personaId / playerId). */
  cacheKey: string;
  /** The variant to try first. May change at runtime (e.g., hero variant picker). */
  preferredVariant: PersonaVariant;
  /** Variants to try on 404, in order. `'initials'` is implicit as the terminal fallback. */
  fallbackChain?: PersonaVariant[];
  /** Initials to render in the terminal fallback tile. */
  initials: string;
  /** Color for the initials tile background. */
  playerColor: string;
  style?: React.CSSProperties;
  alt?: string;
}

// Module-level cache of known-good variants. Avoids re-flicker on second mount.
const knownGoodVariant = new Map<string, PersonaVariant>();

function variantSrc(avatarUrl: string | undefined, variant: PersonaVariant): string | null {
  if (!avatarUrl) return null;
  if (variant === 'headshot') return resolveAvatarUrl(avatarUrl);
  return resolvePersonaVariant(avatarUrl, variant);
}

function buildChain(preferred: PersonaVariant, fallbackChain: PersonaVariant[], cached?: PersonaVariant): VariantOrFallback[] {
  const head = cached ?? preferred;
  const rest: PersonaVariant[] = [];
  for (const v of [preferred, ...fallbackChain]) {
    if (v !== head && !rest.includes(v)) rest.push(v);
  }
  return [head, ...rest, 'initials'];
}

export function PersonaImage({
  avatarUrl,
  cacheKey,
  preferredVariant,
  fallbackChain = ['headshot'],
  initials,
  playerColor,
  style,
  alt,
}: PersonaImageProps) {
  const cached = knownGoodVariant.get(cacheKey);
  const [chain, setChain] = useState<VariantOrFallback[]>(() => buildChain(preferredVariant, fallbackChain, cached));
  const [index, setIndex] = useState(0);

  // Reset the chain when the target persona or the caller's preferred variant changes.
  useEffect(() => {
    setChain(buildChain(preferredVariant, fallbackChain, knownGoodVariant.get(cacheKey)));
    setIndex(0);
  }, [cacheKey, preferredVariant, fallbackChain.join('|')]);

  const current = chain[index];

  if (current === 'initials' || !avatarUrl) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: playerColor, color: '#fff', fontWeight: 700, fontSize: 32,
          ...style,
        }}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  const src = variantSrc(avatarUrl, current);
  if (!src) {
    // Should not happen if avatarUrl is defined, but guard anyway.
    setIndex(i => i + 1);
    return null;
  }

  return (
    <img
      src={src}
      alt={alt ?? ''}
      style={style}
      onLoad={() => knownGoodVariant.set(cacheKey, current)}
      onError={() => setIndex(i => Math.min(i + 1, chain.length - 1))}
    />
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export { initialsOf };
