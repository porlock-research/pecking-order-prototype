import React, { useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';

type TabKey = 'comms' | 'people';

interface SwipeableTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: Record<TabKey, React.ReactNode>;
}

const TAB_ORDER: TabKey[] = ['comms', 'people'];
const LEFT_EDGE_IGNORE = 30; // px — avoid triggering iOS Safari back gesture

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

export function SwipeableTabs({ activeTab, onTabChange, children }: SwipeableTabsProps) {
  const directionRef = useRef(0);
  const currentIndex = TAB_ORDER.indexOf(activeTab);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      // Ignore swipes starting near the left edge (iOS back gesture zone)
      if (e.initial[0] < LEFT_EDGE_IGNORE) return;
      const next = currentIndex + 1;
      if (next < TAB_ORDER.length) {
        directionRef.current = 1;
        onTabChange(TAB_ORDER[next]);
      }
    },
    onSwipedRight: (e) => {
      if (e.initial[0] < LEFT_EDGE_IGNORE) return;
      const prev = currentIndex - 1;
      if (prev >= 0) {
        directionRef.current = -1;
        onTabChange(TAB_ORDER[prev]);
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  return (
    <div {...swipeHandlers} className="flex-1 overflow-hidden relative flex flex-col">
      <AnimatePresence initial={false} custom={directionRef.current} mode="popLayout">
        <motion.div
          key={activeTab}
          custom={directionRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 0.8,
          }}
          className="flex-1 flex flex-col overflow-hidden absolute inset-0"
        >
          {children[activeTab]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
