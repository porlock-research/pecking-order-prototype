import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Coins, HeartCrack, Sparkles, Gift, AlertTriangle } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';

// Local spring — matches the Vivid "bouncy" feel without a cross-shell
// import. Keeping the cartridge shell-agnostic.
const BOUNCY_SPRING = { type: 'spring' as const, stiffness: 400, damping: 25 };

/* ------------------------------------------------------------------ */
/*  WinnerHero — the payoff portrait. The "who" of the verdict should  */
/*  land as an image, not a sentence. Big avatar, themed aura, name    */
/*  in display face. This is the cartridge's peak moment.              */
/* ------------------------------------------------------------------ */

function WinnerHero({
  player,
  accent,
  label,
  sublabel,
  reduce,
  Icon,
}: {
  player?: SocialPlayer;
  accent: string;
  /** Micro-label, uppercase (e.g. "JACKPOT", "SPOTLIGHT"). */
  label: string;
  /** Optional line under the name (e.g. "+20 silver", "wins the pot"). */
  sublabel?: string;
  reduce: boolean;
  /** Optional accent icon tucked onto the halo. */
  Icon?: React.ComponentType<any>;
}) {
  const firstName = (player?.personaName || '').split(' ')[0] || '—';
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.88, 1.04, 1], y: 0 }}
      transition={{ duration: 0.7, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        position: 'relative',
        padding: '22px 18px 20px',
        borderRadius: 18,
        background: `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 22%, transparent) 0%, color-mix(in oklch, ${accent} 8%, transparent) 55%, transparent 100%), var(--po-bg-panel, rgba(0,0,0,0.25))`,
        border: `1.5px solid color-mix(in oklch, ${accent} 45%, transparent)`,
        boxShadow: `0 0 42px color-mix(in oklch, ${accent} 34%, transparent), 0 0 96px color-mix(in oklch, ${accent} 14%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* Soft radiant backdrop — a second halo layer for depth. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-40% -10% auto -10%',
          height: '80%',
          background: `radial-gradient(60% 60% at 50% 30%, color-mix(in oklch, ${accent} 28%, transparent) 0%, transparent 70%)`,
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      {/* Portrait with pulsing ring */}
      <motion.div
        initial={reduce ? undefined : { scale: 0.9 }}
        animate={reduce ? undefined : { scale: [0.9, 1, 1] }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'relative',
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 40%, transparent), ${accent})`,
          boxShadow: `0 0 26px color-mix(in oklch, ${accent} 55%, transparent), 0 0 60px color-mix(in oklch, ${accent} 20%, transparent)`,
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
            avatarUrl={player?.avatarUrl}
            personaName={player?.personaName}
            size={112}
          />
        </div>
        {Icon && (
          <div
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: accent,
              border: '2.5px solid var(--po-bg-panel, rgba(0,0,0,0.5))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 14px color-mix(in oklch, ${accent} 60%, transparent)`,
            }}
          >
            <Icon size={18} strokeWidth={2.5} color="var(--po-text-inverted, #fff)" />
          </div>
        )}
      </motion.div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          position: 'relative',
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
            textShadow: `0 0 12px color-mix(in oklch, ${accent} 45%, transparent)`,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(24px, 6vw, 30px)',
            fontWeight: 700,
            letterSpacing: -0.6,
            lineHeight: 1.05,
            color: 'var(--po-text)',
          }}
        >
          {firstName}
        </span>
        {sublabel && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--po-font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: accent,
              letterSpacing: 0.1,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}

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

// Per-type dramatic opener + accent. Replaces the generic "Results" label.
const REVEAL_HERO: Record<string, { title: string; accent: string }> = {
  SILVER_GAMBIT: { title: 'The Gambit Outcome', accent: 'var(--po-gold)' },
  SPOTLIGHT:     { title: 'The Spotlight Falls On',     accent: 'var(--po-pink)' },
  GIFT_OR_GRIEF: { title: 'Gift or Grief?',             accent: 'var(--po-orange, var(--po-gold))' },
};

