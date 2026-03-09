import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { ChatDots } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface ChatPeekProps {
  children: React.ReactNode; // The chat content to show in the sheet
}

export function ChatPeek({ children }: ChatPeekProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating pill button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed z-40 flex items-center gap-1.5"
        style={{
          top: 128,
          right: 16,
          padding: '8px 14px',
          borderRadius: 20,
          background: 'var(--vivid-teal)',
          color: '#fff',
          fontFamily: 'var(--vivid-font-display)',
          fontWeight: 800,
          fontSize: 13,
          boxShadow: '0 4px 16px rgba(78, 205, 196, 0.35)',
          border: 'none',
          cursor: 'pointer',
        }}
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.8, x: 20 }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.bouncy}
      >
        <ChatDots size={18} weight="Bold" />
        Chat
      </motion.button>

      {/* Bottom sheet drawer */}
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-0 z-50"
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{
              height: '70dvh',
              borderRadius: '24px 24px 0 0',
              background: 'var(--vivid-bg-surface)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            aria-describedby={undefined}
          >
            <Drawer.Title className="sr-only">Chat</Drawer.Title>

            {/* Drag handle */}
            <div className="flex justify-center py-3 shrink-0">
              <div
                className="rounded-full"
                style={{
                  width: 40,
                  height: 4,
                  background: 'rgba(255, 255, 255, 0.2)',
                }}
              />
            </div>

            {/* Chat content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
