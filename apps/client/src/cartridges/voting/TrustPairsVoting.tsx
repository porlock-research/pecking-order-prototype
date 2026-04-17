import { motion, useReducedMotion } from 'framer-motion';
import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT, VOTE_ACCENT_SECONDARY } from './shared/voting-tokens';

interface TrustPairsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function TrustPairsVoting({
  cartridge,
  playerId,
  roster,
  engine,
}: TrustPairsVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    results,
    trustPicks,
    votePicks,
    mutualPairs,
    immunePlayerIds,
  } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const trustAccent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];
  const betrayAccent = VOTE_ACCENT_SECONDARY[cartridge.voteType as keyof typeof VOTE_ACCENT_SECONDARY] ?? trustAccent;
  const canVote = eligibleVoters.includes(playerId);
  const myTrust = trustPicks?.[playerId] ?? null;
  const myEliminate = votePicks?.[playerId] ?? null;

  // REVEAL
  if (phase === VotingPhases.REVEAL) {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? {};
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const pairs: string[][] = results?.summary?.mutualPairs ?? mutualPairs ?? [];
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];
    const eliminatedPlayer = eliminatedId ? roster[eliminatedId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        {pairs.length > 0 && (
          <MutualPairsHero pairs={pairs} roster={roster} accent={trustAccent} />
        )}
        <VotingResultHero
          subjectPlayer={eliminatedPlayer}
          accent={betrayAccent}
          tone={info.mechanismTone}
          haloVariant="fade"
          subtitle={eliminatedId ? info.eliminatedSubtitle : info.noEliminationCopy}
          label={eliminatedId ? 'Betrayed' : undefined}
        />
        {Object.keys(revealTallies).length > 0 && (
          <VotingTallyGrid
            tallies={revealTallies}
            roster={roster}
            accent={betrayAccent}
            eliminatedId={eliminatedId}
            immuneIds={immune}
            unitLabel="votes"
          />
        )}
      </div>
    );
  }

  // VOTING — sequential beats
  // Beat 1: Trust picker (green accent). Beat 2: Betray picker (pink accent),
  // with the trust-target excluded so you can't pick the same person twice.
  const inTrustBeat = !myTrust;
  const inBetrayBeat = !!myTrust && !myEliminate;
  const allDone = !!myTrust && !!myEliminate;

  // Combined "voted" state for VoterStrip — a voter has "voted" only if BOTH picks done
  const combinedVotes: Record<string, string> = {};
  for (const voterId of eligibleVoters) {
    if (trustPicks?.[voterId] && votePicks?.[voterId]) {
      combinedVotes[voterId] = 'done';
    }
  }

  const beatAccent = inTrustBeat ? trustAccent : betrayAccent;
  const beatLabel = inTrustBeat
    ? 'Beat 1 of 2 · Trust'
    : inBetrayBeat
      ? 'Beat 2 of 2 · Betray'
      : 'Locked in';
  const beatCta = inTrustBeat
    ? 'Pick your trust buddy.'
    : inBetrayBeat
      ? 'Now pick who goes.'
      : 'Both picks locked in. Waiting for the others.';

  const trustTargets = eligibleTargets?.filter((id: string) => id !== playerId) ?? [];
  const betrayTargets = (eligibleTargets ?? []).filter((id: string) => id !== myTrust);

  return (
    <VotingShell
      accentColor={beatAccent}
      header={
        <VotingHeader
          mechanismName={`${info.name} · ${beatLabel}`}
          cta={beatCta}
          howItWorks={info.howItWorks}
          accentColor={beatAccent}
        />
      }
      engagement={
        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={combinedVotes}
          roster={roster}
          accentColor={trustAccent}
          selfId={playerId}
        />
      }
    >
      {!canVote && <IneligibleNote reason="You're not in this round." />}

      {/* Locked-in trust receipt (visible during betray + done beats) */}
      {myTrust && (
        <LockedInReceipt
          label="You trusted"
          player={roster[myTrust]}
          accent={trustAccent}
        />
      )}

      {/* Beat 1: Trust picker */}
      {canVote && inTrustBeat && (
        <motion.div
          key="trust-beat"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AvatarPicker
            eligibleTargets={trustTargets}
            roster={roster}
            disabled={false}
            confirmedId={null}
            accentColor={trustAccent}
            confirmLabel="Trust {name}?"
            actionVerb="trusted"
            onConfirm={(targetId) =>
              engine.sendVoteAction(VoteEvents.TRUST_PAIRS.TRUST, targetId)
            }
          />
        </motion.div>
      )}

      {/* Beat 2: Betray picker (excludes trusted person) */}
      {canVote && inBetrayBeat && (
        <motion.div
          key="betray-beat"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AvatarPicker
            eligibleTargets={betrayTargets}
            roster={roster}
            disabled={false}
            confirmedId={null}
            accentColor={betrayAccent}
            confirmLabel="Eliminate {name}?"
            actionVerb="targeted"
            onConfirm={(targetId) =>
              engine.sendVoteAction(VoteEvents.TRUST_PAIRS.ELIMINATE, targetId)
            }
          />
        </motion.div>
      )}

      {/* Locked-in betray receipt */}
      {myEliminate && (
        <LockedInReceipt
          label="You're eliminating"
          player={roster[myEliminate]}
          accent={betrayAccent}
        />
      )}

      {allDone && (
        <IneligibleNote reason="Both picks locked in. Revealing soon." />
      )}
    </VotingShell>
  );
}

function LockedInReceipt({
  label,
  player,
  accent,
}: {
  label: string;
  player: SocialPlayer | undefined;
  accent: string;
}) {
  if (!player) return null;
  const firstName = player.personaName?.split(' ')[0] ?? '';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 12,
        background: `color-mix(in oklch, ${accent} 10%, var(--po-bg-glass, rgba(255,255,255,0.04)))`,
        border: `1px solid color-mix(in oklch, ${accent} 28%, transparent)`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <PersonaAvatar
        avatarUrl={player.avatarUrl}
        personaName={player.personaName}
        size={24}
      />
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--po-text)',
        }}
      >
        {firstName}
      </span>
    </div>
  );
}

function MutualPairsHero({
  pairs,
  roster,
  accent,
}: {
  pairs: string[][];
  roster: Record<string, SocialPlayer>;
  accent: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        padding: '18px 16px 18px',
        borderRadius: 18,
        background: `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 18%, transparent) 0%, transparent 70%), var(--po-bg-panel, rgba(0,0,0,0.25))`,
        border: `1.5px solid color-mix(in oklch, ${accent} 38%, transparent)`,
        boxShadow: `0 0 28px color-mix(in oklch, ${accent} 22%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.28em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        Mutual trust · Immune
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {pairs.map((pair, i) => {
          const a = roster[pair[0]];
          const b = roster[pair[1]];
          return (
            <motion.div
              key={i}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <PairAvatar player={a} accent={accent} />
              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: accent,
                }}
              >
                +
              </span>
              <PairAvatar player={b} accent={accent} />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PairAvatar({
  player,
  accent,
}: {
  player: SocialPlayer | undefined;
  accent: string;
}) {
  if (!player) return null;
  const firstName = player.personaName?.split(' ')[0] ?? '';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div
        style={{
          borderRadius: '50%',
          padding: 2,
          background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 35%, transparent), ${accent})`,
          boxShadow: `0 0 16px color-mix(in oklch, ${accent} 30%, transparent)`,
        }}
      >
        <PersonaAvatar
          avatarUrl={player.avatarUrl}
          personaName={player.personaName}
          size={56}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--po-text)',
        }}
      >
        {firstName}
      </span>
    </div>
  );
}
