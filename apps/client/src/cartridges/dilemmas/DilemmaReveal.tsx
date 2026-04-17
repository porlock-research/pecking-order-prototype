import { motion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Coins, HeartCrack, Sparkles, Gift, AlertTriangle } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';

// Local spring — matches the Vivid "bouncy" feel without a cross-shell
// import. Keeping the cartridge shell-agnostic.
const BOUNCY_SPRING = { type: 'spring' as const, stiffness: 400, damping: 25 };

interface DilemmaRevealProps {
  dilemmaType: string;
  decisions: Record<string, any>;
  results: {
    silverRewards: Record<string, number>;
    summary: Record<string, any>;
  };
  roster: Record<string, SocialPlayer>;
  playerId: string;
}

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function DilemmaReveal({ dilemmaType, decisions, results, roster, playerId }: DilemmaRevealProps) {
  const firstName = (id: string) => (roster[id]?.personaName || id).split(' ')[0];
  const { summary, silverRewards } = results;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12 } },
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        transition={BOUNCY_SPRING}
        style={{
          textAlign: 'center',
          padding: '8px 0',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--po-gold)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Results
        </span>
      </motion.div>

      {/* Timeout — universal participation not met */}
      {summary.timedOut && (
        <TimedOutReveal summary={summary} />
      )}

      {/* Type-specific reveal (only when not timed out) */}
      {!summary.timedOut && dilemmaType === 'SILVER_GAMBIT' && (
        <SilverGambitReveal summary={summary} name={firstName} decisions={decisions} roster={roster} />
      )}
      {!summary.timedOut && dilemmaType === 'SPOTLIGHT' && (
        <SpotlightReveal summary={summary} name={firstName} decisions={decisions} roster={roster} />
      )}
      {!summary.timedOut && dilemmaType === 'GIFT_OR_GRIEF' && (
        <GiftOrGriefReveal summary={summary} name={firstName} roster={roster} decisions={decisions} />
      )}

      {/* Player's silver reward */}
      {silverRewards[playerId] != null && silverRewards[playerId] !== 0 && (
        <motion.div
          variants={staggerItem}
          transition={BOUNCY_SPRING}
          style={{
            textAlign: 'center',
            padding: '10px 0',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--po-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            You Earned
          </span>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 22,
              fontWeight: 800,
              color: silverRewards[playerId] > 0 ? 'var(--po-gold)' : 'var(--po-pink, #9D174D)',
            }}
          >
            {silverRewards[playerId] > 0 ? '+' : ''}
            {silverRewards[playerId]} silver
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* -- Timed Out Reveal (universal participation not met) -- */

function TimedOutReveal({ summary }: { summary: Record<string, any> }) {
  return (
    <motion.div
      variants={staggerItem}
      transition={BOUNCY_SPRING}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
        border: '1px solid var(--po-border, rgba(255,255,255,0.08))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <AlertTriangle size={28} strokeWidth={2.25} />
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--po-text-dim)',
          lineHeight: 1.4,
        }}
      >
        Time's up
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          color: 'var(--po-text-dim)',
          marginTop: 4,
        }}
      >
        Only {summary.submitted} of {summary.eligible} participated. Everyone must decide for rewards to apply.
      </div>
    </motion.div>
  );
}

/* -- Silver Gambit Reveal -- */

