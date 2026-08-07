import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, Clock, Users, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function VideographyMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-videography-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('videography_packages' as any)
        .select('*')
        .eq('provider_id', provider.id)
        .eq('status', 'active')
        .order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`public-videography-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'videography_packages',
        filter: `provider_id=eq.${provider.id}`,
      }, () => qc.invalidateQueries({ queryKey: ['public-videography-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const handleBookNow = () => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    toast.info('Videography booking coming soon');
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return (
    <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">
      This videographer has not published any packages yet.
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Videography Packages</h2>
        <p className="text-sm text-muted-foreground">Browse packages and book your perfect cinematic experience.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const teamSize = (pkg.team_videographers ?? 0) + (pkg.team_assistants ?? 0) + (pkg.team_drone_operator ?? 0);
          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                <Video className="h-10 w-10 text-[#8b1538]/30" />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-foreground">{pkg.name}</h3>
                  <div className="text-right">
                    <p className="text-lg font-bold">₹{Number(pkg.starting_price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">starting</p>
                  </div>
                </div>

                {pkg.description && (
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{pkg.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {pkg.coverage_hours && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {pkg.coverage_hours} {pkg.coverage_hours !== 'Full Day' ? 'hrs' : ''}
                    </span>
                  )}
                  {teamSize > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />{teamSize} crew
                    </span>
                  )}
                  {pkg.delivery_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />Delivery: {pkg.delivery_time}
                    </span>
                  )}
                </div>

                {/* Included services badges */}
                {(pkg.included_services ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(pkg.included_services as string[]).map((s: string) => (
                      <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">
                        <Check className="h-2.5 w-2.5" />{s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Book Now */}
                <div className="mt-4">
                  <button onClick={handleBookNow}
                    className="w-full rounded-xl bg-[#8B1538] py-2.5 text-xs font-semibold text-white transition hover:bg-[#70102d]">
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
