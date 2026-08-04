// VendorPackages — Premium service packages management with create/edit/delete
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Package, Plus, Edit3, Trash2, Star, Zap, Crown, Diamond,
  Check, IndianRupee, Clock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface ServicePackage {
  id: string; name: string; price: number; duration: string;
  description: string; deliverables: string[]; is_popular?: boolean;
  tier: 'silver' | 'gold' | 'premium' | 'luxury' | 'custom';
}

const TIER_CFG: Record<string, { icon: React.ElementType; gradient: string; label: string }> = {
  silver:  { icon: Package, gradient: 'from-gray-400 to-gray-600', label: 'Silver' },
  gold:    { icon: Star,    gradient: 'from-[#D4AF37] to-[#B8860B]', label: 'Gold' },
  premium: { icon: Crown,   gradient: 'from-[#8B1538] to-[#c2185b]', label: 'Premium' },
  luxury:  { icon: Diamond, gradient: 'from-purple-500 to-indigo-600', label: 'Luxury' },
  custom:  { icon: Zap,     gradient: 'from-teal-500 to-cyan-600', label: 'Custom' },
};

export default function VendorPackages() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', price: '', duration: '', description: '', deliverables: '', tier: 'gold' as string });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: provider } = await supabase
        .from('provider_profiles').select('id').eq('user_id', user.id).limit(1);
      if (provider && provider.length > 0) {
        const { data } = await supabase
          .from('pricing_packages' as any)
          .select('*')
          .eq('provider_id', provider[0].id)
          .order('price', { ascending: true });
        if (data) setPackages(data as any);
      }
      setLoading(false);
    })();
  }, [user]);

  // Fallback display packages
  const displayPackages: ServicePackage[] = packages.length > 0 ? packages : [
    { id: '1', name: 'Silver', price: 15000, duration: '4 hours', description: 'Basic coverage for intimate events', deliverables: ['50 edited photos', 'Online gallery', '1 photographer'], tier: 'silver' },
    { id: '2', name: 'Gold', price: 35000, duration: '8 hours', description: 'Complete coverage for medium events', deliverables: ['200 edited photos', '2 photographers', 'Pre-event shoot', 'Online gallery', 'Photo album'], is_popular: true, tier: 'gold' },
    { id: '3', name: 'Premium', price: 75000, duration: 'Full day', description: 'Premium coverage for grand celebrations', deliverables: ['500+ edited photos', '3 photographers', 'Drone shots', 'Cinematic video', 'Same-day edit', 'Premium album'], tier: 'premium' },
    { id: '4', name: 'Luxury', price: 150000, duration: '2 days', description: 'Luxury coverage for destination events', deliverables: ['Unlimited photos', '4 photographers', '2 videographers', 'Drone', 'Same-day edit', 'Premium album x2', 'Highlight reel', 'LED wall display'], tier: 'luxury' },
  ];

  const handleCreate = async () => {
    if (!form.name || !form.price) { toast.error('Name and price are required'); return; }
    const { data: provider } = await supabase.from('provider_profiles').select('id').eq('user_id', user!.id).limit(1);
    if (!provider || provider.length === 0) { toast.error('Provider profile not found'); return; }

    const pkg = {
      provider_id: provider[0].id,
      name: form.name,
      price: Number(form.price),
      duration: form.duration,
      description: form.description,
      deliverables: form.deliverables.split('\n').filter(Boolean),
      tier: form.tier,
    };

    const { data, error } = await supabase.from('pricing_packages' as any).insert(pkg).select();
    if (error) { toast.error(error.message); return; }
    if (data) setPackages(prev => [...prev, data[0] as any]);
    setShowCreate(false);
    setForm({ name: '', price: '', duration: '', description: '', deliverables: '', tier: 'gold' });
    toast.success('Package created!');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    await supabase.from('pricing_packages' as any).delete().eq('id', id);
    setPackages(prev => prev.filter(p => p.id !== id));
    toast.success('Package deleted');
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Services & Packages</h1>
          <p className="text-sm text-muted-foreground">Create pricing packages for your services</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
          <Plus className="w-4 h-4" /> Create Package
        </button>
      </div>

      {/* Package Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-6 animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-xl mb-4" />
              <div className="h-5 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-1/3 mb-4" />
              <div className="space-y-2">
                {[1,2,3].map(j => <div key={j} className="h-3 bg-muted rounded w-3/4" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {displayPackages.map(pkg => {
            const cfg = TIER_CFG[pkg.tier] || TIER_CFG.gold;
            return (
              <div key={pkg.id} className={cn('relative bg-white rounded-2xl border border-border/60 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300', pkg.is_popular && 'ring-2 ring-[#D4AF37] border-[#D4AF37]')}>
                {pkg.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-[#D4AF37] text-white px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4', cfg.gradient)}>
                  <cfg.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">{pkg.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold text-foreground">₹{pkg.price.toLocaleString('en-IN')}</span>
                  {pkg.duration && <span className="text-xs text-muted-foreground">/ {pkg.duration}</span>}
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{pkg.description}</p>
                <ul className="space-y-2 mb-5">
                  {pkg.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-4 border-t border-border/40">
                  <button className="flex-1 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-1">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Package Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-foreground">Create Package</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Package name (e.g. Gold)" className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <input value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="Price (₹)" type="number" className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <input value={form.duration} onChange={e => setForm(f => ({...f, duration: e.target.value}))} placeholder="Duration (e.g. 8 hours)" className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Description" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
              <textarea value={form.deliverables} onChange={e => setForm(f => ({...f, deliverables: e.target.value}))} placeholder="Deliverables (one per line)" rows={4} className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
              <select value={form.tier} onChange={e => setForm(f => ({...f, tier: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20">
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="premium">Premium</option>
                <option value="luxury">Luxury</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
