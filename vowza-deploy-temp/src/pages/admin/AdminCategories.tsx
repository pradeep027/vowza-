// ─── Admin Categories ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, RefreshCw, Save, X } from 'lucide-react';

interface Category { id: string; name: string; profession_type: string; description: string; icon: string; is_active: boolean; sort_order: number; }

export default function AdminCategories() {
  const [cats, setCats]         = useState<Category[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Partial<Category> | null>(null);
  const [isNew, setIsNew]       = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('artist_categories' as any).select('*').order('sort_order');
    if (!error) setCats((data ?? []) as Category[]);
    else toast.error('Failed to load categories');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.profession_type) { toast.error('Name and profession type required'); return; }
    try {
      if (isNew) {
        const { error } = await supabase.from('artist_categories' as any).insert({ ...editing, is_active: true, sort_order: cats.length + 1 });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('artist_categories' as any).update(editing).eq('id', editing.id);
        if (error) throw error;
      }
      toast.success(isNew ? 'Category created' : 'Category updated');
      setEditing(null); setIsNew(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete category?')) return;
    await supabase.from('artist_categories' as any).delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from('artist_categories' as any).update({ is_active: !active }).eq('id', id);
    load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Categories</h1><p className="text-sm text-muted-foreground">{cats.length} categories</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { setEditing({}); setIsNew(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-sm font-semibold shadow-maroon hover:opacity-90">
            <Plus className="w-4 h-4" />Add Category
          </button>
        </div>
      </div>

      {/* Edit / New form */}
      {editing && (
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-gold/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{isNew ? 'New Category' : 'Edit Category'}</h3>
            <button onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Name *</label>
              <input value={editing.name||''} onChange={e => setEditing(p => ({...p!, name: e.target.value}))} className="input-premium text-sm w-full" placeholder="Wedding Photographer" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Profession Type *</label>
              <input value={editing.profession_type||''} onChange={e => setEditing(p => ({...p!, profession_type: e.target.value}))} className="input-premium text-sm w-full" placeholder="wedding_photographer" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Icon</label>
              <input value={editing.icon||''} onChange={e => setEditing(p => ({...p!, icon: e.target.value}))} className="input-premium text-sm w-full" placeholder="Camera" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Sort Order</label>
              <input type="number" value={editing.sort_order||0} onChange={e => setEditing(p => ({...p!, sort_order: parseInt(e.target.value)||0}))} className="input-premium text-sm w-full" /></div>
            <div className="sm:col-span-2"><label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
              <textarea value={editing.description||''} onChange={e => setEditing(p => ({...p!, description: e.target.value}))} rows={2} className="input-premium text-sm w-full resize-none" /></div>
          </div>
          <button onClick={save} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90">
            <Save className="w-4 h-4" />{isNew ? 'Create' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        ) : cats.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No categories found</div>
        ) : (
          <div className="divide-y divide-border/40">
            {cats.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-base">{c.icon || '📁'}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.profession_type} · order: {c.sort_order}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => toggle(c.id, c.is_active)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                    {c.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditing(c); setIsNew(false); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
