import { SocialPlayer, VotingPhases, VoteEvents, VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VotingHeader } from './shared/VotingHeader';
import { VoterStrip } from './shared/VoterStrip';
import { AvatarPicker } from './shared/AvatarPicker';

const ACCENT_ELECT = '#9d174d';
const ACCENT_PICK = '#9d174d';

interface ExecutionerVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ExecutionerVoting({ cartridge, playerId, roster, engine }: ExecutionerVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    votes,
    results,
    executionerId,
    electionTallies,
  } = cartridge;
  const info = (VOTE_TYPE_INFO as Record<string, any>)[cartridge.voteType];

  // REVEAL phase
  if (phase === VotingPhases.REVEAL) {
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const exId: string | null = results?.summary?.executionerId ?? executionerId ?? null;
    const revealTallies: Record<string, number> = results?.summary?.electionTallies ?? electionTallies ?? {};
    const executioner = exId ? roster[exId] : null;
    const eliminated = eliminatedId ? roster[eliminatedId] : null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-executioner" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-danger uppercase tracking-widest text-center">
            EXECUTIONER RESULTS
          </h3>

          {executioner && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <PersonaAvatar avatarUrl={executioner.avatarUrl} personaName={executioner.personaName} size={32} />
              <span className="font-bold text-skin-base">{executioner.personaName}</span>
              <span className="text-[10px] font-mono text-skin-dim uppercase">was the executioner</span>
            </div>
          )}

          {eliminated ? (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-skin-danger bg-skin-danger/10 elimination-reveal">
              <PersonaAvatar avatarUrl={eliminated.avatarUrl} personaName={eliminated.personaName} size={32} />
              <div>
                <div className="text-sm font-bold text-skin-danger">{eliminated.personaName}</div>
                <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}

          {Object.keys(revealTallies).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Election Tallies</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(revealTallies)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([targetId, count]) => {
                    const player = roster[targetId];
                    return (
                      <div key={targetId} className="flex items-center gap-1 p-1.5 rounded-lg bg-skin-deep/40 border border-white/[0.06] text-xs">
                        <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={24} />
                        <span className="truncate flex-1 text-skin-base">{player?.personaName || targetId}</span>
                        <span className="font-mono font-bold text-skin-gold">{count as number}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EXECUTIONER_PICKING phase
  if (phase === VotingPhases.EXECUTIONER_PICKING) {
    const isExecutioner = playerId === executionerId;
    const executioner = executionerId ? roster[executionerId] : null;
    // For executioner pick, use the pick-specific fields
    const pickHeader = info.executionerPickHeader ?? info.header;
    const pickCta = info.executionerPickCta ?? info.cta;
    const pickConfirm = info.executionerPickConfirm ?? info.confirmTemplate;
    const pickVerb = info.executionerPickVerb ?? info.actionVerb;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-executioner" />
        <div className="p-4 space-y-3">
          <VotingHeader
            header={pickHeader}
            cta={isExecutioner ? pickCta : 'Waiting for the executioner...'}
            oneLiner={info.oneLiner}
            howItWorks={info.howItWorks}
            accentColor={ACCENT_PICK}
          />

          {/* Executioner identity badge */}
          {executioner && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <PersonaAvatar avatarUrl={executioner.avatarUrl} personaName={executioner.personaName} size={32} />
              <span
                style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#f5f0e8',
                }}
              >
                {executioner.personaName}
              </span>
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 9,
                  color: ACCENT_PICK,
                  textTransform: 'uppercase',
                  background: 'rgba(157,23,77,0.15)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                executioner
              </span>
            </div>
          )}

          {isExecutioner ? (
            <AvatarPicker
              eligibleTargets={eligibleTargets}
              roster={roster}
              disabled={false}
              confirmedId={null}
              accentColor={ACCENT_PICK}
              confirmLabel={pickConfirm}
              actionVerb={pickVerb}
              onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.EXECUTIONER.PICK, targetId)}
            />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(157,23,77,0.1)',
                  border: '1px solid rgba(157,23,77,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: ACCENT_PICK,
                  }}
                >
                  ?
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 11,
                  color: '#9B8E7E',
                  fontStyle: 'italic',
                }}
              >
                The Executioner is choosing...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase (election)
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-executioner" />
      <div className="p-4 space-y-3">
        <VotingHeader
          header={info.header}
          cta={info.cta}
          oneLiner={info.oneLiner}
          howItWorks={info.howItWorks}
          accentColor={ACCENT_ELECT}
        />

        <VoterStrip
          eligibleVoters={eligibleVoters}
          votes={votes}
          roster={roster}
        />

        {!canVote && (
          <p
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 11,
              color: '#9B8E7E',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            You are not eligible to vote
          </p>
        )}

        <AvatarPicker
          eligibleTargets={eligibleTargets}
          roster={roster}
          disabled={!canVote}
          confirmedId={myVote}
          accentColor={ACCENT_ELECT}
          confirmLabel={info.confirmTemplate}
          actionVerb={info.actionVerb}
          onConfirm={(targetId) => engine.sendVoteAction(VoteEvents.EXECUTIONER.ELECT, targetId)}
        />
      </div>
    </div>
  );
}
