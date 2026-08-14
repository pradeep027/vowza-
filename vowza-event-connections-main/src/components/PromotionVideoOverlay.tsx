import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Volume2, VolumeX } from 'lucide-react';
import type { PromotionVideoWithViewStatus } from '@/integrations/supabase/promotion-videos';

interface PromotionVideoOverlayProps {
  video: PromotionVideoWithViewStatus;
  onClose: () => void;
  onViewRecorded?: () => void;
}

/**
 * Promotion Video Overlay Component
 * Displays promotional videos as a professional app-style overlay advertisement.
 * 
 * Features:
 * - Responsive sizing: desktop (400-450px), mobile (full width - 24px)
 * - Autoplay with smart fallback (unmuted → muted → tap-to-play)
 * - Clean UI: no internal analytics shown to customers
 * - Mobile-safe: respects viewport, safe-area insets
 * - Close button: always accessible
 */
const PromotionVideoOverlay = memo(
  ({ video, onClose, onViewRecorded }: PromotionVideoOverlayProps) => {
    console.log('[PromotionVideoOverlay] Rendering video:', {
      id: video.id,
      display_position: video.display_position,
    });
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showPlayFallback, setShowPlayFallback] = useState(false);
    const autoplayAttemptedRef = useRef(false);

    // ─────────────────────────────────────────────────────────────────────────
    // Autoplay Strategy
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Attempt unmuted autoplay
    // 2. If browser blocks unmuted → fallback to muted
    // 3. If browser blocks both → show "Tap to Play" button
    // 4. User tap → start with sound enabled
    // ─────────────────────────────────────────────────────────────────────────

    const handleClose = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      onClose();
    };

    const handlePlayFallback = async () => {
      if (!videoRef.current) return;
      
      console.log('[PromotionVideoOverlay] User tapping play button');
      setShowPlayFallback(false);
      videoRef.current.muted = false;
      setIsMuted(false);
      
      try {
        await videoRef.current.play();
      } catch (err) {
        console.error('[PromotionVideoOverlay] Play on tap failed:', err);
      }
    };

    const handleToggleMute = async () => {
      if (!videoRef.current) return;
      
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      
      if (!newMutedState && !isPlaying) {
        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('[PromotionVideoOverlay] Unmute play failed:', err);
        }
      }
    };

    const handlePlayStart = () => {
      if (!isPlaying) {
        console.log('[PromotionVideoOverlay] Video started playing');
        setIsPlaying(true);
        onViewRecorded?.();
      }
    };

    // Attempt autoplay on mount with intelligent fallback
    useEffect(() => {
      if (!videoRef.current || hasError || autoplayAttemptedRef.current) return;

      autoplayAttemptedRef.current = true;
      const video = videoRef.current;

      // Strategy: Try unmuted first, then muted, then show fallback
      const attemptPlay = async () => {
        try {
          // First attempt: unmuted autoplay
          console.log('[PromotionVideoOverlay] Attempting unmuted autoplay...');
          video.muted = false;
          setIsMuted(false);
          await video.play();
          console.log('[PromotionVideoOverlay] ✅ Unmuted autoplay succeeded');
          return;
        } catch (err) {
          console.warn('[PromotionVideoOverlay] Unmuted autoplay blocked, trying muted...');
          
          try {
            // Fallback: muted autoplay
            video.muted = true;
            setIsMuted(true);
            await video.play();
            console.log('[PromotionVideoOverlay] ✅ Muted autoplay succeeded');
            return;
          } catch (err2) {
            console.warn('[PromotionVideoOverlay] Muted autoplay also blocked, showing play button');
            // Final fallback: show "Tap to Play" button
            setShowPlayFallback(true);
          }
        }
      };

      attemptPlay();
    }, [hasError]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      };
    }, []);

    // Map display_position to Tailwind classes
    const positionClasses = {
      'top-left': 'top-4 left-4 sm:top-6 sm:left-6',
      'top-right': 'top-4 right-4 sm:top-6 sm:right-6',
      'bottom-left': 'bottom-4 left-4 sm:bottom-6 sm:left-6',
      'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
    }[video.display_position];

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`fixed ${positionClasses} z-[9999] w-[calc(100vw-24px)] sm:w-96 md:w-[500px] lg:w-[600px] pointer-events-auto safe-area-inset`}
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
                    onError={(e) => {
                      console.error('[PromotionVideoOverlay] Video error:', videoRef.current?.error?.message);
                      setHasError(true);
                    }}
                    className="absolute inset-0 w-full h-full object-contain"
                    aria-label="Promotional video"
                  />

                  {/* Dark gradient overlay for controls visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

                  {/* Controls on hover (desktop) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/20 pointer-events-none">
                    {/* Mute/Unmute button (hover) */}
                    <motion.button
                      type="button"
                      onClick={handleToggleMute}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </motion.button>
                  </div>

                  {/* Tap to Play fallback (mobile friendly) */}
                  {showPlayFallback && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                      <motion.button
                        type="button"
                        onClick={handlePlayFallback}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
                        aria-label="Play video"
                      >
                        <Play className="w-8 h-8 text-white fill-white" />
                      </motion.button>
                      <p className="text-white text-sm mt-4 font-medium">Tap to Play</p>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Info bar - REMOVED viewer count (internal admin metric only) */}
            <div className="px-4 py-3 bg-gradient-to-r from-maroon/90 to-maroon/70 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white">Exclusive Promotion</p>
            </div>
          </div>

          {/* Close button (X) — positioned for mobile accessibility */}
          <motion.button
            type="button"
            onClick={handleClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center justify-center w-8 h-8 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </motion.button>

          {/* Desktop info tooltip */}
          <div className="mt-2 text-xs text-white/50 hidden sm:block px-2">
            <p>Unmute to hear sound</p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

PromotionVideoOverlay.displayName = 'PromotionVideoOverlay';

export default PromotionVideoOverlay;

