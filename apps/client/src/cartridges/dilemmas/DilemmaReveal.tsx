import { motion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../shells/vivid/springs';

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
  const name = (id: string) => roster[id]?.personaName || id;
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
        transition={VIVID_SPRING.bouncy}
        style={{
          textAlign: 'center',
          padding: '8px 0',
        }}
      >
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 11,
          fontWeight: 800,
          color: '#B8840A',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Results
        </span>
      </motion.div>

      {/* Type-specific reveal */}
      {dilemmaType === 'SILVER_GAMBIT' && (
        <SilverGambitReveal summary={summary} name={name} />
      )}
      {dilemmaType === 'SPOTLIGHT' && (
        <SpotlightReveal summary={summary} name={name} />
      )}
      {dilemmaType === 'GIFT_OR_GRIEF' && (
        <GiftOrGriefReveal summary={summary} name={name} roster={roster} />
      )}

      {/* Player's silver reward */}
      {silverRewards[playerId] != null && silverRewards[playerId] !== 0 && (
        <motion.div
          variants={staggerItem}
          transition={VIVID_SPRING.bouncy}
          style={{
            textAlign: 'center',
            padding: '10px 0',
          }}
        >
          <span style={{
            fontFamily: 'var(--vivid-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            color: '#9B8E7E',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'block',
            marginBottom: 4,
          }}>
            You Earned
          </span>
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 22,
            fontWeight: 800,
            color: silverRewards[playerId] > 0 ? '#B8840A' : '#9D174D',
          }}>
            {silverRewards[playerId] > 0 ? '+' : ''}{silverRewards[playerId]} silver
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* -- Silver Gambit Reveal -- */

function SilverGambitReveal({ summary, name }: { summary: Record<string, any>; name: (id: string) => string }) {
  if (summary.allDonated) {
    return (
      <motion.div
        variants={staggerItem}
        transition={VIVID_SPRING.bouncy}
        style={{
          textAlign: 'center',
          padding: '14px 16px',
          borderRadius: 12,
          background: 'rgba(45, 106, 79, 0.06)',
          border: '1px solid rgba(45, 106, 79, 0.15)',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>{'🎰'}</div>
        <div style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: '#2D6A4F',
          lineHeight: 1.4,
        }}>
          Everyone donated!
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          color: '#3D2E1F',
          marginTop: 4,
        }}>
          <strong style={{ color: '#B8840A' }}>{name(summary.winnerId)}</strong> wins the jackpot of{' '}
          <strong style={{ color: '#B8840A' }}>{summary.jackpot} silver</strong>!
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={staggerItem}
      transition={VIVID_SPRING.bouncy}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'rgba(157, 23, 77, 0.06)',
        border: '1px solid rgba(157, 23, 77, 0.15)',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{'💔'}</div>
      <div style={{
        fontFamily: 'var(--vivid-font-display)',
        fontSize: 14,
        fontWeight: 700,
        color: '#9D174D',
        lineHeight: 1.4,
      }}>
        Someone defected...
      </div>
      <div style={{
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 12,
        color: '#9B8E7E',
        marginTop: 4,
      }}>
        {summary.donorCount} donated, {summary.keeperCount} kept. Donations lost!
      </div>
    </motion.div>
  );
}

/* -- Spotlight Reveal -- */

function SpotlightReveal({ summary, name }: { summary: Record<string, any>; name: (id: string) => string }) {
  if (summary.unanimous && summary.targetId) {
    return (
      <motion.div
        variants={staggerItem}
        transition={VIVID_SPRING.bouncy}
        style={{
          textAlign: 'center',
          padding: '14px 16px',
          borderRadius: 12,
          background: 'rgba(184, 132, 10, 0.06)',
          border: '1px solid rgba(184, 132, 10, 0.15)',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>{'🎯'}</div>
        <div style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: '#B8840A',
          lineHeight: 1.4,
        }}>
          Unanimous!
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          color: '#3D2E1F',
          marginTop: 4,
        }}>
          <strong style={{ color: '#B8840A' }}>{name(summary.targetId)}</strong> gets 20 silver!
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={staggerItem}
      transition={VIVID_SPRING.bouncy}
      style={{
        textAlign: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'rgba(139, 115, 85, 0.06)',
        border: '1px solid rgba(139, 115, 85, 0.12)',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{'🤷'}</div>
      <div style={{
        fontFamily: 'var(--vivid-font-display)',
        fontSize: 14,
        fontWeight: 700,
        color: '#9B8E7E',
        lineHeight: 1.4,
      }}>
        No consensus
      </div>
      <div style={{
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 12,
        color: '#9B8E7E',
        marginTop: 4,
      }}>
        Picks were split — no bonus this time.
      </div>
    </motion.div>
  );
}

/* -- Gift or Grief Reveal -- */

function GiftOrGriefReveal({
  summary,
  name,
  roster,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  roster: Record<string, SocialPlayer>;
}) {
  const nominations: Record<string, number> = summary.nominations || {};
  const giftedIds: string[] = summary.giftedIds || [];
  const grievedIds: string[] = summary.grievedIds || [];

  // Sort by nomination count descending
  const sorted = Object.entries(nominations).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Nomination breakdown */}
      <motion.div
        variants={staggerItem}
        transition={VIVID_SPRING.bouncy}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {sorted.map(([pid, count]) => {
          const isGifted = giftedIds.includes(pid);
          const isGrieved = grievedIds.includes(pid);
          return (
            <div
              key={pid}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 10,
                background: isGifted
                  ? 'rgba(45, 106, 79, 0.06)'
                  : isGrieved
                    ? 'rgba(157, 23, 77, 0.06)'
                    : 'rgba(139, 115, 85, 0.04)',
                border: `1px solid ${isGifted
                  ? 'rgba(45, 106, 79, 0.15)'
                  : isGrieved
                    ? 'rgba(157, 23, 77, 0.15)'
                    : 'rgba(139, 115, 85, 0.08)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isGifted ? '#2D6A4F' : isGrieved ? '#9D174D' : '#3D2E1F',
                }}>
                  {name(pid)}
                </span>
                {isGifted && <span style={{ fontSize: 14 }}>{'🎁 +10'}</span>}
                {isGrieved && <span style={{ fontSize: 14 }}>{'😈 -10'}</span>}
              </div>
              <span style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: '#9B8E7E',
              }}>
                {count} {count === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          );
        })}
      </motion.div>
    </>
  );
}
