import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Video, Check, ShoppingCart, X, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import ScopedCartBar from '@/components/ScopedCartBar';

type PackageSource = 'photography' | 'videography' | 'combined';

interface UnifiedPackage {
  id: string;
  name: string;
  type: 'photography_only' | 'videography_only' | 'photography_and_videography';
  source: PackageSource;
  price: number;
  duration?: string;
  description?: string;
  image_url?: string;
  team_size?: number;
  highlights: string[];
  specs: Record<string, any>;
  provider_id: string;
}

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function UnifiedPhotographyVideographyMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedType, setSelectedType] = useState<'all' | 'photography' | 'videography' | 'combined'>('all');
  const [detailPackage, setDetailPackage] = useState<UnifiedPackage | null>(null);

  // Fetch photography packages
  const { data: photoPackages = [], isLoading: photoLoading } = useQuery({
    queryKey: ['public-photography-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('photography_packages' as any)
        .select('*, photography_package_images(*), photography_package_highlights(*), photography_package_addons(*), photography_albums(*)')
        .eq('photographer_id', provider.id)
        .eq('is_active', true)
        .eq('is_visible', true)
        .eq('status', 'published')
        .order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
    enabled: provider.profession === 'photographer' || provider.profession === 'photography_videography',
  });

  // Fetch videography packages
  const { data: videoPackages = [], isLoading: videoLoading } = useQuery({
    queryKey: ['public-videography-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('videography_packages' as any)
        .select('*, videography_gallery(*)')
        .eq('provider_id', provider.id)
        .eq('status', 'active')
        .order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
    enabled: provider.profession === 'videographer' || provider.profession === 'photography_videography',
  });

  // Fetch combined packages (if applicable)
  const { data: combinedPackages = [], isLoading: combinedLoading } = useQuery({
    queryKey: ['public-combined-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('photography_videography_packages' as any)
        .select('*, photography_videography_package_images(*), photography_videography_package_addons(*)')
        .eq('provider_id', provider.id)
        .eq('is_active', true)
        .eq('is_visible', true)
        .eq('status', 'published')
        .order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
    enabled: provider.profession === 'photography_videography',
  });

  // Set up realtime subscriptions
  useEffect(() => {
    const channels = [];
    
    if (provider.profession === 'photographer' || provider.profession === 'photography_videography') {
      const photoChannel = supabase
        .channel(`public-photography-${provider.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'photography_packages', filter: `photographer_id=eq.${provider.id}` }, () => 
          qc.invalidateQueries({ queryKey: ['public-photography-packages', provider.id] }))
        .subscribe();
      channels.push(photoChannel);
    }

    if (provider.profession === 'videographer' || provider.profession === 'photography_videography') {
      const videoChannel = supabase
        .channel(`public-videography-${provider.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'videography_packages', filter: `provider_id=eq.${provider.id}` }, () =>
          qc.invalidateQueries({ queryKey: ['public-videography-packages', provider.id] }))
        .subscribe();
      channels.push(videoChannel);
    }

    if (provider.profession === 'photography_videography') {
      const combinedChannel = supabase
        .channel(`public-combined-${provider.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'photography_videography_packages', filter: `provider_id=eq.${provider.id}` }, () =>
          qc.invalidateQueries({ queryKey: ['public-combined-packages', provider.id] }))
        .subscribe();
      channels.push(combinedChannel);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [provider.id, provider.profession]);

  // Convert photography packages to unified format
  const normalizedPhotoPackages: UnifiedPackage[] = photoPackages.map((p: any) => ({
    id: `photo-${p.id}`,
    name: p.name,
    type: 'photography_only',
    source: 'photography',
    price: Number(p.price),
    duration: p.duration,
    description: p.description,
    image_url: (p.photography_package_images ?? []).find((x: any) => x.is_cover)?.public_url || (p.photography_package_images?.[0]?.public_url),
    team_size: p.team_size_custom || p.team_size,
    highlights: (p.photography_package_highlights ?? []).slice(0, 3).map((h: any) => h.text),
    specs: {
      photography_type: p.photography_type,
      edited_photos: p.edited_photos,
      raw_photos_included: p.raw_photos_included,
      travel_included: p.travel_included,
      travel_radius_km: p.travel_radius_km,
      delivery_time: p.delivery_time,
    },
    provider_id: provider.id,
  }));

  // Convert videography packages to unified format
  const normalizedVideoPackages: UnifiedPackage[] = videoPackages.map((p: any) => ({
    id: `video-${p.id}`,
    name: p.name,
    type: 'videography_only',
    source: 'videography',
    price: Number(p.starting_price || p.package_price || 0),
    duration: p.coverage_hours,
    description: p.description,
    image_url: (p.videography_gallery ?? []).find((g: any) => g.is_cover)?.public_url || (p.videography_gallery?.[0]?.public_url),
    team_size: (p.team_videographers ?? 0) + (p.team_assistants ?? 0) + (p.team_drone_operator ? 1 : 0),
    highlights: (p.included_services ?? []).slice(0, 3),
    specs: {
      team_videographers: p.team_videographers,
      team_assistants: p.team_assistants,
      team_drone_operator: p.team_drone_operator,
      coverage_hours: p.coverage_hours,
      included_services: p.included_services,
      deliverables: p.deliverables,
      delivery_time: p.delivery_time,
      equipment: p.equipment,
      editing_options: p.editing_options,
    },
    provider_id: provider.id,
  }));

  // Convert combined packages to unified format
  const normalizedCombinedPackages: UnifiedPackage[] = combinedPackages.map((p: any) => ({
    id: `combined-${p.id}`,
    name: p.name,
    type: p.package_type as any,
    source: 'combined',
    price: Number(p.price),
    duration: p.duration,
    description: p.description,
    image_url: (p.photography_videography_package_images ?? []).find((x: any) => x.is_cover)?.public_url || (p.photography_videography_package_images?.[0]?.public_url),
    team_size: undefined,
    highlights: [],
    specs: p,
    provider_id: provider.id,
  }));

  // Combine and filter by selected type
  const allPackages = [...normalizedPhotoPackages, ...normalizedVideoPackages, ...normalizedCombinedPackages];
  const filteredPackages = selectedType === 'all' 
    ? allPackages 
    : allPackages.filter(pkg => {
        if (selectedType === 'photography') return pkg.type === 'photography_only';
        if (selectedType === 'videography') return pkg.type === 'videography_only';
        if (selectedType === 'combined') return pkg.type === 'photography_and_videography';
        return true;
      });

  const isLoading = photoLoading || videoLoading || combinedLoading;

  const handleAddToCart = async (pkg: UnifiedPackage) => {
    if (!user) {
      toast.error('Please log in to continue');
      return nav('/auth');
    }

    const bookingTable = pkg.source === 'photography' 
      ? 'photography_package_bookings'
      : pkg.source === 'videography'
      ? 'videography_bookings'
      : 'photography_videography_package_bookings';

    addToCart({
      packageId: pkg.id,
      providerId: provider.id,
      providerName: profile?.full_name || 'Artist',
      category: 'photography-videography',
      packageTable: pkg.source === 'photography' ? 'photography_packages' : pkg.source === 'videography' ? 'videography_packages' : 'photography_videography_packages',
      bookingTable,
      packageName: pkg.name,
      price: pkg.price,
      duration: pkg.duration,
      imageUrl: pkg.image_url,
    });
    toast.success('Added to cart!');
  };

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!filteredPackages.length) return (
    <div className="rounded-2xl border bg-surface-1 p-10 text-center text-sm text-muted-foreground">
      This vendor has not published any {selectedType === 'all' ? 'packages' : selectedType} packages yet.
    </div>
  );

  // Type filter badges
  const hasPhotoPackages = normalizedPhotoPackages.length > 0;
  const hasVideoPackages = normalizedVideoPackages.length > 0;
  const hasCombinedPackages = normalizedCombinedPackages.length > 0;

  const getTypeIcon = (type: string) => {
    if (type === 'photography_only') return '📸';
    if (type === 'videography_only') return '🎥';
    if (type === 'photography_and_videography') return '📸🎥';
    return '📦';
  };

  const getTypeLabel = (type: string) => {
    if (type === 'photography_only') return 'Photography';
    if (type === 'videography_only') return 'Videography';
    if (type === 'photography_and_videography') return 'Photography + Videography';
    return 'Package';
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">
          {provider.profession === 'photography_videography' ? '📸🎥 Photography & Videography Packages' : '📦 Packages'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {provider.profession === 'photography_videography'
            ? 'Explore our professional photography and videography services with flexible package options.'
            : 'Browse available packages and book your perfect service.'}
        </p>
      </div>

      {/* Type Filter */}
      {allPackages.length > 0 && (hasPhotoPackages || hasVideoPackages || hasCombinedPackages) && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              selectedType === 'all'
                ? 'bg-[#8B1538] text-white'
                : 'border border-[#e7d9c4] bg-white text-[#3d1924] hover:bg-secondary'
            }`}
          >
            All Packages ({allPackages.length})
          </button>
          {hasPhotoPackages && (
            <button
              onClick={() => setSelectedType('photography')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedType === 'photography'
                  ? 'bg-[#8B1538] text-white'
                  : 'border border-[#e7d9c4] bg-white text-[#3d1924] hover:bg-secondary'
              }`}
            >
              📸 Photography ({normalizedPhotoPackages.length})
            </button>
          )}
          {hasVideoPackages && (
            <button
              onClick={() => setSelectedType('videography')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedType === 'videography'
                  ? 'bg-[#8B1538] text-white'
                  : 'border border-[#e7d9c4] bg-white text-[#3d1924] hover:bg-secondary'
              }`}
            >
              🎥 Videography ({normalizedVideoPackages.length})
            </button>
          )}
          {hasCombinedPackages && (
            <button
              onClick={() => setSelectedType('combined')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedType === 'combined'
                  ? 'bg-[#8B1538] text-white'
                  : 'border border-[#e7d9c4] bg-white text-[#3d1924] hover:bg-secondary'
              }`}
            >
              📸🎥 Combined ({normalizedCombinedPackages.length})
            </button>
          )}
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredPackages.map((pkg) => (
          <div
            key={pkg.id}
            className="overflow-hidden rounded-2xl border bg-surface-1 transition hover:shadow-md"
          >
            {/* Image */}
            <div className="h-44 bg-secondary overflow-hidden">
              {pkg.image_url ? (
                <img src={pkg.image_url} alt={pkg.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl">
                  {pkg.type === 'photography_only' ? '📸' : pkg.type === 'videography_only' ? '🎥' : '📸🎥'}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {getTypeIcon(pkg.type)} {getTypeLabel(pkg.type)}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground">{pkg.name}</h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-[#8B1538]">
                    ₹{pkg.price.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {pkg.description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
              )}

              {/* Quick specs */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {pkg.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {pkg.duration}
                  </span>
                )}
                {pkg.team_size && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {pkg.team_size} team
                  </span>
                )}
              </div>

              {/* Highlights */}
              {pkg.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pkg.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Expandable details */}
              {Object.keys(pkg.specs).length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => toggle(pkg.id)}
                    className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-[#8B1538] py-1 hover:bg-secondary/50 rounded-lg transition"
                  >
                    {expanded[pkg.id] ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Less Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        More Details
                      </>
                    )}
                  </button>

                  {expanded[pkg.id] && (
                    <div className="mt-3 space-y-2 rounded-xl bg-secondary/50 p-3 text-xs">
                      {pkg.source === 'photography' && (
                        <>
                          <div><b>Type:</b> {pkg.specs.photography_type}</div>
                          <div><b>Edited Photos:</b> {pkg.specs.edited_photos === null ? 'Unlimited' : pkg.specs.edited_photos}</div>
                          {pkg.specs.raw_photos_included && <div><b>Raw Files:</b> Included</div>}
                          {pkg.specs.travel_included && <div><b>Travel:</b> {pkg.specs.travel_radius_km} km included</div>}
                          <div><b>Delivery:</b> {pkg.specs.delivery_time}</div>
                        </>
                      )}
                      {pkg.source === 'videography' && (
                        <>
                          {pkg.specs.coverage_hours && <div><b>Coverage:</b> {pkg.specs.coverage_hours}</div>}
                          {pkg.specs.team_videographers && <div><b>Videographers:</b> {pkg.specs.team_videographers}</div>}
                          {pkg.specs.team_drone_operator && <div><b>Drone:</b> Available</div>}
                          {pkg.specs.delivery_time && <div><b>Delivery:</b> {pkg.specs.delivery_time}</div>}
                        </>
                      )}
                      {pkg.source === 'combined' && (
                        <>
                          {pkg.specs.duration && <div><b>Duration:</b> {pkg.specs.duration}</div>}
                          {pkg.specs.photography_team_size && <div><b>Photo Team:</b> {pkg.specs.photography_team_size}</div>}
                          {pkg.specs.videography_team_videographers && <div><b>Video Team:</b> {pkg.specs.videography_team_videographers}</div>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddToCart(pkg)}
                  disabled={isInCart(pkg.id, 'photography-videography')}
                  className="rounded-xl border border-[#8B1538] py-2 text-xs font-semibold text-[#8B1538] transition hover:bg-[#8B1538]/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <ShoppingCart className="h-3 w-3" />
                  {isInCart(pkg.id, 'photography-videography') ? 'In Cart' : 'Add to Cart'}
                </button>
                <button
                  onClick={() => setDetailPackage(pkg)}
                  className="rounded-xl border py-2 text-xs font-semibold transition hover:bg-secondary"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      <ScopedCartBar providerId={provider.id} category="photography-videography" />

      {/* Detail Modal */}
      {detailPackage && (
        <DetailModal
          pkg={detailPackage}
          onClose={() => setDetailPackage(null)}
          onAddToCart={() => {
            handleAddToCart(detailPackage);
            setDetailPackage(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Detail Modal ─────────────────────────────────────────────────────────── */
function DetailModal({
  pkg,
  onClose,
  onAddToCart,
}: {
  pkg: UnifiedPackage;
  onClose: () => void;
  onAddToCart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
        {/* Image */}
        {pkg.image_url && (
          <img src={pkg.image_url} alt={pkg.name} className="h-64 w-full object-cover" />
        )}

        {/* Content */}
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {getDetailTypeLabel(pkg.type)}
              </p>
              <h2 className="text-2xl font-bold">{pkg.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-white p-2 shadow-lg hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-lg font-bold text-[#8B1538]">
            ₹{pkg.price.toLocaleString('en-IN')}
          </p>

          {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}

          {/* Full details */}
          <div className="rounded-xl bg-secondary p-4 space-y-2 text-sm">
            {pkg.source === 'photography' && (
              <>
                <div className="flex justify-between"><span>Type:</span><b>{pkg.specs.photography_type}</b></div>
                <div className="flex justify-between"><span>Team Size:</span><b>{pkg.specs.team_size} members</b></div>
                <div className="flex justify-between"><span>Edited Photos:</span><b>{pkg.specs.edited_photos === null ? 'Unlimited' : pkg.specs.edited_photos}</b></div>
                {pkg.specs.raw_photos_included && <div className="flex justify-between"><span>Raw Files:</span><b>Included</b></div>}
                {pkg.specs.travel_included && <div className="flex justify-between"><span>Travel Included:</span><b>{pkg.specs.travel_radius_km} km</b></div>}
                <div className="flex justify-between"><span>Delivery Time:</span><b>{pkg.specs.delivery_time}</b></div>
              </>
            )}
            {pkg.source === 'videography' && (
              <>
                {pkg.specs.coverage_hours && <div className="flex justify-between"><span>Coverage:</span><b>{pkg.specs.coverage_hours}</b></div>}
                {pkg.specs.team_videographers && <div className="flex justify-between"><span>Videographers:</span><b>{pkg.specs.team_videographers}</b></div>}
                {pkg.specs.team_assistants && <div className="flex justify-between"><span>Assistants:</span><b>{pkg.specs.team_assistants}</b></div>}
                {pkg.specs.team_drone_operator && <div><b>🚁 Drone Operator Available</b></div>}
                {pkg.specs.delivery_time && <div className="flex justify-between"><span>Delivery:</span><b>{pkg.specs.delivery_time}</b></div>}
              </>
            )}
            {pkg.source === 'combined' && (
              <>
                {pkg.specs.duration && <div className="flex justify-between"><span>Duration:</span><b>{pkg.specs.duration}</b></div>}
                {pkg.specs.photography_team_size && <div className="flex justify-between"><span>Photo Team:</span><b>{pkg.specs.photography_team_size}</b></div>}
                {pkg.specs.videography_team_videographers && <div className="flex justify-between"><span>Video Team:</span><b>{pkg.specs.videography_team_videographers}</b></div>}
              </>
            )}
          </div>

          {/* Highlights */}
          {pkg.highlights.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Key Features</h3>
              <ul className="space-y-1">
                {pkg.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 border-t pt-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border py-3 text-sm font-semibold transition hover:bg-secondary"
            >
              Close
            </button>
            <button
              onClick={onAddToCart}
              className="flex-1 rounded-xl bg-[#8B1538] py-3 text-sm font-semibold text-white transition hover:bg-[#70102d]"
            >
              <ShoppingCart className="h-4 w-4 inline mr-2" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDetailTypeLabel(type: string): string {
  if (type === 'photography_only') return '📸 Photography Package';
  if (type === 'videography_only') return '🎥 Videography Package';
  if (type === 'photography_and_videography') return '📸🎥 Combined Photography & Videography Package';
  return '📦 Package';
}