export default function DilemmaReveal({ dilemmaType, decisions, results, roster, playerId }: DilemmaRevealProps) {
  const firstName = (id: string) => (roster[id]?.personaName || id).split(' ')[0];
  const { summary, silverRewards } = results;
  const hero = REVEAL_HERO[dilemmaType] || { title: 'Results', accent: 'var(--po-gold)' };
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12 } },
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {/* Hero title — per-type dramatic opener. This is the payoff moment
          of the dilemma arc; it deserves presence, not a small label. */}
      <motion.div
        variants={staggerItem}
        transition={BOUNCY_SPRING}
        style={{
          textAlign: 'center',
          padding: '4px 0 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--po-text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.28em',
          }}
        >
          Verdict
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(26px, 6.5vw, 34px)',
            fontWeight: 700,
            letterSpacing: -0.7,
            lineHeight: 1.04,
            color: hero.accent,
            textShadow: `0 0 26px color-mix(in oklch, ${hero.accent} 40%, transparent)`,
          }}
        >
          {hero.title}
        </h2>
      </motion.div>

      {/* Timeout — universal participation not met */}
      {summary.timedOut && (
        <TimedOutReveal summary={summary} />
      )}

      {/* Type-specific reveal (only when not timed out) */}
      {!summary.timedOut && dilemmaType === 'SILVER_GAMBIT' && (
        <SilverGambitReveal summary={summary} name={firstName} decisions={decisions} roster={roster} reduce={reduce} />
      )}
      {!summary.timedOut && dilemmaType === 'SPOTLIGHT' && (
        <SpotlightReveal summary={summary} name={firstName} decisions={decisions} roster={roster} reduce={reduce} />
      )}
      {!summary.timedOut && dilemmaType === 'GIFT_OR_GRIEF' && (
        <GiftOrGriefReveal summary={summary} name={firstName} roster={roster} decisions={decisions} reduce={reduce} />
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
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--po-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.24em',
              display: 'block',
              marginBottom: 6,
            }}
          >
            You Earned
          </span>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: -0.4,
              color: silverRewards[playerId] > 0 ? 'var(--po-gold)' : 'var(--po-pink, #9D174D)',
              textShadow: `0 0 18px color-mix(in oklch, ${
                silverRewards[playerId] > 0 ? 'var(--po-gold)' : 'var(--po-pink)'
              } 30%, transparent)`,
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
  reduce,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
  reduce: boolean;
}) {
  const decisionEntries = decisions ? Object.entries(decisions) : [];

  const outcomeBox = summary.allDonated ? (
    <motion.div variants={staggerItem} transition={BOUNCY_SPRING}>
      <WinnerHero
        player={roster[summary.winnerId]}
        accent="var(--po-gold)"
        label="Jackpot"
        sublabel={`wins ${summary.jackpot} silver`}
        Icon={Coins}
        reduce={reduce}
      />
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
  reduce,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
  reduce: boolean;
}) {
  const decisionEntries = decisions ? Object.entries(decisions) : [];

  const outcomeBox = summary.unanimous && summary.targetId ? (
    <motion.div variants={staggerItem} transition={BOUNCY_SPRING}>
      <WinnerHero
        player={roster[summary.targetId]}
        accent="var(--po-pink)"
        label="Spotlight"
        sublabel="Unanimous — +20 silver"
        Icon={Sparkles}
        reduce={reduce}
      />
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
  reduce,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  roster: Record<string, SocialPlayer>;
  decisions: Record<string, any>;
  reduce: boolean;
}) {
  const nominations: Record<string, number> = summary.nominations || {};
  const giftedIds: string[] = summary.giftedIds || [];
  const grievedIds: string[] = summary.grievedIds || [];

  // Pick a featured player for the hero portrait — prefer the first gift
  // recipient (the crowd favorite), otherwise the first grief target (the
  // crowd's villain). Either way, someone's face anchors the reveal.
  const featuredId: string | undefined = giftedIds[0] || grievedIds[0];
  const featuredIsGift = !!giftedIds[0];

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
      {featuredId && (
        <motion.div variants={staggerItem} transition={BOUNCY_SPRING}>
          <WinnerHero
            player={roster[featuredId]}
            accent={featuredIsGift ? 'var(--po-green)' : 'var(--po-pink)'}
            label={featuredIsGift ? 'Gifted' : 'Grieved'}
            sublabel={featuredIsGift ? '+10 silver' : '−10 silver'}
            Icon={featuredIsGift ? Gift : AlertTriangle}
            reduce={reduce}
          />
        </motion.div>
      )}

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
