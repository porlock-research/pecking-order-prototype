import { motion, useReducedMotion } from 'framer-motion';
import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingShell, IneligibleNote } from './shared/VotingShell';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';
import { VotingResultHero } from './shared/VotingResultHero';
import { VotingTallyGrid } from './shared/VotingTallyGrid';
import { VOTE_ACCENT } from './shared/voting-tokens';

interface ExecutionerVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ExecutionerVoting({
  cartridge,
  playerId,
  roster,
  engine,
}: ExecutionerVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    votes,
    results,
    executionerId,
    electionTallies,
  } = cartridge;
  const info = VOTE_TYPE_INFO[cartridge.voteType as keyof typeof VOTE_TYPE_INFO];
  const accent = VOTE_ACCENT[cartridge.voteType as keyof typeof VOTE_ACCENT];

  // PHASE 3 — REVEAL
  if (phase === VotingPhases.REVEAL) {
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const exId: string | null = results?.summary?.executionerId ?? executionerId ?? null;
    const revealTallies: Record<string, number> =
      results?.summary?.electionTallies ?? electionTallies ?? {};
    const eliminatedPlayer = eliminatedId ? roster[eliminatedId] : undefined;
    const executionerPlayer = exId ? roster[exId] : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '10px 0' }}>
        <VotingResultHero
          subjectPlayer={eliminatedPlayer}
          accent={accent}
          tone={info.mechanismTone}
          haloVariant="fade"
          subtitle={eliminatedId ? info.eliminatedSubtitle : info.noEliminationCopy}
          label={eliminatedId ? 'Eliminated' : undefined}
          secondarySubject={
            executionerPlayer
              ? { player: executionerPlayer, caption: 'The executioner' }
              : undefined
          }
        />
        {Object.keys(revealTallies).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.26em',
                color: 'var(--po-text-dim)',
                textTransform: 'uppercase',
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              Election Tallies
            </span>
            <VotingTallyGrid
              tallies={revealTallies}
              roster={roster}
              accent={accent}
              winnerId={exId}
              unitLabel="votes"
            />
          </div>
        )}
      </div>
    );
  }

  // PHASE 2 — EXECUTIONER PICKING
  if (phase === VotingPhases.EXECUTIONER_PICKING) {
    const isExecutioner = playerId === executionerId;
    const executionerPlayer = executionerId ? roster[executionerId] : undefined;
    const pickHeader = info.executionerPickHeader ?? info.header;
    const pickCta = info.executionerPickCta ?? info.cta;
    const pickConfirm = info.executionerPickConfirm ?? info.confirmTemplate;
    const pickVerb = info.executionerPickVerb ?? info.actionVerb;

    return (
      <VotingShell
        accentColor={accent}
        header={
          <VotingHeader
            mechanismName={info.name}
            cta={isExecutioner ? pickCta : 'The executioner is choosing.'}
            howItWorks={info.howItWorks}
            accentColor={accent}
          />
        }
      >
        <ExecutionerSpotlight player={executionerPlayer} accent={accent} />
        {isExecutioner ? (
          <AvatarPicker
            eligibleTargets={eligibleTargets}
            roster={roster}
            disabled={false}
            confirmedId={null}
            accentColor={accent}
            confirmLabel={pickConfirm}
            actionVerb={pickVerb}
            onConfirm={(targetId) =>
              engine.sendVoteAction(VoteEvents.EXECUTIONER.PICK, targetId)
            }
          />
        ) : (
          <IneligibleNote reason="Only the executioner can choose this round." />
        )}
      </VotingShell>
    );
  }

  // PHASE 1 — ELECTION
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  return (
    <VotingShell
      accentColor={accent}
      header={
        <VotingHeader
          mechanismName={`${info.name} · Election`}
          cta={info.cta}
          howItWorks={info.howItWorks}
          accentColor={accent}
        />
      }
      engagement={
        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={votes}
          roster={roster}
          accentColor={accent}
          selfId={playerId}
        />
      }
    >
      {!canVote && <IneligibleNote reason="You're not in this round." />}
      <AvatarPicker
        eligibleTargets={eligibleTargets}
        roster={roster}
        disabled={!canVote}
        confirmedId={myVote}
        accentColor={accent}
        confirmLabel={info.confirmTemplate}
        actionVerb={info.actionVerb}
        onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.EXECUTIONER.ELECT, targetId)}
      />
    </VotingShell>
  );
}

function ExecutionerSpotlight({
  player,
  accent,
}: {
  player: SocialPlayer | undefined;
  accent: string;
}) {
  const reduce = useReducedMotion();
  if (!player) return null;
  const firstName = player.personaName?.split(' ')[0] ?? '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0 4px',
      }}
    >
      <motion.div
        animate={reduce ? undefined : { opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'relative',
          borderRadius: '50%',
          padding: 2,
          background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 35%, transparent), ${accent})`,
          boxShadow: `0 0 28px color-mix(in oklch, ${accent} 50%, transparent)`,
        }}
      >
        <div
          style={{
            borderRadius: '50%',
            background: 'var(--po-bg-panel, rgba(0,0,0,0.35))',
            padding: 2,
          }}
        >
          <PersonaAvatar
            avatarUrl={player.avatarUrl}
            personaName={player.personaName}
            size={72}
          />
        </div>
      </motion.div>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.28em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        Executioner
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: 'var(--po-text)',
        }}
      >
        {firstName}
      </span>
    </div>
  );
}
