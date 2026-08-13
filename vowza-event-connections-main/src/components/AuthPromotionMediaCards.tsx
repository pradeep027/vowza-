import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Video } from 'lucide-react';
import { useAuthPromotionMedia } from '@/hooks/useAuthPromotionMedia';
import type { AuthPromotionMedia, HomepagePromotionSlotNumber } from '@/integrations/supabase/auth-promo';
import { PHOTO_DURATION_MS, nextPlaylistIndex } from '@/lib/promotionMediaPlaylist';

type MediaCardsVariant = 'desktop' | 'mobile';

const cardMotion = { initial: { opacity: 0, y: 16, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } };
const Fallback = ({ type, loading }: { type: 'photo' | 'video'; loading: boolean }) => <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_20%,rgba(185,28,28,0.48),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(245,158,11,0.25),transparent_42%),#11111a]"><div className="relative flex flex-col items-center gap-2 px-4 text-center text-white/65">{type === 'video' ? <Video className="h-6 w-6 text-gold/80" /> : <ImageIcon className="h-6 w-6 text-gold/80" />}<span className="text-[11px] font-semibold tracking-wide">{loading ? 'Loading promotion media' : `No playable ${type} assigned`}</span></div></div>;
const Frame = ({ children, label, index }: { children: ReactNode; label: string; index: number }) => <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.18 + index * 0.08 }} className="group relative min-h-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-xl" style={{ boxShadow: '0 16px 32px -18px rgba(0,0,0,.9)' }} aria-label={label}>{children}<div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: 'inset 0 0 0 1.5px hsl(40 95% 62% / .55),0 0 18px 2px hsl(40 95% 56% / .18)' }} /></motion.div>;

/**
 * The only owner of the homepage promotion video. Playback is guarded by the
 * current React Router path, browser visibility/focus, and a request token.
 */
