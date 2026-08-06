// VendorPackages — 100% real packages from pricing_packages with live booking metrics.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, Plus, Edit3, Trash2, Star, Zap, Crown, Diamond,
  Check, X, TrendingUp,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorPackages } from '@/hooks/useVendorData';
import WaterProductsManager from './WaterProductsManager';

const TIER_CFG: Record<string, { icon: React.ElementType; gradient: string }> = {
  silver:  { icon: Package, gradient: 'from-gray-400 to-gray-600' },
  gold:    { icon: Star,    gradient: 'from-[#D4AF37] to-[#B8860B]' },
  premium: { icon: Crown,   gradient: 'from-[#8B1538] to-[#c2185b]' },
  luxury:  { icon: Diamond, gradient: 'from-purple-500 to-indigo-600' },
  custom:  { icon: Zap,     gradient: 'from-teal-500 to-cyan-600' },
};

const EMPTY_FORM = {
  id: '', name: '', price: '', duration: '',
  description: '', deliverables: '', tier: 'gold',
};

export default function VendorPackages() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data, isLoading } = useVendorPackages(vendorId);
  const packages     = data?.packages     ?? [];
  const mostPopular  = data?.mostPopular  ?? null;
  const totalBookings = data?.totalBookings ?? 0;

  // Water Suppliers use a product catalogue. All other professions retain
  // the original Services & Packages experience below without any changes.
  if (provider?.profession === 'water_supplier') {
    return <WaterProductsManager provider={provider} />;
  }

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name ?? '',
      price: String(p.price ?? ''),
      duration: p.duration ?? '',
      description: p.description ?? '',
      deliverables: Array.isArray(p.deliverables) ? p.deliverables.join('\n') : '',
      tier: p.tier ?? 'gold',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!vendorId) return;
    if (!form.name.trim())              { toast.error('Package name is required'); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error('Enter a valid price'); return; }

    setBusy(true);
    const payload = {
      provider_id:  vendorId,
      name:         form.name.trim(),
      price:        Number(form.price),
      duration:     form.duration.trim() || null,
      description:  form.description.trim() || null,
      deliverables: form.deliverables.split('\n').map(s => s.trim()).filter(Boolean),
      tier:         form.tier,
      is_active:    true,
    };

    const { error } = form.id
      ? await supabase.from('pricing_packages' as any).update(payload).eq('id', form.id)
      : await supabase.from('pricing_packages' as any).insert(payload);

    if (error) toast.error(error.message);
    else {
      toast.success(form.id ? 'Package updated' : 'Package created');
      setModalOpen(false);
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ['vendor-packages'] });
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this package? Existing bookings are not affected.')) return;
    const { error } = await supabase.from('pricing_packages' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Package deleted');
    qc.invalidateQueries({ queryKey: ['vendor-packages'] });
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Services &amp; Packages</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…'
              : packages.length === 0 ? 'No packages created yet'
              : `${packages.length} package${packages.length === 1 ? '' : 's'} · ${totalBookings} total booking${totalBookings === 1 ? '' : 's'}`}
          </p>
        </div>
        <button onClick={openCreate} disabled={!vendorId}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
          <Plus className="w-4 h-4" /> Create Package
        </button>
      </div>

      {/* Most popular banner — only when real bookings exist */}
      {mostPopular && Number(mostPopular.booking_count ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-[#D4AF37]/10 to-[#8B1538]/5 border border-[#D4AF37]/20 rounded-2xl p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
          <p className="text-sm text-foreground">
            <strong>{mostPopular.name}</strong> is your most-booked package with{' '}
            {mostPopular.booking_count} booking{Number(mostPopular.booking_count) === 1 ? '' : 's'}
            {mostPopular.sharePct > 0 && ` (${mostPopular.sharePct}% of all package bookings)`}.
          </p>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-6 animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-xl mb-4" />
              <div className="h-5 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-1/3 mb-4" />
              <div className="space-y-2">{[1,2,3].map(j => <div key={j} className="h-3 bg-muted rounded w-3/4" />)}</div>
            </div>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
          <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-foreground mb-2">No Packages Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Create clear pricing packages so customers know exactly what they get. Vendors with
            packages receive noticeably more booking requests.
          </p>
          <button onClick={openCreate} disabled={!vendorId}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> Create Your First Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {packages.map((pkg: any) => {
            const cfg = TIER_CFG[pkg.tier ?? 'gold'] ?? TIER_CFG.gold;
            const isTop = mostPopular?.id === pkg.id && Number(pkg.booking_count ?? 0) > 0;
            const deliverables: string[] = Array.isArray(pkg.deliverables) ? pkg.deliverables : [];
            return (
              <div key={pkg.id} className={cn(
                'relative bg-white rounded-2xl border p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300',
                isTop ? 'ring-2 ring-[#D4AF37] border-[#D4AF37]' : 'border-border/60'
              )}>
                {isTop && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-[#D4AF37] text-white px-3 py-1 rounded-full whitespace-nowrap">
                    Most Booked
                  </span>
                )}

                <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4', cfg.gradient)}>
                  <cfg.icon className="w-5 h-5 text-white" />
                </div>

                <h3 className="text-base font-bold text-foreground mb-1">{pkg.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold text-foreground">
                    ₹{Number(pkg.price ?? 0).toLocaleString('en-IN')}
                  </span>
                  {pkg.duration && <span className="text-xs text-muted-foreground">/ {pkg.duration}</span>}
                </div>

                {pkg.description && (
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{pkg.description}</p>
                )}

                {deliverables.length > 0 && (
                  <ul className="space-y-2 mb-5">
                    {deliverables.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Live metrics — only shown when real activity exists */}
                {(Number(pkg.booking_count ?? 0) > 0 || Number(pkg.view_count ?? 0) > 0) && (
                  <div className="grid grid-cols-2 gap-2 mb-4 pt-3 border-t border-border/40">
                    <div>
                      <p className="text-sm font-bold text-foreground">{pkg.booking_count ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Bookings</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {pkg.conversionRate > 0 ? `${pkg.conversionRate}%` : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Conversion</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-border/40">
                  <button onClick={() => openEdit(pkg)}
                    className="flex-1 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-1">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => remove(pkg.id)}
                    className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {form.id ? 'Edit Package' : 'Create Package'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Package name (e.g. Gold)"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                type="number" placeholder="Price (₹)"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="Duration (e.g. 8 hours, Full day)"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Short description"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
              <textarea value={form.deliverables} onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))}
                rows={5} placeholder={'Deliverables — one per line\n200 edited photos\n2 photographers\nOnline gallery'}
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
              <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20">
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="premium">Premium</option>
                <option value="luxury">Luxury</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex gap-3 pt-5">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
                {busy ? 'Saving…' : form.id ? 'Save Changes' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
