import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { PromotionVideoWithViewStatus } from '@/integrations/supabase/promotion-videos';

interface PromotionVideoOverlayProps {
  video: PromotionVideoWithViewStatus;
  onClose: () => void;
  onViewRecorded?: () => void;
}

/**
 * Promotion Video Overlay Component
 * Displays promotional videos as a modern app-style overlay advertisement.
 * Features:
 * - Responsive positioning (top-left, top-right, bottom-left, bottom-right)
 * - Close button (X) that immediately stops playback
 * - Browser-safe autoplay (muted by default)
 * - User can unmute if desired
 * - No overlap with critical UI elements
 */
const PromotionVideoOverlay = memo(
  ({ video, onClose, onViewRecorded }: PromotionVideoOverlayProps) => {
    console.log('[PromotionVideoOverlay] Component rendering with video:', video.id);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Stop video on close
    const handleClose = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.muted = true;
        videoRef.current.currentTime = 0;
      }
      onClose();
    };

    // Toggle mute
    const handleToggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    // Notify when view is recorded (after initial play)
    const handlePlayStart = () => {
      if (!isPlaying) {
        setIsPlaying(true);
        onViewRecorded?.();
      }
    };

    // Auto-play on mount (muted to respect browser policy)
    useEffect(() => {
      if (videoRef.current && !hasError) {
        videoRef.current.muted = true;
        videoRef.current.play().catch((err) => {
          console.error('[PromotionVideoOverlay] Autoplay failed:', err);
          setHasError(true);
        });
      }
    }, [hasError]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.muted = true;
        }
      };
    }, []);

    // Map display_position to Tailwind classes
    const positionClasses = {
      'top-left': 'top-4 left-4',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-right': 'bottom-4 right-4',
    }[video.display_position];

    return (
      <>
        {/* DEBUG: Render indicator */}
        <div style={{position: 'fixed', top: '10px', right: '10px', background: 'yellow', padding: '10px', zIndex: 99999, fontSize: '12px'}}>
          Video Overlay Active
        </div>
        
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`fixed ${positionClasses} z-[9999] max-w-sm pointer-events-auto`}
          >
          {/* Main overlay container */}
          <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl border border-white/10">
            {/* Video aspect ratio container (16:9) */}
            <div className="aspect-video relative overflow-hidden bg-black">
              {hasError ? (
                // Fallback if video fails to load
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black gap-3">
                  <div className="text-white/70 text-center px-4">
                    <p className="text-sm font-semibold">Video Unavailable</p>
                    <p className="text-xs text-white/50 mt-1">Please try again later</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Video element */}
                  <video
                    ref={videoRef}
                    src={video.video_url}
                    muted={isMuted}
                    playsInline
                    preload="metadata"
                    controlsList="nodownload noplaybackrate nofullscreen"
                    disablePictureInPicture
                    onPlay={handlePlayStart}
                    onError={() => {
                      console.error('[PromotionVideoOverlay] Video playback error');
                      setHasError(true);
                    }}
                    className="absolute inset-0 w-full h-full object-contain"
                    aria-label="Vowza promotional video"
                  />

                  {/* Dark gradient overlay for controls visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

                  {/* Controls group */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    {/* Mute/Unmute button */}
                    <motion.button
                      type="button"
                      onClick={handleToggleMute}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13.5 4.06c0-1.336-1.616-2.318-2.67-1.732l-5.814 3.345A2 2 0 004 6.969V19.03a2 2 0 001.016 1.75l5.814 3.345c1.054.586 2.67-.396 2.67-1.732V4.06zM16.5 12a2.5 2.5 0 010 5m5-2.5a6.5 6.5 0 010-13" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13.5 4.06c0-1.336-1.616-2.318-2.67-1.732l-5.814 3.345A2 2 0 004 6.969V19.03a2 2 0 001.016 1.75l5.814 3.345c1.054.586 2.67-.396 2.67-1.732V4.06zM16.5 12a2.5 2.5 0 010 5m5-2.5a6.5 6.5 0 010-13" />
                        </svg>
                      )}
                    </motion.button>
                  </div>
                </>
              )}
            </div>

            {/* Close button (X) — always visible */}
            <motion.button
              type="button"
              onClick={handleClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
              aria-label="Close promotion video"
            >
              <X className="w-4 h-4 text-white" />
            </motion.button>

            {/* Info bar */}
            <div className="px-4 py-2 bg-gradient-to-r from-maroon/90 to-maroon/70 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white/90">Promotional Content</p>
              <p className="text-[10px] text-white/70 mt-0.5">
                {video.unique_users_reached} / {video.user_limit} viewers
              </p>
            </div>
          </div>

          {/* Desktop info tooltip */}
          <div className="mt-2 text-xs text-white/50 hidden sm:block px-2">
            <p>Click X to close • Hover to unmute</p>
          </div>
        </motion.div>
        </AnimatePresence>
      </>
    );
  },
);

PromotionVideoOverlay.displayName = 'PromotionVideoOverlay';

export default PromotionVideoOverlay;
