import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Utensils, Users, Leaf, Star, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Images, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import CateringBookingModal from '@/components/CateringBookingModal';
import ScopedCartBar from '@/components/ScopedCartBar';

/* ─── Lightbox Component ──────────────────────────────────────────────────── */
function GalleryLightbox({ images, startIndex, onClose }: { images: { url: string; alt?: string }[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  // Touch swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const diff = touchStart.current - touchEnd.current;
    const threshold = 50;
    if (diff > threshold) next();
    else if (diff < -threshold) prev();
    touchStart.current = null;
    touchEnd.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close gallery">
          <X className="h-6 w-6" />
        </button>

        {/* Counter */}
        <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
          {index + 1} / {images.length}
        </div>

        {/* Prev */}
        {images.length > 1 && (
          <button onClick={prev} className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:left-6" aria-label="Previous image">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div className="flex h-[80vh] w-full max-w-4xl items-center justify-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <img
            src={images[index].url}
            alt={images[index].alt || 'Gallery image'}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl transition-all duration-300"
            draggable={false}
          />
        </div>

        {/* Next */}
        {images.length > 1 && (
          <button onClick={next} className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:right-6" aria-label="Next image">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 overflow-x-auto rounded-xl bg-black/40 p-2 backdrop-blur-sm max-w-[90vw]">
            {images.map((img, i) => (
              <button key={i} onClick={() => setIndex(i)}
                className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Package Gallery Grid ────────────────────────────────────────────────── */
function PackageGallery({ gallery, packageName }: { gallery: any[]; packageName: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allImages = gallery
    .filter((g: any) => !g.is_cover)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((g: any) => ({ url: g.public_url, alt: `${packageName} gallery` }));

  if (allImages.length === 0) return null;

  return (
    <>
      <div className="mt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Images className="h-3.5 w-3.5 text-[#8b1538]" />
          <span className="text-xs font-semibold text-[#4b1d2b]">Gallery</span>
          <span className="text-xs text-muted-foreground">({allImages.length})</span>
        </div>
        {/* Desktop: grid, Mobile: horizontal scroll */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {allImages.slice(0, 4).map((img, i) => (
            <button key={i} onClick={() => setLightboxIndex(i)}
              className="relative aspect-square overflow-hidden rounded-lg border border-border/40 transition hover:opacity-90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#8b1538]/30">
              <img src={img.url} alt={img.alt} className="h-full w-full object-cover" loading="lazy" />
              {/* Show remaining count on last visible thumbnail */}
              {i === 3 && allImages.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-sm">
                  +{allImages.length - 4}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <GalleryLightbox images={allImages} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function CateringMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [coverLightbox, setCoverLightbox] = useState<{ url: string; name: string } | null>(null);

  // Booking modal state
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingMenuSections, setBookingMenuSections] = useState<any[]>([]);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-catering-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('catering_packages' as any).select('*, catering_gallery(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      const pkgs = r.data ?? [];

      // Fetch menu sections, items, and addons for each package
      for (const pkg of pkgs) {
        const secRes = await supabase.from('catering_menu_sections' as any)
          .select('id, name, sort_order').eq('package_id', pkg.id).order('sort_order');
        const sections: any[] = [];
        if (secRes.data && secRes.data.length > 0) {
          for (const sec of secRes.data) {
            const itemRes = await supabase.from('catering_menu_items' as any)
              .select('name, is_veg, is_premium, is_bestseller').eq('section_id', sec.id).order('sort_order');
            sections.push({ name: sec.name, items: itemRes.data ?? [] });
          }
        }
        pkg._menuSections = sections;

        const addonRes = await supabase.from('catering_addons' as any)
          .select('id, name, price, description').eq('package_id', pkg.id).order('sort_order');
        pkg._addons = addonRes.data ?? [];

        // Parse plate includes from cancellation_policy JSON
        try { pkg._plateIncludes = JSON.parse(pkg.cancellation_policy || '[]'); } catch { pkg._plateIncludes = []; }
      }

      return pkgs;
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-catering-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-catering-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBookNow = async (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }

    // Use pre-fetched menu sections and addons from the query
    setBookingMenuSections(pkg._menuSections ?? []);
    setBookingAddons(pkg._addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This caterer has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Catering Packages</h2>
        <p className="text-sm text-muted-foreground">Browse menus and book your perfect feast.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const sections: { name: string; items: any[] }[] = pkg._menuSections ?? [];
          const plateIncludes: { section: string; quantity: string }[] = pkg._plateIncludes ?? [];
          const pkgAddons: any[] = pkg._addons ?? [];
          const isOpen = expanded[pkg.id];
          const gallery: any[] = pkg.catering_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              {/* Large Cover Photo */}
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                {cover ? (
                  <button
                    onClick={() => setCoverLightbox({ url: cover.public_url, name: pkg.name })}
                    className="w-full h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#8b1538]/30 group"
                    aria-label={`View ${pkg.name} cover photo`}
                  >
                    <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition">
                      Click to enlarge
                    </span>
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Utensils className="h-12 w-12 text-[#8b1538]/20" />
                  </div>
                )}
                {/* Status badge on cover */}
                {pkg.is_featured && (
                  <span className="absolute top-3 left-3 rounded-full bg-[#f4d58d] px-2.5 py-0.5 text-[10px] font-bold text-[#62132d] shadow-sm">Featured</span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#8b1538]">₹{Number(pkg.price_per_plate).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">per plate</p>
                  </div>
                </div>

                {pkg.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                )}

                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />{pkg.min_guests}–{pkg.max_guests} guests
                </div>

                {/* Cuisine badges */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {pkg.is_veg && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"><Leaf className="h-3 w-3" />Veg</span>}
                  {pkg.is_nonveg && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Non-Veg</span>}
                  {pkg.is_jain && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Jain</span>}
                  {(pkg.cuisine_types ?? []).map((c: string) => (
                    <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c}</span>
                  ))}
                </div>

                {/* Service types */}
                {(pkg.service_types ?? []).length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{(pkg.service_types ?? []).join(' · ')}</p>
                )}

                {/* Image Gallery Grid */}
                <PackageGallery gallery={gallery} packageName={pkg.name} />

                {/* Plate Includes (always visible) */}
                {plateIncludes.filter(p => p.section).length > 0 && (
                  <div className="mt-3 rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1.5">Per Plate Includes</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {plateIncludes.filter(p => p.section).map((inc, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs text-emerald-800">
                          <Check className="h-3 w-3 text-emerald-600" />{inc.quantity} {inc.section}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menu preview (collapsed) */}
                {sections.length > 0 && !isOpen && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {sections.slice(0, 2).map((sec, i) => (
                      <p key={i}><span className="font-semibold">{sec.name}:</span> {sec.items.slice(0, 3).map(it => it.name).join(', ')}{sec.items.length > 3 && '…'}</p>
                    ))}
                  </div>
                )}

                {/* Full menu + addons (expanded) */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {sections.length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d]">Full Menu</p>
                        {sections.map((sec, i) => (
                          <div key={i}>
                            <p className="text-xs font-bold text-[#8b1538]">{sec.name}</p>
                            <ul className="ml-2 mt-1">
                              {sec.items.map((item: any, ii: number) => (
                                <li key={ii} className="flex items-center gap-1 text-xs">
                                  {item.is_veg ? <Leaf className="h-3 w-3 text-emerald-600" /> : <Check className="h-3 w-3 text-stone-400" />}
                                  <span>{item.name}</span>
                                  {item.is_bestseller && <Star className="h-3 w-3 text-amber-500" />}
                                  {item.is_premium && <span className="text-[9px] text-[#8b1538] font-bold">Premium</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add-ons */}
                    {pkgAddons.length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">Available Add-ons</p>
                        <div className="space-y-1">
                          {pkgAddons.map((addon: any) => (
                            <div key={addon.id} className="flex items-center justify-between text-xs">
                              <span className="text-stone-700">{addon.name}</span>
                              <span className="font-semibold text-amber-800">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Details</> : <><ChevronDown className="h-3 w-3" />View Details</>}
                  </button>
                  <button onClick={() => handleBookNow(pkg)} className="rounded-xl bg-[#8B1538] py-2 text-xs font-semibold text-white transition hover:bg-[#70102d]">
                    Book Now
                  </button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'catering', packageTable: 'catering_packages', bookingTable: 'catering_bookings', packageName: pkg.name, price: Number(pkg.price_per_plate || pkg.package_price || 0), duration: undefined, imageUrl: (pkg.catering_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'catering')}
                  className="mt-2 w-full rounded-xl border border-[#8b1538]/20 bg-[#8b1538]/5 py-2 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'catering') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cover photo lightbox */}
      {coverLightbox && (
        <GalleryLightbox
          images={[{ url: coverLightbox.url, alt: coverLightbox.name }]}
          startIndex={0}
          onClose={() => setCoverLightbox(null)}
        />
      )}

      <ScopedCartBar providerId={provider.id} category="catering" />
      {/* Catering Booking Modal */}
      {bookingPkg && (
        <CateringBookingModal
          isOpen={!!bookingPkg}
          onClose={() => setBookingPkg(null)}
          pkg={bookingPkg}
          provider={provider}
          gallery={bookingPkg.catering_gallery ?? []}
          menuSections={bookingMenuSections}
          addons={bookingAddons}
        />
      )}
    </div>
  );
}
