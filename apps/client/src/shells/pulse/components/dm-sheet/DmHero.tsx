import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { getPlayerColor } from '../../colors';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { DmStatusRing } from './DmStatusRing';
import { useGameStore, selectCanAddMemberTo, selectHaveINudged } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { HandWaving, UserPlus } from '../../icons';

interface Props {
  player: SocialPlayer;
  colorIdx: number;
  rank: number | null;
  isLeader: boolean;
  isOnline: boolean;
  channelId: string | null;
  onClose: () => void;
}

export function DmHero({ player, colorIdx, rank, isLeader, isOnline, channelId, onClose }: Props) {
  const color = getPlayerColor(colorIdx);
  const [variant, setVariant] = useState<'headshot' | 'medium' | 'full'>('headshot');
  const [waveToken, setWaveToken] = useState(0);
  const canAdd = useGameStore(s => channelId ? selectCanAddMemberTo(s, channelId) : false);
  const startAddMember = useGameStore(s => s.startAddMember);
  const alreadyNudged = useGameStore(s => selectHaveINudged(s, player.id));
  const { openNudge } = usePulse();
  const reduce = useReducedMotion();

  // Pulse shell uses short bio as pseudo-stereotype (matches CastCard convention).
  const stereotype = player.bio && player.bio.length > 4 && player.bio.length <= 50 ? player.bio : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: 'var(--pulse-hero-height)', background: 'var(--pulse-bg)', overflow: 'hidden' }}>
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
        position: 'absolute', top: 'var(--pulse-space-md)', left: 'var(--pulse-space-md)',
        width: 44, height: 44, borderRadius: 22,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'var(--pulse-on-accent)', fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>‹</button>

      <div style={{ position: 'absolute', top: 'var(--pulse-space-md)', right: 'var(--pulse-space-md)', display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-sm)' }}>
        <button
          onClick={() => {
            if (alreadyNudged) return;
            setWaveToken(t => t + 1);
            openNudge(player.id);
          }}
          disabled={alreadyNudged}
          aria-label={alreadyNudged ? `Already nudged ${player.personaName} today` : `Nudge ${player.personaName}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-xs)',
            padding: 'var(--pulse-space-sm) var(--pulse-space-md)', borderRadius: 14,
            background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: alreadyNudged ? 'rgba(255,255,255,0.5)' : 'var(--pulse-on-accent)',
            cursor: alreadyNudged ? 'not-allowed' : 'pointer',
            opacity: alreadyNudged ? 0.7 : 1,
            fontSize: 12, fontWeight: 700,
          }}
        >
          <motion.span
            key={waveToken}
            initial={{ rotate: 0 }}
            animate={reduce || waveToken === 0 ? { rotate: 0 } : { rotate: [0, -22, 18, -14, 10, 0] }}
            transition={reduce ? {} : { duration: 0.55, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', transformOrigin: '70% 80%' }}
          >
            <HandWaving size={16} weight="fill" color={alreadyNudged ? 'rgba(255,160,77,0.5)' : 'var(--pulse-nudge)'} />
          </motion.span>
          <span>{alreadyNudged ? 'Nudged' : 'Nudge'}</span>
        </button>
        {canAdd && channelId && (
          <button
            onClick={() => startAddMember(channelId)}
            aria-label="Add members"
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-xs)',
              padding: 'var(--pulse-space-sm) var(--pulse-space-md)', borderRadius: 14,
              background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--pulse-on-accent)', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            <UserPlus weight="bold" size={16} />
            <span>Add</span>
          </button>
        )}
        <div role="group" aria-label="Photo variant" style={{ display: 'flex', gap: 'var(--pulse-space-sm)', alignItems: 'center', padding: '0 var(--pulse-space-xs)' }}>
          {(['headshot', 'medium', 'full'] as const).map(v => (
            <button key={v} onClick={() => setVariant(v)} aria-label={`Show ${v} photo`} aria-pressed={variant === v} style={{
              width: 24, height: 24, borderRadius: '50%',
              border: 'none', padding: 0, cursor: 'pointer',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span aria-hidden="true" style={{
                width: 8, height: 8, borderRadius: '50%',
                background: variant === v ? 'var(--pulse-on-accent)' : 'rgba(255,255,255,0.35)',
              }} />
            </button>
          ))}
        </div>
      </div>

      {isLeader && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 14, left: 60,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(255,200,61,0.7)',
          border: '1.5px solid rgba(255,200,61,0.9)',
        }}>
          <svg width="16" height="12" viewBox="0 0 14 10" aria-hidden>
            <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffc83d" />
          </svg>
        </span>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        display: 'flex', alignItems: 'flex-end', gap: 12,
      }}>
        <DmStatusRing partnerId={player.id} channelId={channelId} color={color} size={52}>
          <PersonaImage
            avatarUrl={player.avatarUrl}
            cacheKey={`${player.id}:ring`}
            preferredVariant="headshot"
            fallbackChain={['headshot']}
            initials={initialsOf(player.personaName)}
            playerColor={color}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </DmStatusRing>
        <div style={{ flex: 1, minWidth: 0 }}>
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
              background: 'rgba(46,204,113,0.25)', color: 'var(--pulse-online)',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pulse-online)' }} />
              Online
            </span>
          )}
          {rank !== null && (
            <span style={{
              background: isLeader ? 'rgba(255,200,61,0.2)' : 'rgba(255,59,111,0.2)',
              color: isLeader ? 'var(--pulse-gold)' : 'var(--pulse-accent)',
              padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            }}>#{rank} · {player.silver} silver</span>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