const VideoPromotionCard = memo(({ media, loading, isHomepage }: { media: AuthPromotionMedia[]; loading: boolean; isHomepage: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const mountedRef = useRef(false);
  const routeIsHomepageRef = useRef(isHomepage);
  const inactiveRef = useRef(typeof document !== 'undefined' && (document.visibilityState !== 'visible' || !document.hasFocus()));
  const mutedRef = useRef(false);
  const playRequestRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const playable = useMemo(() => media.filter((item) => item.media_type === 'video' && !failed.has(item.id)), [media, failed]);
  const current = playable[index % Math.max(playable.length, 1)];
  const currentId = current?.id;
  const signature = media.map((item) => `${item.id}:${item.media_url}`).join('|');

  const updateMuted = useCallback((nextMuted: boolean) => {
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
  }, []);

  /** Stops the physical media and invalidates every pending play() continuation. */
  const stopVideo = useCallback((video: HTMLVideoElement | null, releaseSource = false) => {
    playRequestRef.current += 1;
    if (!video) return;
    video.pause();
    video.muted = true;
    if (releaseSource) {
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  const mayPlay = useCallback((video: HTMLVideoElement | null) => Boolean(
    video
    && mountedRef.current
    && routeIsHomepageRef.current
    && !inactiveRef.current
    && document.visibilityState === 'visible'
    && document.hasFocus()
    && videoRef.current === video,
  ), []);

  const startVideo = useCallback(async (video: HTMLVideoElement | null = activeVideoRef.current) => {
    if (!mayPlay(video)) return;

    const request = ++playRequestRef.current;
    const isCurrentRequest = () => mayPlay(video) && playRequestRef.current === request;
    video.muted = mutedRef.current;

    try {
      await video.play();
      if (!isCurrentRequest()) stopVideo(video);
    } catch {
      // Respect autoplay policy. There is no secondary Audio() object and no
      // global interaction listener that can restart playback later.
      if (!isCurrentRequest()) return;
      video.muted = true;
      try {
        await video.play();
        if (!isCurrentRequest()) stopVideo(video);
        else updateMuted(true);
      } catch {
        // Keep the promotional frame visible when browser policy blocks media.
      }
    }
  }, [mayPlay, stopVideo, updateMuted]);

  useEffect(() => { setIndex(0); setFailed(new Set()); }, [signature]);

  // Router path is an explicit playback precondition, even though the current
  // route tree also unmounts the homepage on navigation away from '/'.
  useEffect(() => {
    routeIsHomepageRef.current = isHomepage;
    if (!isHomepage) {
      stopVideo(activeVideoRef.current);
      return;
    }
    void startVideo(activeVideoRef.current);
  }, [isHomepage, startVideo, stopVideo]);

  useEffect(() => {
    mountedRef.current = true;

    const becomeInactive = () => {
      inactiveRef.current = true;
      stopVideo(activeVideoRef.current);
    };
    const resumeIfEligible = () => {
      inactiveRef.current = document.visibilityState !== 'visible' || !document.hasFocus();
      if (!inactiveRef.current) void startVideo(activeVideoRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') becomeInactive();
      else resumeIfEligible();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', becomeInactive);
    window.addEventListener('pageshow', resumeIfEligible);
    window.addEventListener('blur', becomeInactive);
    window.addEventListener('focus', resumeIfEligible);

    return () => {
      mountedRef.current = false;
      routeIsHomepageRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', becomeInactive);
      window.removeEventListener('pageshow', resumeIfEligible);
      window.removeEventListener('blur', becomeInactive);
      window.removeEventListener('focus', resumeIfEligible);
      stopVideo(activeVideoRef.current, true);
      activeVideoRef.current = null;
    };
  }, [startVideo, stopVideo]);

  useEffect(() => {
    if (!currentId) return;
    const video = videoRef.current;
    if (!video) return;
    activeVideoRef.current = video;
    void startVideo(video);
    return () => {
      stopVideo(video);
      if (activeVideoRef.current === video) activeVideoRef.current = null;
    };
  }, [currentId, startVideo, stopVideo]);

  const advance = useCallback(() => setIndex((value) => nextPlaylistIndex(value, playable.length)), [playable.length]);
  const failedCurrent = useCallback(() => {
    if (!current) return;
    stopVideo(activeVideoRef.current);
    setFailed((value) => new Set(value).add(current.id));
    setIndex(0);
  }, [current, stopVideo]);

  if (!current) return <Frame label="Homepage promotion slot 1: video playlist" index={0}><Fallback type="video" loading={loading} /></Frame>;
  return <Frame label="Homepage promotion slot 1: video playlist" index={0}><div className="absolute inset-0 flex items-center justify-center bg-black cursor-pointer" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play(); } else { v.pause(); } }}><video ref={videoRef} key={current.id} className="h-full w-full object-contain brightness-[1.08]" src={current.media_url} muted={muted} loop={playable.length === 1} playsInline preload="metadata" controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture onContextMenu={(event) => event.preventDefault()} onEnded={advance} onError={failedCurrent} aria-label="Vowza promotional video" /></div><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" /></Frame>;
});
VideoPromotionCard.displayName = 'VideoPromotionCard';

const PhotoPromotionCard = memo(({ media, slot, loading }: { media: AuthPromotionMedia[]; slot: 2 | 3 | 4; loading: boolean }) => {
  const [index, setIndex] = useState(0); const [failed, setFailed] = useState<Set<string>>(new Set());
  const playable = useMemo(() => media.filter((item) => item.media_type === 'image' && !failed.has(item.id)), [media, failed]);
  const signature = media.map((item) => `${item.id}:${item.media_url}`).join('|');
  useEffect(() => { setIndex(0); setFailed(new Set()); }, [signature]);
  useEffect(() => { if (playable.length < 2) return; const timer = window.setInterval(() => setIndex((value) => (value + 1) % playable.length), PHOTO_DURATION_MS); return () => window.clearInterval(timer); }, [playable.length, signature]);
  const current = playable[index % Math.max(playable.length, 1)];
  const failedCurrent = () => { if (!current) return; setFailed((value) => new Set(value).add(current.id)); setIndex(0); };
  return <Frame label={`Homepage promotion slot ${slot}: photo slideshow`} index={slot - 1}>{current ? <><motion.img key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }} src={current.media_url} alt={`Vowza homepage promotion ${slot}`} className="absolute inset-0 h-full w-full object-contain bg-black/25 brightness-[1.08]" loading="eager" decoding="async" onError={failedCurrent} /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5" /></> : <Fallback type="photo" loading={loading} />}</Frame>;
});
PhotoPromotionCard.displayName = 'PhotoPromotionCard';

const groupBySlot = (items: AuthPromotionMedia[]) => {
  const result: Record<HomepagePromotionSlotNumber, AuthPromotionMedia[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const item of items) if (item.slot_number >= 1 && item.slot_number <= 4) result[item.slot_number].push(item);
  return result;
};
/** One authoritative four-card renderer: video playlist #1 and independent 10-second photo slideshows #2–4. */
const AuthPromotionMediaCards = ({ variant }: { variant: MediaCardsVariant }) => {
  const { pathname } = useLocation();
  const { media, isLoading } = useAuthPromotionMedia();
  const slots = useMemo(() => groupBySlot(media), [media]);
  const desktop = variant === 'desktop';
  return <div className={desktop ? 'h-[390px] pl-6 pr-4 pb-4' : 'mt-4'}><div className={`grid ${desktop ? 'h-full' : 'aspect-[1.1/1]'} grid-cols-2 grid-rows-2 gap-3`} aria-label="Vowza homepage promotion media"><VideoPromotionCard media={slots[1]} loading={isLoading} isHomepage={pathname === '/'} /><PhotoPromotionCard media={slots[2]} slot={2} loading={isLoading} /><PhotoPromotionCard media={slots[3]} slot={3} loading={isLoading} /><PhotoPromotionCard media={slots[4]} slot={4} loading={isLoading} /></div></div>;
};
export default memo(AuthPromotionMediaCards);
