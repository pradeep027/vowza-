import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image as ImageIcon, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthPromotionMedia } from '@/hooks/useAuthPromotionMedia';
import type { VendorPackagePromotion, HomepagePromotionSlotNumber } from '@/integrations/supabase/auth-promo';
import { PHOTO_DURATION_MS, nextPlaylistIndex } from '@/lib/promotionMediaPlaylist';

// Helper function to format price in Indian Rupee format
const formatPrice = (price: number | undefined | null): string | null => {
  if (price === null || price === undefined || isNaN(price)) return null;
  return `₹${price.toLocaleString('en-IN')}`;
};

// Helper function to extract price from package record
const extractPackagePrice = (packageData: any): number | null => {
  if (!packageData) return null;
  
  // Try different price field names in order of preference
  if (packageData.package_price) return packageData.package_price;
  if (packageData.starting_price) return packageData.starting_price;
  if (packageData.price_per_plate) return packageData.price_per_plate;
  if (packageData.price) return packageData.price;
  if (packageData.full_day_price) return packageData.full_day_price;
  if (packageData.hourly_rate) return packageData.hourly_rate;
  
  return null;
};

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
 * Image Carousel Card — 3-second auto-rotating image carousel
 * Displays vendor/package info and Book Now button for exact bookings
 */
const ImageCarouselCard = memo(
  ({ media, slot, loading }: { media: VendorPackagePromotion[]; slot: HomepagePromotionSlotNumber; loading: boolean }) => {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState<Set<string>>(new Set());
    const [priceMap, setPriceMap] = useState<Record<string, string | null>>({});

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

    // Fetch prices for all promotions in this carousel
    useEffect(() => {
      const fetchPrices = async () => {
        const newPriceMap: Record<string, string | null> = {};
        
        for (const item of playable) {
          if (!item.package_id || !item.package_table) {
            newPriceMap[item.id] = null;
            continue;
          }

          try {
            const { data, error } = await supabase
              .from(item.package_table)
              .select('*')
              .eq('id', item.package_id)
              .single();

            if (error || !data) {
              newPriceMap[item.id] = null;
            } else {
              const price = extractPackagePrice(data);
              newPriceMap[item.id] = formatPrice(price);
            }
          } catch (err) {
            console.error('[AuthPromotionMediaCards] Price fetch error:', err);
            newPriceMap[item.id] = null;
          }
        }
        
        setPriceMap(newPriceMap);
      };

      if (playable.length > 0) {
        void fetchPrices();
      }
    }, [playable]);

    // Auto-rotate every 3 seconds (PHOTO_DURATION_MS)
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

    const handleCardClick = () => {
      if (!current?.provider_id) return;
      // Navigate to exact vendor profile with package_id query param if available
      const url = `/provider/${current.provider_id}${current.package_id ? `?package=${current.package_id}` : ''}`;
      navigate(url);
    };

    const handleBookNow = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!current?.provider_id) return;
      // Navigate to vendor profile with package_id query param - booking will be initiated from there
      const url = `/provider/${current.provider_id}${current.package_id ? `?package=${current.package_id}` : ''}`;
      navigate(url);
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
              alt={`Vowza homepage promotion: ${current.vendor_name || 'Vendor'}`}
              className="absolute inset-0 h-full w-full object-cover bg-black/25 brightness-[1.08]"
              loading="eager"
              decoding="async"
              onError={failedCurrent}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/5" />
            
            {/* Vendor/Package Info Overlay */}
            {current.vendor_name && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="absolute inset-0 flex flex-col items-start justify-end p-4 pointer-events-none"
              >
                <h3 className="text-sm font-bold text-white mb-1 leading-tight">
                  {current.vendor_name}
                </h3>
                {current.package_name && (
                  <p className="text-xs text-white/80 mb-1 leading-tight">
                    {current.package_name}
                  </p>
                )}
                {priceMap[current.id] && (
                  <p className="text-sm font-semibold text-white mb-3 leading-tight">
                    {priceMap[current.id]}
                  </p>
                )}
                
                {/* Book Now Button */}
                <motion.button
                  type="button"
                  onClick={handleBookNow}
                  onMouseDown={(e) => e.stopPropagation()}
                  whileHover={{ scale: 1.05, translateY: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#f4d58d] to-[#e6c76a] text-sm font-semibold text-[#3d1924] hover:shadow-lg transition-shadow"
                >
                  Book Now
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </>
        ) : (
          <Fallback loading={loading} />
        )}
      </Frame>
    );
  },
);
ImageCarouselCard.displayName = 'ImageCarouselCard';

const groupBySlot = (items: VendorPackagePromotion[]) => {
  const result: Record<HomepagePromotionSlotNumber, VendorPackagePromotion[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };
  for (const item of items)
    if (item.slot_number && item.slot_number >= 1 && item.slot_number <= 4)
      result[item.slot_number].push(item);
  return result;
};

/**
 * Homepage Image Carousel — 2×2 grid of auto-rotating image carousels
 * Displays vendor/package promotions with clickable cards and Book Now buttons
 * Each card represents an exact vendor + package combination for booking
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
