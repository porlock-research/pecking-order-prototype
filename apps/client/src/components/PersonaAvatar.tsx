import { useState } from 'react';
import { motion } from 'framer-motion';
import { Skull } from 'lucide-react';
import { resolveAvatarUrl } from '../utils/personaImage';

interface PersonaAvatarProps {
  avatarUrl?: string;
  personaName?: string;
  /** Pixel size of the avatar circle */
  size: number;
  /** Show grayscale with skull overlay */
  eliminated?: boolean;
  /** Framer Motion layoutId for shared-element transitions */
  layoutId?: string;
  /** Additional CSS classes on the outer container */
  className?: string;
  /** Text color class for the fallback letter */
  fallbackColor?: string;
  /** Online status — true shows gold ring, false shows subtle ring, undefined shows no ring */
  isOnline?: boolean;
}

function getFallbackTextSize(size: number): string {
  if (size <= 24) return 'text-[10px]';
  if (size <= 32) return 'text-xs';
  if (size <= 36) return 'text-sm';
  if (size <= 48) return 'text-base';
  if (size <= 56) return 'text-xl';
  if (size <= 72) return 'text-2xl';
  return 'text-3xl';
}

function getSkullSize(size: number): number {
  if (size <= 32) return 10;
  if (size <= 48) return 14;
  if (size <= 64) return 18;
  return 22;
}

export function PersonaAvatar({
  avatarUrl,
  personaName,
  size,
  eliminated = false,
  layoutId,
  className = '',
  fallbackColor = 'text-skin-gold',
  isOnline,
}: PersonaAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const src = resolveAvatarUrl(avatarUrl);
  const showImage = src && !imgError;
  const initial = personaName?.charAt(0)?.toUpperCase() || '?';

  const containerStyle = { width: size, height: size, minWidth: size, minHeight: size };

  const onlineRing = isOnline === true
    ? 'ring-2 ring-skin-gold/70 shadow-[0_0_6px_rgba(251,191,36,0.3)]'
    : isOnline === false
      ? 'ring-1 ring-white/[0.06]'
      : '';

  const circle = (
    <div
      className={`rounded-full overflow-hidden bg-skin-panel relative flex items-center justify-center ${eliminated ? 'grayscale' : ''} ${onlineRing} ${className}`}
      style={containerStyle}
    >
      {showImage ? (
        <>
          <img
            src={src}
            alt={personaName || ''}
            className={`w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
          />
          {!imgLoaded && (
            <span className={`absolute ${getFallbackTextSize(size)} font-bold font-mono ${fallbackColor}`}>
              {initial}
            </span>
          )}
        </>
      ) : (
        <span className={`${getFallbackTextSize(size)} font-bold font-mono ${fallbackColor}`}>
          {initial}
        </span>
      )}
      {eliminated && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
          <Skull size={getSkullSize(size)} className="text-skin-danger" />
        </div>
      )}
    </div>
  );

  if (layoutId) {
    return (
      <motion.div layoutId={layoutId} style={containerStyle} className="shrink-0">
        {circle}
      </motion.div>
    );
  }

  return <div className="shrink-0" style={containerStyle}>{circle}</div>;
}
