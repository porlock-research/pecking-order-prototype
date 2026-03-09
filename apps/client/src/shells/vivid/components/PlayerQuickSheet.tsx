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
  const accentColor = targetPlayerId ? (playerColorMap[targetPlayerId] || '#9B8E7E') : '#9B8E7E';
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
            background: 'rgba(61, 46, 31, 0.3)',
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            background: 'var(--vivid-bg-surface)',
            borderTop: '2px solid rgba(139, 115, 85, 0.1)',
            boxShadow: '0 -4px 24px rgba(139, 115, 85, 0.1)',
          }}
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Player Actions</Drawer.Title>

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(139, 115, 85, 0.2)' }} />
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
                        fontSize: 20,
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 800,
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
                              background: 'rgba(217, 64, 115, 0.1)',
                              color: '#D94073',
                              textDecoration: 'line-through',
                            }
                          : {
                              background: 'rgba(34,197,94,0.1)',
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(212, 150, 10, 0.08)',
                      borderRadius: 12,
                      padding: '4px 10px',
                    }}
                  >
                    <Dollar size={16} weight="BoldDuotone" color="#D4960A" />
                    <span
                      style={{
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#D4960A',
                      }}
                    >
                      {player.silver ?? 0}
                    </span>
                  </div>
                  {player.gold != null && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(139, 108, 193, 0.08)',
                        borderRadius: 12,
                        padding: '4px 10px',
                      }}
                    >
                      <Dollar size={16} weight="BoldDuotone" color="#8B6CC1" />
                      <span
                        style={{
                          fontFamily: 'var(--vivid-font-mono)',
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#8B6CC1',
                        }}
                      >
                        {player.gold} gold
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Whisper */}
                  <button
                    onClick={() => { onWhisper(targetPlayerId); handleClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 18px',
                      borderRadius: 9999,
                      background: '#3BA99C',
                      border: 'none',
                      color: '#FFFFFF',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 2px 8px rgba(59, 169, 156, 0.2)',
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
                      background: '#D4960A',
                      border: 'none',
                      color: '#FFFFFF',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 2px 8px rgba(212, 150, 10, 0.2)',
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
                      background: '#8B6CC1',
                      border: 'none',
                      color: '#FFFFFF',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 2px 8px rgba(139, 108, 193, 0.2)',
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
                      borderRadius: 16,
                      background: '#FFFFFF',
                      border: '1px solid rgba(139, 115, 85, 0.1)',
                      boxShadow: 'var(--vivid-surface-shadow)',
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
                        borderRadius: 10,
                        border: '2px solid rgba(139, 115, 85, 0.12)',
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
                        background: mySilver < 1 ? 'var(--vivid-text-dim)' : '#D4960A',
                        border: 'none',
                        color: '#FFFFFF',
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
