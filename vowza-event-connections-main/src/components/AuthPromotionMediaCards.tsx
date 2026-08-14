import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon } from 'lucide-react';
import { useAuthPromotionMedia } from '@/hooks/useAuthPromotionMedia';
import type { AuthPromotionMedia, HomepagePromotionSlotNumber } from '@/integrations/supabase/auth-promo';
import { PHOTO_DURATION_MS, nextPlaylistIndex } from '@/lib/promotionMediaPlaylist';

type MediaCardsVariant = 'desktop' | 'mobile';

const cardMotion = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

const Fallback = ({ loading }: { loading: boolean }) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_20%,rgba(185,28,28,0.48),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(245,158,11,0.25),transparent_42%),#11111a]">
    <div className="relative flex flex-col items-center gap-2 px-4 text-center text-white/65">
      <ImageIcon className="h-6 w-6 text-gold/80" />
      <span className="text-[11px] font-semibold tracking-wide">
        {loading ? 'Loading promotion media' : 'No image assigned'}
      </span>
    </div>
  </div>
);

const Frame = ({
  children,
  label,
  index,
}: {
  children: ReactNode;
  label: string;
  index: number;
}) => (
  <motion.div
    {...cardMotion}
    transition={{ ...cardMotion.transition, delay: 0.18 + index * 0.08 }}
    className="group relative min-h-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-xl"
    style={{ boxShadow: '0 16px 32px -18px rgba(0,0,0,.9)' }}
    aria-label={label}
  >
    {children}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        boxShadow:
          'inset 0 0 0 1.5px hsl(40 95% 62% / .55),0 0 18px 2px hsl(40 95% 56% / .18)',
      }}
    />
  </motion.div>
);

/**
 * Image Carousel Card — 10-second auto-rotating image carousel
 * Used for all four homepage promotion slots (image-only)
 */
const ImageCarouselCard = memo(
  ({ media, slot, loading }: { media: AuthPromotionMedia[]; slot: HomepagePromotionSlotNumber; loading: boolean }) => {
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState<Set<string>>(new Set());

    const playable = useMemo(
      () => media.filter((item) => item.media_type === 'image' && !failed.has(item.id)),
      [media, failed],
    );

    const signature = media.map((item) => `${item.id}:${item.media_url}`).join('|');

    // Reset index and failed set when media changes
    useEffect(() => {
      setIndex(0);
      setFailed(new Set());
    }, [signature]);

    // Auto-rotate every 10 seconds (PHOTO_DURATION_MS)
    useEffect(() => {
      if (playable.length < 2) return;

      const timer = window.setInterval(
        () => setIndex((value) => (value + 1) % playable.length),
        PHOTO_DURATION_MS,
      );

      return () => window.clearInterval(timer);
    }, [playable.length, signature]);

    const current = playable[index % Math.max(playable.length, 1)];

    const failedCurrent = () => {
      if (!current) return;
      setFailed((value) => new Set(value).add(current.id));
      setIndex(0);
    };

    return (
      <Frame label={`Homepage promotion slot ${slot}: image carousel`} index={slot - 1}>
        {current ? (
          <>
            <motion.img
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              src={current.media_url}
              alt={`Vowza homepage promotion image ${slot}`}
              className="absolute inset-0 h-full w-full object-cover bg-black/25 brightness-[1.08]"
              loading="eager"
              decoding="async"
              onError={failedCurrent}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5" />
          </>
        ) : (
          <Fallback loading={loading} />
        )}
      </Frame>
    );
  },
);
ImageCarouselCard.displayName = 'ImageCarouselCard';

const groupBySlot = (items: AuthPromotionMedia[]) => {
  const result: Record<HomepagePromotionSlotNumber, AuthPromotionMedia[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };
  for (const item of items)
    if (item.slot_number >= 1 && item.slot_number <= 4)
      result[item.slot_number].push(item);
  return result;
};

/**
 * Homepage Image Carousel — 2×2 grid of auto-rotating image carousels
 * Replaces the former video + image system with image-only carousel
 * All four slots rotate images every 10 seconds
 */
const AuthPromotionMediaCards = ({ variant }: { variant: MediaCardsVariant }) => {
  const { media, isLoading } = useAuthPromotionMedia();
  const slots = useMemo(() => groupBySlot(media), [media]);
  const desktop = variant === 'desktop';

  return (
    <div className={desktop ? 'h-[390px] pl-6 pr-4 pb-4' : 'mt-4'}>
      <div
        className={`grid ${desktop ? 'h-full' : 'aspect-[1.1/1]'} grid-cols-2 grid-rows-2 gap-3`}
        aria-label="Vowza homepage promotion media"
      >
        <ImageCarouselCard media={slots[1]} slot={1} loading={isLoading} />
        <ImageCarouselCard media={slots[2]} slot={2} loading={isLoading} />
        <ImageCarouselCard media={slots[3]} slot={3} loading={isLoading} />
        <ImageCarouselCard media={slots[4]} slot={4} loading={isLoading} />
      </div>
    </div>
  );
};

export default memo(AuthPromotionMediaCards);
