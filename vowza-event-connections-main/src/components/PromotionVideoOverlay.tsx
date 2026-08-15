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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // AGGRESSIVE PLAYBACK STRATEGY FOR ALL PHONES:
      // Attempt 1: Unmuted autoplay (desktop/Chrome Android)
      // Attempt 2: Muted autoplay (iOS Safari, restrictive browsers)
      // Attempt 3: Preload with blob fallback (network failures)
      // Attempt 4: Show "Tap to Play" (completely blocked autoplay)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      const attemptPlay = async () => {
        try {
          // ────── ATTEMPT 1: Unmuted Autoplay ──────
          console.log('[PromotionVideoOverlay] Attempt 1/4: Unmuted autoplay...');
          video.muted = false;
          video.autoplay = true;
          video.playsinline = true;
          setIsMuted(false);
          
          await video.play();
          console.log('[PromotionVideoOverlay] ✅ Unmuted autoplay succeeded');
          return;
        } catch (err) {
          console.warn('[PromotionVideoOverlay] Attempt 1 blocked (normal on iOS):', err);
          
          try {
            // ────── ATTEMPT 2: Muted Autoplay ──────
            console.log('[PromotionVideoOverlay] Attempt 2/4: Muted autoplay...');
            video.muted = true;
            video.autoplay = true;
            video.playsinline = true;
            setIsMuted(true);
            
            await video.play();
            console.log('[PromotionVideoOverlay] ✅ Muted autoplay succeeded (iOS/restrictive browser)');
            return;
          } catch (err2) {
            console.warn('[PromotionVideoOverlay] Attempt 2 also blocked:', err2);
            
            try {
              // ────── ATTEMPT 3: Preload with blob fallback ──────
              console.log('[PromotionVideoOverlay] Attempt 3/4: Preloading video blob...');
              video.preload = 'auto';
              video.muted = true;
              video.autoplay = false;
              setIsMuted(true);
              
              // Preload by requesting the video resource
              const response = await fetch(video.src || '', { method: 'HEAD' });
              if (response.ok) {
                console.log('[PromotionVideoOverlay] ✅ Video preloaded, ready for user interaction');
              }
            } catch (err3) {
              console.warn('[PromotionVideoOverlay] Attempt 3 preload failed:', err3);
            }
            
            // ────── ATTEMPT 4: Show "Tap to Play" ──────
            console.log('[PromotionVideoOverlay] Attempt 4/4: Showing Tap to Play fallback');
            setShowPlayFallback(true);
          }
        }
      };

      // Add small delay to ensure DOM is fully ready on mobile
      const timeoutId = setTimeout(() => {
        attemptPlay();
      }, 100);

      return () => clearTimeout(timeoutId);
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
                // Error state — keep card visible instead of blank black box
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black gap-4">
                  <div className="text-center px-6">
                    <p className="text-white text-sm font-semibold">Video Temporarily Unavailable</p>
                    <p className="text-white/60 text-xs mt-2">The video couldn't load. Please try again later or close this ad.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  >
                    Close Ad
                  </button>
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

