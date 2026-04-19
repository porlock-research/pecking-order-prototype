import { motion, useReducedMotion } from 'framer-motion';
import { SocialPlayer, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingShell } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VOTE_ACCENT } from './shared/voting-tokens';
import { PULSE_SPRING } from '../../shells/pulse/springs';

interface SecondToLastVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function SecondToLastVoting({
  cartridge,
  playerId,
  roster,
}: SecondToLastVotingProps) {
  const { results, silverRanking } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
  const reduce = useReducedMotion();

  const ranking: Array<{ id: string; silver: number }> =
    results?.summary?.silverRanking ?? silverRanking ?? [];
  const eliminatedId: string | null = results?.eliminatedId ?? null;

  if (ranking.length === 0) {
    return (
      <VotingShell
        accentColor={accent}
        header={
          <VotingHeader
            mechanismName={info.name}
            moodSubtitle={info.moodSubtitle}
            cta="Counting the silver\u2026"
            howItWorks={info.howItWorks}
            accentColor={accent}
          />
        }
      >
        <CountingPlaceholder reduce={reduce} />
      </VotingShell>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
      <SilverLadder
        ranking={ranking}
        roster={roster}
        accent={accent}
        eliminatedId={eliminatedId}
        selfId={playerId}
        reduce={reduce}
        mechanismName={info.name}
        moodSubtitle={info.moodSubtitle}
        revealLabel={info.revealLabel}
        eliminatedSubtitle={info.eliminatedSubtitle}
      />
    </div>
  );
}

function SilverLadder({
  ranking,
  roster,
  accent,
  eliminatedId,
  selfId,
  reduce,
  mechanismName,
  moodSubtitle,
  revealLabel,
  eliminatedSubtitle,
}: {
  ranking: Array<{ id: string; silver: number }>;
  roster: Record<string, SocialPlayer>;
  accent: string;
  eliminatedId: string | null;
  selfId: string;
  reduce: boolean | null;
  mechanismName: string;
  moodSubtitle: string;
  revealLabel: string;
  eliminatedSubtitle: string;
}) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.25 } : { type: 'spring', ...PULSE_SPRING.page }}
      style={{
        padding: '16px 14px 18px',
        borderRadius: 18,
        background: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklch, var(--po-text) 6%, transparent) 0%, transparent 70%), var(--po-bg-panel, rgba(0,0,0,0.25))`,
        border: '1px solid color-mix(in oklch, var(--po-text) 12%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.28em',
            color: 'var(--po-text-dim)',
            textTransform: 'uppercase',
          }}
        >
          {mechanismName}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--po-text-dim)',
            letterSpacing: 0.1,
          }}
        >
          {moodSubtitle}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {ranking.map((entry, i) => {
          const player = roster[entry.id];
          const isEliminated = entry.id === eliminatedId;
          const isSelf = entry.id === selfId;
          const firstName = player?.personaName?.split(' ')[0] ?? entry.id;

          return (
            <motion.div
              key={entry.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : 0.08 * i }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 12,
                background: isEliminated
                  ? `linear-gradient(90deg, color-mix(in oklch, var(--po-pink) 14%, transparent) 0%, transparent 100%)`
                  : 'transparent',
                border: isEliminated
                  ? '1px solid color-mix(in oklch, var(--po-pink) 35%, transparent)'
                  : '1px solid transparent',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--po-text-dim)',
                  width: 22,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                #{i + 1}
              </span>
              <div
                style={{
                  borderRadius: '50%',
                  padding: isEliminated ? 1.5 : 0,
                  background: isEliminated
                    ? `conic-gradient(from 180deg, var(--po-pink), color-mix(in oklch, var(--po-pink) 35%, transparent), var(--po-pink))`
                    : 'transparent',
                  filter: isEliminated ? 'grayscale(40%) saturate(0.8)' : undefined,
                  opacity: isEliminated ? 0.7 : 1,
                  boxShadow: isEliminated
                    ? '0 0 16px color-mix(in oklch, var(--po-pink) 30%, transparent)'
                    : undefined,
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={32}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--po-font-body)',
                    fontSize: 13,
                    fontWeight: isSelf ? 700 : 600,
                    color: isEliminated ? 'var(--po-pink)' : 'var(--po-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {firstName}
                </span>
                {isEliminated && (
                  <span
                    style={{
                      fontFamily: 'var(--po-font-display)',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                      color: 'var(--po-pink)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {revealLabel} \u00b7 {eliminatedSubtitle}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: isEliminated ? 'var(--po-pink)' : 'var(--po-text-dim)',
                  letterSpacing: '0.02em',
                }}
              >
                {entry.silver}
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  silver
                </span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function CountingPlaceholder({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      animate={reduce ? undefined : { opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '20px 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.26em',
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
        }}
      >
        Tallying
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          color: 'var(--po-text-dim)',
        }}
      >
        Reading the silver ledger…
      </span>
    </motion.div>
  );
}
