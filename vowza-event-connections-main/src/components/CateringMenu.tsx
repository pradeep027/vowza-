import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Utensils, Users, Leaf, Star, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function CateringMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-catering-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('catering_packages' as any).select('*, catering_gallery(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-catering-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-catering-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBookNow = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    toast.info('Catering booking coming soon');
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This caterer has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Catering Packages</h2>
        <p className="text-sm text-muted-foreground">Browse menus and book your perfect feast.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const sections: { name: string; items: any[] }[] = pkg.menu_sections ?? [];
          const isOpen = expanded[pkg.id];
          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white">
              <div className="h-28 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                {(() => {
                  const cover = (pkg.catering_gallery ?? []).find((g: any) => g.is_cover);
                  return cover ? <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center"><Utensils className="h-10 w-10 text-[#8b1538]/30" /></div>;
                })()}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-foreground">{pkg.name}</h3>
                  <div className="text-right">
                    <p className="text-lg font-bold">₹{Number(pkg.price_per_plate).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">per plate</p>
                  </div>
                </div>

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

                {/* Menu preview */}
                {sections.length > 0 && !isOpen && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {sections.slice(0, 2).map((sec, i) => (
                      <p key={i}><span className="font-semibold">{sec.name}:</span> {sec.items.slice(0, 3).map(it => it.name).join(', ')}{sec.items.length > 3 && '…'}</p>
                    ))}
                  </div>
                )}

                {/* Full menu expanded */}
                {isOpen && sections.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-xl bg-secondary/50 p-3">
                    {sections.map((sec, i) => (
                      <div key={i}>
                        <p className="text-xs font-bold text-[#62132d]">{sec.name}</p>
                        <ul className="ml-2 mt-1">
                          {sec.items.map((item: any, ii: number) => (
                            <li key={ii} className="flex items-center gap-1 text-xs">
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>{item.name}</span>
                              {item.is_bestseller && <Star className="h-3 w-3 text-amber-500" />}
                              {item.is_premium && <span className="text-[10px] text-[#8b1538]">Premium</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {sections.length > 0 && (
                    <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1">
                      {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Menu</> : <><ChevronDown className="h-3 w-3" />View Full Menu</>}
                    </button>
                  )}
                  <button onClick={() => handleBookNow(pkg)} className={`rounded-xl bg-[#8B1538] py-2 text-xs font-semibold text-white ${sections.length === 0 ? 'col-span-2' : ''}`}>
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
