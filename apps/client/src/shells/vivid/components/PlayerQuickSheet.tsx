import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { ChatDots, Dollar, UserCircle } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PlayerStatuses } from '@pecking-order/shared-types';

interface PlayerQuickSheetProps {
  targetPlayerId: string | null;
  onClose: () => void;
  onWhisper: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
  engine: {
    sendSilver: (amount: number, targetId: string) => void;
  };
  playerColorMap: Record<string, string>;
}

export function PlayerQuickSheet({
  targetPlayerId,
  onClose,
  onWhisper,
  onViewProfile,
  engine,
  playerColorMap,
}: PlayerQuickSheetProps) {
  const roster = useGameStore(s => s.roster);
  const [showSilverPicker, setShowSilverPicker] = useState(false);
  const [silverAmount, setSilverAmount] = useState(1);

  const player = targetPlayerId ? roster[targetPlayerId] : undefined;
  const accentColor = targetPlayerId ? (playerColorMap[targetPlayerId] || '#8B8DB3') : '#8B8DB3';
  const isEliminated = player?.status === PlayerStatuses.ELIMINATED;

  const playerId = useGameStore(s => s.playerId);
  const me = playerId ? roster[playerId] : undefined;
  const mySilver = me?.silver ?? 0;

  function handleSendSilver() {
    if (!targetPlayerId || silverAmount < 1 || silverAmount > mySilver) return;
    engine.sendSilver(silverAmount, targetPlayerId);
    setShowSilverPicker(false);
    setSilverAmount(1);
  }

  function handleClose() {
    setShowSilverPicker(false);
    setSilverAmount(1);
    onClose();
  }

  return (
    <Drawer.Root open={!!targetPlayerId} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
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
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Player Actions</Drawer.Title>

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
          </div>

          {/* Content */}
          <div style={{ padding: '0 20px 24px' }}>
            {player && targetPlayerId && (
              <>
                {/* Player identity row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      borderRadius: '50%',
                      padding: 3,
                      border: `3px solid ${accentColor}`,
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    <PersonaAvatar
                      avatarUrl={player.avatarUrl}
                      personaName={player.personaName}
                      size={64}
                      eliminated={isEliminated}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 700,
                        color: accentColor,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {player.personaName}
                    </div>

                    {/* Status badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 4,
                        padding: '2px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'var(--vivid-font-display)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        ...(isEliminated
                          ? {
                              background: 'rgba(255,46,99,0.2)',
                              color: 'var(--vivid-pink)',
                              textDecoration: 'line-through',
                            }
                          : {
                              background: 'rgba(34,197,94,0.15)',
                              color: '#22c55e',
                            }),
                      }}
                    >
                      {isEliminated ? 'ELIMINATED' : 'ALIVE'}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Dollar size={16} weight="BoldDuotone" color="var(--vivid-gold)" />
                    <span
                      style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--vivid-gold)',
                      }}
                    >
                      {player.silver ?? 0}
                    </span>
                  </div>
                  {player.gold != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Dollar size={16} weight="BoldDuotone" color="var(--vivid-gold)" />
                      <span
                        style={{
                          fontFamily: 'var(--vivid-font-mono)',
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--vivid-gold)',
                        }}
                      >
                        {player.gold} gold
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Whisper */}
                  <button
                    onClick={() => { onWhisper(targetPlayerId); handleClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 18px',
                      borderRadius: 9999,
                      background: 'rgba(78,205,196,0.15)',
                      border: 'none',
                      color: 'var(--vivid-teal)',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <ChatDots size={18} weight="Bold" />
                    Whisper
                  </button>

                  {/* Send Silver */}
                  <button
                    onClick={() => setShowSilverPicker(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 18px',
                      borderRadius: 9999,
                      background: 'rgba(255,217,61,0.15)',
                      border: 'none',
                      color: 'var(--vivid-gold)',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <Dollar size={18} weight="Bold" />
                    Send Silver
                  </button>

                  {/* Profile */}
                  <button
                    onClick={() => { onViewProfile(targetPlayerId); handleClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 18px',
                      borderRadius: 9999,
                      background: 'rgba(167,139,250,0.15)',
                      border: 'none',
                      color: 'var(--vivid-lavender)',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <UserCircle size={18} weight="Bold" />
                    Profile
                  </button>
                </div>

                {/* Inline silver picker */}
                {showSilverPicker && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: 'var(--vivid-bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      max={mySilver}
                      value={silverAmount}
                      onChange={e => setSilverAmount(Math.max(1, Math.min(mySilver, Number(e.target.value) || 1)))}
                      style={{
                        width: 80,
                        padding: '6px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'var(--vivid-bg-deep)',
                        color: 'var(--vivid-text)',
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 700,
                        fontSize: 14,
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSendSilver}
                      disabled={mySilver < 1}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 9999,
                        background: mySilver < 1 ? 'var(--vivid-text-dim)' : 'var(--vivid-gold)',
                        border: 'none',
                        color: '#1a1b3a',
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: mySilver < 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Send
                    </button>
                    <button
                      onClick={() => { setShowSilverPicker(false); setSilverAmount(1); }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 9999,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--vivid-text-dim)',
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
