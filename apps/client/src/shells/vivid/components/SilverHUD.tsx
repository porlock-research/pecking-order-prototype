import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { VIVID_SPRING } from '../springs';

interface HUDNotification {
  id: string;
  senderName: string;
  amount: number;
  timestamp: number;
}

/**
 * Floating HUD notifications for silver received.
 * Stacks newest on top, auto-dismiss after 3s.
 * Tapping opens notifications panel.
 */
export function SilverHUD() {
  const [notifications, setNotifications] = useState<HUDNotification[]>([]);
  const prevSilver = useRef<number | null>(null);
  const prevRoster = useRef<Record<string, any>>({});
  const toggleDashboard = useGameStore(s => s.toggleDashboard);

  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const tickerMessages = useGameStore(s => s.tickerMessages);

  // Track silver transfers via ticker messages (silver category)
  const lastTickerCount = useRef(0);

  useEffect(() => {
    if (!playerId) return;

    const newMessages = tickerMessages.slice(lastTickerCount.current);
    lastTickerCount.current = tickerMessages.length;

    for (const msg of newMessages) {
      // Check for silver transfer messages involving the player
      if (msg.category === 'SOCIAL.TRANSFER') {
        const text = msg.text;
        // Pattern: "X sent Y silver to Z" — check if current player is the recipient
        const myName = roster[playerId]?.personaName;
        if (myName && text.toLowerCase().includes(myName.toLowerCase()) && !text.startsWith(myName)) {
          // Extract sender name and amount from the ticker text
          const match = text.match(/^(.+?) sent (\d+) silver/i);
          if (match) {
            const senderName = match[1];
            const amount = parseInt(match[2], 10);
            const id = `${msg.id}-${Date.now()}`;
            setNotifications(prev => [{ id, senderName, amount, timestamp: Date.now() }, ...prev].slice(0, 5));
          }
        }
      }
    }
  }, [tickerMessages, playerId, roster]);

  // Auto-dismiss after 3s
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(60px, env(safe-area-inset-top, 60px))',
        left: 16,
        right: 16,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={VIVID_SPRING.bouncy}
            onClick={() => {
              dismiss(notif.id);
              toggleDashboard();
            }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 14,
              background: 'rgba(250, 243, 232, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 150, 10, 0.2)',
              boxShadow: '0 4px 20px rgba(61, 46, 31, 0.12)',
              cursor: 'pointer',
            }}
          >
            {/* Coin icon */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5D020, #D4960A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(212, 150, 10, 0.3)',
            }}>
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 14,
                fontWeight: 800,
                color: '#FFFFFF',
              }}>
                $
              </span>
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 14,
                fontWeight: 700,
                color: '#3D2E1F',
              }}>
                {notif.senderName}
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 14,
                color: '#5A4A3A',
                marginLeft: 4,
              }}>
                sent you
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 14,
                fontWeight: 800,
                color: '#D4960A',
                marginLeft: 4,
              }}>
                {notif.amount} silver
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
