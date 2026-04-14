import { useState } from 'react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { getPlayerColor } from '../../colors';
import { PersonaImage, initialsOf } from '../common/PersonaImage';

interface Props {
  player: SocialPlayer;
  colorIdx: number;
  rank: number | null;
  isLeader: boolean;
  isOnline: boolean;
  onClose: () => void;
}

export function DmHero({ player, colorIdx, rank, isLeader, isOnline, onClose }: Props) {
  const color = getPlayerColor(colorIdx);
  const [variant, setVariant] = useState<'headshot' | 'medium' | 'full'>('headshot');

  // Pulse shell uses short bio as pseudo-stereotype (matches CastCard convention).
  const stereotype = player.bio && player.bio.length > 4 && player.bio.length <= 50 ? player.bio : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: 280, background: '#111', overflow: 'hidden' }}>
      <PersonaImage
        avatarUrl={player.avatarUrl}
        cacheKey={player.id}
        preferredVariant={variant}
        fallbackChain={['headshot', 'medium', 'full']}
        initials={initialsOf(player.personaName)}
        playerColor={color}
        alt={player.personaName}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <button onClick={onClose} aria-label="Close DM" style={{
        position: 'absolute', top: 10, left: 10,
        width: 38, height: 38, borderRadius: 19,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>‹</button>

      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6 }}>
        {(['headshot', 'medium', 'full'] as const).map(v => (
          <button key={v} onClick={() => setVariant(v)} aria-label={`Show ${v}`} style={{
            width: 8, height: 8, borderRadius: '50%',
            border: 'none', padding: 0, cursor: 'pointer',
            background: variant === v ? '#fff' : 'rgba(255,255,255,0.35)',
          }} />
        ))}
      </div>

      {isLeader && (
        <span style={{
          position: 'absolute', top: 14, left: 60,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(255,215,0,0.7)',
          border: '1.5px solid rgba(255,215,0,0.9)',
        }}>
          <svg width="16" height="12" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffd700" />
          </svg>
        </span>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 800, color, letterSpacing: -0.3,
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        }}>{player.personaName}</div>
        {stereotype && (
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
            color: 'rgba(255,255,255,0.75)', marginTop: 2,
          }}>{stereotype}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {isOnline && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(46,204,113,0.25)', color: '#2ecc71',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71' }} />
              Online
            </span>
          )}
          {rank !== null && (
            <span style={{
              background: isLeader ? 'rgba(255,215,0,0.2)' : 'rgba(255,59,111,0.2)',
              color: isLeader ? '#ffd700' : 'var(--pulse-accent)',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>#{rank} · {player.silver} silver</span>
          )}
        </div>
      </div>
    </div>
  );
}
