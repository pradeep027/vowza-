// ─── AI Floating Action Button ───────────────────────────────────────────────
// Global persistent button that opens/closes the AI Chat Panel from any page.
// Self-contained — mounts in App.tsx alongside the router.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import AIChatPanel from './AIChatPanel';

// ─── Tooltip label that appears beside the FAB ───────────────────────────────
const FloatingLabel = ({ visible }: { visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, x: 10, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 10, scale: 0.9 }}
        transition={{ duration: 0.18 }}
        className="absolute right-full mr-3 bottom-1 whitespace-nowrap"
      >
        <div className="bg-foreground text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-xl shadow-lg">
          Ask Vowza Planner ✨
          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0
            border-t-[5px] border-b-[5px] border-l-[6px]
            border-t-transparent border-b-transparent border-l-foreground" />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Notification dot (shows when AI has something for user) ─────────────────
const NotificationDot = () => (
  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-maroon border-2 border-background" />
);

// ─── Main component ───────────────────────────────────────────────────────────
const AIFloatingButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [hasUnread] = useState(true);
  const [prefillQuery, setPrefillQuery] = useState<string | undefined>(undefined);

  // Listen for the Hero "Vowza Planner" button custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent<{ query?: string }>).detail?.query;
      if (query) setPrefillQuery(query);
      setIsOpen(true);
    };
    window.addEventListener('vowza:open-planner', handler);
    return () => window.removeEventListener('vowza:open-planner', handler);
  }, []);

  const toggle = () => {
    setIsOpen(prev => !prev);
    setShowLabel(false);
  };

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center">
        <FloatingLabel visible={showLabel && !isOpen} />

        <motion.button
          onClick={toggle}
          onMouseEnter={() => !isOpen && setShowLabel(true)}
          onMouseLeave={() => setShowLabel(false)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="relative w-14 h-14 rounded-2xl bg-gradient-gold shadow-gold
            flex items-center justify-center overflow-hidden
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
          aria-label={isOpen ? 'Close AI planner' : 'Open AI event planner'}
          aria-expanded={isOpen}
        >
          {/* Animated shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
          />

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}>
                <X className="w-5 h-5 text-foreground" />
              </motion.div>
            ) : (
              <motion.div key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.18 }}>
                <Sparkles className="w-5 h-5 text-foreground" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notification dot */}
          {hasUnread && !isOpen && <NotificationDot />}
        </motion.button>
      </div>

      {/* Chat panel */}
      <AIChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} prefillQuery={prefillQuery} onPrefillConsumed={() => setPrefillQuery(undefined)} />
    </>
  );
};

export default AIFloatingButton;
