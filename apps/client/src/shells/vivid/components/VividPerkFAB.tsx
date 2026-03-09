import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useGameStore } from '../../../store/useGameStore';
import { PERK_COSTS, PlayerStatuses } from '@pecking-order/shared-types';
import { Eye, UserPlus, DocumentText, Dollar, CloseCircle, StarShine } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface VividPerkFABProps {
  engine: {
    sendPerk: (perkType: string, targetId?: string) => void;
  };
}

const PERK_INFO = [
  {
    type: 'SPY_DMS' as const,
    label: 'Spy DMs',
    desc: 'See last 3 DMs of a player',
    Icon: Eye,
    color: 'var(--vivid-teal)',
  },
  {
    type: 'EXTRA_DM_PARTNER' as const,
    label: 'Extra Partner',
    desc: '+1 DM partner for today',
    Icon: UserPlus,
    color: 'var(--vivid-lavender)',
  },
  {
    type: 'EXTRA_DM_CHARS' as const,
    label: 'Extra Chars',
    desc: '+300 DM characters for today',
    Icon: DocumentText,
    color: 'var(--vivid-pink)',
  },
] as const;

export function VividPerkFAB({ engine }: VividPerkFABProps) {
  const [open, setOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<string | null>(null);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);
  const lastPerkResult = useGameStore((s) => s.lastPerkResult);
  const clearPerkResult = useGameStore((s) => s.clearPerkResult);

  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const alivePlayers = Object.values(roster).filter(
    (p) => p.id !== playerId && p.status === PlayerStatuses.ALIVE,
  );

  useEffect(() => {
    if (!lastPerkResult) return;

    if (lastPerkResult.type === 'PERK.RESULT' && lastPerkResult.result?.perkType === 'SPY_DMS') {
      const messages = lastPerkResult.result.messages || [];
      if (messages.length === 0) {
        toast('No DMs found for this player.', { icon: '🔍' });
      } else {
        toast.custom(() => (
          <div
            style={{
              background: 'var(--vivid-bg-elevated)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              padding: 12,
              maxWidth: 340,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--vivid-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
                fontFamily: 'var(--vivid-font-display)',
              }}
            >
              DM Intel
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map((m: { from: string; to: string; content: string }, i: number) => (
                <li
                  key={i}
                  style={{
                    fontSize: 14,
                    background: 'var(--vivid-bg-surface)',
                    borderRadius: 12,
                    padding: 8,
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <span style={{ color: 'var(--vivid-gold)', fontFamily: 'var(--vivid-font-body)', fontSize: 12, fontWeight: 600 }}>
                    {roster[m.from]?.personaName || m.from}
                  </span>
                  <span style={{ color: 'var(--vivid-text-dim)', margin: '0 4px' }}>&rarr;</span>
                  <span style={{ color: 'var(--vivid-pink)', fontFamily: 'var(--vivid-font-body)', fontSize: 12, fontWeight: 600 }}>
                    {roster[m.to]?.personaName || m.to}
                  </span>
                  <p style={{ marginTop: 4, marginBottom: 0, color: 'var(--vivid-text)' }}>{m.content}</p>
                </li>
              ))}
            </ul>
          </div>
        ), { duration: 8000 });
      }
      clearPerkResult();
    } else if (lastPerkResult.type === 'PERK.RESULT') {
      toast.success('Perk activated!');
      clearPerkResult();
    } else if (lastPerkResult.type === 'PERK.REJECTED') {
      toast.error(`Rejected: ${lastPerkResult.reason}`);
      clearPerkResult();
    }
  }, [lastPerkResult, clearPerkResult, roster]);

  const handlePerk = (perkType: string) => {
    if (perkType === 'SPY_DMS') {
      setPickingTarget(perkType);
    } else {
      engine.sendPerk(perkType);
      setOpen(false);
    }
  };

  const handleTargetPick = (targetId: string) => {
    engine.sendPerk('SPY_DMS', targetId);
    setPickingTarget(null);
    setOpen(false);
  };

  return (
    <>
      {/* FAB Button */}
      <motion.button
        style={{
          position: 'fixed',
          bottom: 140,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--vivid-gold), var(--vivid-coral))',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(255, 107, 107, 0.35)',
          cursor: 'pointer',
          zIndex: 30,
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={() => setOpen(true)}
        whileTap={VIVID_TAP.fab}
        transition={VIVID_SPRING.bouncy}
      >
        <StarShine size={26} weight="Bold" color="#fff" />
      </motion.button>

      {/* Perk Drawer */}
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 40,
            }}
          />
          <Drawer.Content
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              background: 'color-mix(in srgb, var(--vivid-bg-surface) 95%, transparent)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
            aria-describedby={undefined}
          >
            <Drawer.Title className="sr-only">Perks</Drawer.Title>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 48,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.2)',
                }}
              />
            </div>

            <div style={{ padding: '0 20px 8px' }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--vivid-gold)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--vivid-font-display)',
                  margin: 0,
                }}
              >
                Perks
              </h3>
            </div>

            {/* Target picker */}
            <AnimatePresence>
              {pickingTarget && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '0 20px 16px', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--vivid-teal)',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--vivid-font-display)',
                        margin: 0,
                      }}
                    >
                      Pick a target
                    </h4>
                    <button
                      onClick={() => setPickingTarget(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--vivid-text-dim)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <CloseCircle size={16} weight="Bold" />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {alivePlayers.map((p) => (
                      <motion.button
                        key={p.id}
                        onClick={() => handleTargetPick(p.id)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 12,
                          background: 'var(--vivid-bg-elevated)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          color: 'var(--vivid-text)',
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: 'var(--vivid-font-body)',
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                        whileTap={VIVID_TAP.button}
                        transition={VIVID_SPRING.bouncy}
                      >
                        {p.personaName}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Perk buttons */}
            {!pickingTarget && (
              <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PERK_INFO.map((perk) => {
                  const cost = PERK_COSTS[perk.type];
                  const canAfford = mySilver >= cost;
                  return (
                    <motion.button
                      key={perk.type}
                      onClick={() => handlePerk(perk.type)}
                      disabled={!canAfford}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: canAfford
                          ? '1px solid rgba(255, 255, 255, 0.08)'
                          : '1px solid rgba(255, 255, 255, 0.03)',
                        background: canAfford
                          ? 'var(--vivid-bg-elevated)'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: canAfford ? 'var(--vivid-text)' : 'var(--vivid-text-dim)',
                        opacity: canAfford ? 1 : 0.4,
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        fontFamily: 'var(--vivid-font-body)',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'opacity 0.2s',
                      }}
                      whileTap={canAfford ? VIVID_TAP.card : undefined}
                      transition={VIVID_SPRING.bouncy}
                    >
                      <perk.Icon size={22} weight="BoldDuotone" color={perk.color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{perk.label}</span>
                        <p
                          style={{
                            fontSize: 13,
                            color: 'var(--vivid-text-dim)',
                            margin: '2px 0 0',
                          }}
                        >
                          {perk.desc}
                        </p>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--vivid-gold)',
                          flexShrink: 0,
                        }}
                      >
                        <Dollar size={14} weight="BoldDuotone" />
                        {cost}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
