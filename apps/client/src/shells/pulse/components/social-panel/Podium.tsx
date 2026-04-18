import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';
import { Coins } from '../../icons';

// Olympic-podium lift — #1 pops above the line; #2 nudges slightly; #3 is
// the baseline. Reads as triumphal rather than "big image in the middle".
// Spec: .impeccable.md:108.
const LIFT: Record<1 | 2 | 3, number> = { 1: -10, 2: -2, 3: 0 };

interface SlotProps {
  entry: { id: string; player: { personaName: string; avatarUrl: string; silver: number } };
  rank: 1 | 2 | 3;
  onTap: (id: string) => void;
  colorIdx: number;
}

function Slot({ entry, rank, onTap, colorIdx }: SlotProps) {
  const color = getPlayerColor(colorIdx);
  const isFirst = rank === 1;
  return (
    <button
      onClick={() => onTap(entry.id)}
      style={{
        flex: isFirst ? 2 : 1,
        order: rank === 2 ? 1 : rank === 1 ? 2 : 3,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        transform: `translateY(${LIFT[rank]}px)`,
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: isFirst ? 150 : 84 }}>
        <img
          src={resolveAvatarUrl(entry.player.avatarUrl) || ''}
          alt=""
          loading="lazy"
          style={{
            width: '100%', height: isFirst ? 140 : 74,
            objectFit: 'cover', borderRadius: 10,
            border: isFirst ? '2px solid var(--pulse-gold)' : '1px solid var(--pulse-border)',
            boxShadow: isFirst ? '0 0 18px rgba(255,200,61,0.4)' : 'none',
          }}
        />
        {isFirst && (
          <span aria-hidden="true" style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,0.8)', border: '1.5px solid rgba(255,200,61,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="12" viewBox="0 0 14 10" aria-hidden>
              <path d="M1 9 L2 3 L5 6 L7 1 L9 6 L12 3 L13 9 Z" fill="#ffc83d" />
            </svg>
          </span>
        )}
      </div>
      <div style={{ fontSize: isFirst ? 15 : 12, fontWeight: 700, color, textAlign: 'center' }}>
        {entry.player.personaName.split(' ')[0]}
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: isFirst ? 13 : 11, color: 'var(--pulse-gold)', fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <Coins size={isFirst ? 13 : 11} weight="fill" />
        {entry.player.silver}
      </div>
    </button>
  );
}

export function Podium() {
  const standings = useGameStore(selectStandings);
  const top3 = standings.slice(0, 3);
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();

  if (top3.length === 0) return null;
  const rosterIds = Object.keys(roster);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '24px 16px 12px', justifyContent: 'center' }}>
      {top3[1] && (
        <Slot entry={top3[1]} rank={2} onTap={openDM} colorIdx={rosterIds.indexOf(top3[1].id)} />
      )}
      {top3[0] && (
        <Slot entry={top3[0]} rank={1} onTap={openDM} colorIdx={rosterIds.indexOf(top3[0].id)} />
      )}
      {top3[2] && (
        <Slot entry={top3[2]} rank={3} onTap={openDM} colorIdx={rosterIds.indexOf(top3[2].id)} />
      )}
    </div>
  );
}