function SilverGambitReveal({
  summary,
  name,
  decisions,
  roster,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
}) {
  const decisionEntries = decisions ? Object.entries(decisions) : [];

  const outcomeBox = summary.allDonated ? (
    <motion.div
      variants={staggerItem}
      transition={BOUNCY_SPRING}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'color-mix(in oklch, var(--po-green) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--po-green) 22%, transparent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <Coins size={28} strokeWidth={2.25} />
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--po-green, #2D6A4F)',
          lineHeight: 1.4,
        }}
      >
        Everyone donated!
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          color: 'var(--po-text)',
          marginTop: 4,
        }}
      >
        <strong style={{ color: 'var(--po-gold)' }}>{name(summary.winnerId)}</strong> wins the jackpot of{' '}
        <strong style={{ color: 'var(--po-gold)' }}>{summary.jackpot} silver</strong>!
      </div>
    </motion.div>
  ) : (
    <motion.div
      variants={staggerItem}
      transition={BOUNCY_SPRING}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'color-mix(in oklch, var(--po-pink) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--po-pink) 22%, transparent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <HeartCrack size={28} strokeWidth={2.25} />
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--po-pink, #9D174D)',
          lineHeight: 1.4,
        }}
      >
        Someone defected...
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          color: 'var(--po-text-dim)',
          marginTop: 4,
        }}
      >
        {summary.donorCount} donated, {summary.keeperCount} kept. Donations lost!
      </div>
    </motion.div>
  );

  return (
    <>
      {outcomeBox}

      {decisionEntries.length > 0 && (
        <motion.div
          variants={staggerItem}
          transition={BOUNCY_SPRING}
          style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}
        >
          {decisionEntries.map(([pid, dec]) => {
            const isDonate = dec?.action === 'DONATE';
            const player = roster[pid];
            return (
              <div
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: isDonate ? 'color-mix(in oklch, var(--po-green) 6%, transparent)' : 'color-mix(in oklch, var(--po-pink) 6%, transparent)',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={22}
                />
                <span
                  style={{
                    fontFamily: 'var(--po-font-body)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--po-text)',
                    flex: 1,
                  }}
                >
                  {name(pid)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: isDonate ? 'var(--po-green, #2D6A4F)' : 'var(--po-pink, #9D174D)',
                    textTransform: 'uppercase',
                  }}
                >
                  {isDonate ? 'Donated' : 'Kept'}
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </>
  );
}

/* -- Spotlight Reveal -- */

function SpotlightReveal({
  summary,
  name,
  decisions,
  roster,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
}) {
  const decisionEntries = decisions ? Object.entries(decisions) : [];

  const outcomeBox = summary.unanimous && summary.targetId ? (
    <motion.div
      variants={staggerItem}
      transition={BOUNCY_SPRING}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'color-mix(in oklch, var(--po-gold) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--po-gold) 22%, transparent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <Sparkles size={28} strokeWidth={2.25} />
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--po-gold)',
          lineHeight: 1.4,
        }}
      >
        Unanimous!
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          color: 'var(--po-text)',
          marginTop: 4,
        }}
      >
        <strong style={{ color: 'var(--po-gold)' }}>{name(summary.targetId)}</strong> gets 20 silver!
      </div>
    </motion.div>
  ) : (
    <motion.div
      variants={staggerItem}
      transition={BOUNCY_SPRING}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
        border: '1px solid var(--po-border, rgba(255,255,255,0.08))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <AlertTriangle size={28} strokeWidth={2.25} />
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--po-text-dim)',
          lineHeight: 1.4,
        }}
      >
        No consensus
      </div>
      <div
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 12,
          color: 'var(--po-text-dim)',
          marginTop: 4,
        }}
      >
        Picks were split — no bonus this time.
      </div>
    </motion.div>
  );

  return (
    <>
      {outcomeBox}

      {decisionEntries.length > 0 && (
        <motion.div
          variants={staggerItem}
          transition={BOUNCY_SPRING}
          style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}
        >
          {decisionEntries.map(([pid, dec]) => {
            const targetId = dec?.targetId;
            const voter = roster[pid];
            const target = targetId ? roster[targetId] : undefined;
            return (
              <div
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'color-mix(in oklch, var(--po-gold) 5%, transparent)',
                }}
              >
                <PersonaAvatar
                  avatarUrl={voter?.avatarUrl}
                  personaName={voter?.personaName}
                  size={22}
                />
                <span
                  style={{
                    fontFamily: 'var(--po-font-body)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--po-text)',
                  }}
                >
                  {name(pid)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 11,
                    color: 'var(--po-text-dim)',
                  }}
                >
                  →
                </span>
                {target && (
                  <PersonaAvatar
                    avatarUrl={target.avatarUrl}
                    personaName={target.personaName}
                    size={22}
                  />
                )}
                <span
                  style={{
                    fontFamily: 'var(--po-font-body)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--po-gold)',
                  }}
                >
                  {targetId ? name(targetId) : '—'}
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </>
  );
}

/* -- Gift or Grief Reveal -- */

function GiftOrGriefReveal({
  summary,
  name,
  roster,
  decisions,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  roster: Record<string, SocialPlayer>;
  decisions: Record<string, any>;
}) {
  const nominations: Record<string, number> = summary.nominations || {};
  const giftedIds: string[] = summary.giftedIds || [];
  const grievedIds: string[] = summary.grievedIds || [];

  // Build reverse map: targetId → list of nominator IDs
  const nominatorsOf: Record<string, string[]> = {};
  if (decisions) {
    for (const [pid, dec] of Object.entries(decisions)) {
      const tid = dec?.targetId;
      if (tid) {
        if (!nominatorsOf[tid]) nominatorsOf[tid] = [];
        nominatorsOf[tid].push(pid);
      }
    }
  }

  // Sort by nomination count descending
  const sorted = Object.entries(nominations).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Nomination breakdown */}
      <motion.div
        variants={staggerItem}
        transition={BOUNCY_SPRING}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {sorted.map(([pid, count]) => {
          const isGifted = giftedIds.includes(pid);
          const isGrieved = grievedIds.includes(pid);
          const nominators = nominatorsOf[pid] || [];
          return (
            <div
              key={pid}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: isGifted
                  ? 'color-mix(in oklch, var(--po-green) 8%, transparent)'
                  : isGrieved
                    ? 'color-mix(in oklch, var(--po-pink) 8%, transparent)'
                    : 'var(--po-bg-glass, rgba(255,255,255,0.03))',
                border: `1px solid ${
                  isGifted
                    ? 'color-mix(in oklch, var(--po-green) 22%, transparent)'
                    : isGrieved
                      ? 'color-mix(in oklch, var(--po-pink) 22%, transparent)'
                      : 'var(--po-border, rgba(255,255,255,0.06))'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: isGifted ? 'var(--po-green, #2D6A4F)' : isGrieved ? 'var(--po-pink, #9D174D)' : 'var(--po-text)',
                    }}
                  >
                    {name(pid)}
                  </span>
                  {isGifted && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--po-green, #2D6A4F)' }}>
                      <Gift size={14} strokeWidth={2.25} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>+10</span>
                    </span>
                  )}
                  {isGrieved && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--po-pink, #9D174D)' }}>
                      <AlertTriangle size={14} strokeWidth={2.25} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>-10</span>
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--po-text-dim)',
                  }}
                >
                  {count} {count === 1 ? 'vote' : 'votes'}
                </span>
              </div>
              {nominators.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px solid var(--po-border, rgba(255,255,255,0.06))',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--po-font-body)',
                      fontSize: 11,
                      color: 'var(--po-text-dim)',
                    }}
                  >
                    from
                  </span>
                  {nominators.map((nid) => {
                    const nominator = roster[nid];
                    return (
                      <div key={nid} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <PersonaAvatar
                          avatarUrl={nominator?.avatarUrl}
                          personaName={nominator?.personaName}
                          size={16}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--po-font-body)',
                            fontSize: 11,
                            color: 'var(--po-text-dim)',
                          }}
                        >
                          {name(nid)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </>
  );
}
