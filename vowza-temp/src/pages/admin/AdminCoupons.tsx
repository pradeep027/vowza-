// ─── Admin Coupons ────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, RefreshCw, Ticket, Save, X } from 'lucide-react';

interface Coupon { id: string; code: string; type: 'percentage'|'flat'; value: number; min_order: number; usage_limit: number; used_count: number; expires_at: string; is_active: boolean; }

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Coupon>|null>(null);
  const [isNew, setIsNew]     = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('coupons' as any).select('*').order('created_at', { ascending: false });
    if (!error) setCoupons((data ?? []) as Coupon[]);
    else toast.error('Coupons table not found. Run migrations first.');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.code || !editing?.value) { toast.error('Code and value required'); return; }
    try {
      const payload = { code: editing.code?.toUpperCase(), type: editing.type || 'percentage', value: editing.value, min_order: editing.min_order || 0, usage_limit: editing.usage_limit || 100, expires_at: editing.expires_at, is_active: true };
      if (isNew) {
        const { error } = await supabase.from('coupons' as any).insert({ ...payload, used_count: 0 });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
      }
      toast.success(isNew ? 'Coupon created' : 'Coupon updated');
      setEditing(null); setIsNew(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete coupon?')) return;
    await supabase.from('coupons' as any).delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from('coupons' as any).update({ is_active: !active }).eq('id', id);
    load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Coupons</h1><p className="text-sm text-muted-foreground">{coupons.length} coupons</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { setEditing({ type: 'percentage' }); setIsNew(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90">
            <Plus className="w-4 h-4" />New Coupon
          </button>
        </div>
      </div>

      {editing && (
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-gold/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{isNew ? 'New Coupon' : 'Edit Coupon'}</h3>
            <button onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[['Code','code','text','VOWZA20'],['Value','value','number','20'],['Min Order','min_order','number','0'],['Usage Limit','usage_limit','number','100'],['Expires','expires_at','date','']].map(([label,key,type,ph]) => (
              <div key={key}><label className="text-xs font-bold text-muted-foreground block mb-1">{label}</label>
                <input type={type} placeholder={ph} value={(editing as any)[key]||''} onChange={e => setEditing(p => ({...p!, [key]: type==='number'?parseFloat(e.target.value)||0:e.target.value}))} className="input-premium text-sm w-full" /></div>
            ))}
            <div><label className="text-xs font-bold text-muted-foreground block mb-1">Type</label>
              <select value={editing.type||'percentage'} onChange={e => setEditing(p => ({...p!, type: e.target.value as any}))} className="input-premium text-sm w-full">
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
          </div>
          <button onClick={save} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90">
            <Save className="w-4 h-4" />{isNew ? 'Create Coupon' : 'Save'}
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? <div className="p-6 space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        : coupons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground"><Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No coupons yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 bg-surface-2">
                {['Code','Type','Value','Min Order','Used/Limit','Expires','Status','Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{c.code}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{c.type}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{c.type==='percentage'?`${c.value}%`:`₹${c.value}`}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">₹{c.min_order}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.used_count}/{c.usage_limit}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'No expiry'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggle(c.id, c.is_active)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.is_active?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-muted text-muted-foreground'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditing(c); setIsNew(false); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
