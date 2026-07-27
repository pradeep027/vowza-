import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { _registerInactivityWarning, _unregisterInactivityWarning, stayLoggedIn } from '@/hooks/useInactivityLogout';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Non-blocking inactivity warning banner — replaces the old browser confirm() dialog.
 * Mount once inside AppContent.
 */
const InactivityWarning = () => {
  const [visible, setVisible] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    _registerInactivityWarning(setVisible);
    return () => _unregisterInactivityWarning();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="inactivity-warning"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-sm"
        >
          <div className="bg-card border border-gold/40 rounded-2xl shadow-elevated px-4 py-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Still there?</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                You'll be logged out in 5&nbsp;minutes due to inactivity.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={stayLoggedIn}
                  className="h-8 px-3 text-xs bg-gradient-gold text-foreground hover:opacity-90">
                  <RefreshCw className="w-3 h-3 mr-1.5" />Stay Logged In
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setVisible(false); signOut(); }}
                  className="h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/5">
                  <LogOut className="w-3 h-3 mr-1.5" />Log Out
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InactivityWarning;
