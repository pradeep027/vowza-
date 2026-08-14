import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Edit3, Trash2, Check, X, ChevronLeft, ChevronRight, Loader2, Music, Users, Upload } from 'lucide-react';

const DANCE_TYPES = ['Bharatanatyam','Kuchipudi','Kathak','Western','Hip Hop','Contemporary','Bhangra','Garba','Sangeet Dance','Bride Entry','Couple Dance'];
const PACKAGE_TYPES = ['Solo Performance','Couple Performance','Group Performance','Sangeet Package','Bride Entry Package','Wedding Dance Package','Choreography Package','Classical Performance','Western Dance Package','Custom Dance Package'];
const DURATIONS = ['15 Minutes','30 Minutes','1 Hour','1.5 Hours','2 Hours','3 Hours','Full Event'];
const ALL_SERVICES = ['Solo Dance','Couple Dance','Group Performance','Choreography','Rehearsal Sessions','Bride Entry','Groom Entry','Sangeet Performance','Flash Mob','Classical Recital','Folk Dance','Costume Arrangement','Music Arrangement','Stage Setup Coordination'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

type Draft = {
  id?: string; name: string; description: string; dance_type: string; package_type: string;
  performance_style: string; team_size: string; duration: string; status: string;
  package_price: string; advance_percentage: string;
  services_included: string[]; deliverables: string[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', dance_type: '', package_type: '', performance_style: '', team_size: '1',
  duration: '', status: 'active', package_price: '', advance_percentage: '20',
  services_included: [], deliverables: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [], video_files: [], video_urls: [],
});

export default function DancerPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank());
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['dancer-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('dancer_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`dancer-pkg-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dancer_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['dancer-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const openEdit = async (pkg: any) => {
    let coverUrl = ''; let galleryUrls: { id: string; url: string }[] = []; let videoUrls: { id: string; url: string }[] = [];
    try {
      const r = await supabase.from('dancer_gallery' as any).select('id, public_url, is_cover, media_type, sort_order').eq('package_id', pkg.id).order('sort_order');
      const g = (r.data ?? []).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type || 'image' }));
      coverUrl = g.find((x: any) => x.is_cover)?.url || '';
      galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type === 'image');
      videoUrls = g.filter((x: any) => x.media_type === 'video');
    } catch (_) {}
    setDraft({
      id: pkg.id, name: pkg.name || '', description: pkg.description || '',
      dance_type: pkg.dance_type || '', package_type: pkg.package_type || '',
      performance_style: pkg.performance_style || '', team_size: String(pkg.team_size || 1),
      duration: pkg.duration || '', status: pkg.status || 'active',
      package_price: String(pkg.package_price ?? ''), advance_percentage: String(pkg.advance_percentage || 20),
      services_included: pkg.services_included ?? [], deliverables: pkg.deliverables ?? [],
      cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls, video_files: [], video_urls: videoUrls,
    });
    setStep(1); setEditing(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { toast.error('Package name is required'); return; }
    if (!draft.package_price || Number(draft.package_price) <= 0) { toast.error('Enter a valid price'); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(), description: draft.description.trim() || null,
        dance_type: draft.dance_type || null, package_type: draft.package_type || null,
        performance_style: draft.performance_style || null, team_size: Number(draft.team_size) || 1,
        duration: draft.duration || null, status: draft.status,
        package_price: Number(draft.package_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        services_included: draft.services_included, deliverables: draft.deliverables,
      };
      let packageId = draft.id;
      if (draft.id) {
        const r = await supabase.from('dancer_packages' as any).update(payload).eq('id', draft.id).select('id').single();
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from('dancer_packages' as any).insert(payload).select('id').single();
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Upload media
      if (packageId && user) {
        // Cover image
        if (draft.cover_file) {
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('dancer-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) {
            const url = supabase.storage.from('dancer-media').getPublicUrl(path).data.publicUrl;
            await supabase.from('dancer_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true);
            await supabase.from('dancer_gallery' as any).insert({ package_id: packageId, public_url: url, is_cover: true, media_type: 'image', sort_order: 0 });
          }
        }
        // Gallery images
        for (let i = 0; i < draft.gallery_files.length; i++) {
          const file = draft.gallery_files[i];
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('dancer-media').upload(path, file, { contentType: file.type });
          if (!upErr) {
            const url = supabase.storage.from('dancer-media').getPublicUrl(path).data.publicUrl;
            await supabase.from('dancer_gallery' as any).insert({ package_id: packageId, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 });
          }
        }
        // Videos
        for (let i = 0; i < draft.video_files.length; i++) {
          const file = draft.video_files[i];
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('dancer-media').upload(path, file, { contentType: file.type });
          if (!upErr) {
            const url = supabase.storage.from('dancer-media').getPublicUrl(path).data.publicUrl;
            await supabase.from('dancer_gallery' as any).insert({ package_id: packageId, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i });
          }
        }
        // Clean up deleted items in edit mode
        if (draft.id) {
          const keepIds = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean);
          const { data: existing } = await supabase.from('dancer_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false);
          const toDelete = (existing ?? []).map((e: any) => e.id).filter((id: string) => !keepIds.includes(id));
          if (toDelete.length > 0) await supabase.from('dancer_gallery' as any).delete().in('id', toDelete);
        }
      }

      toast.success(draft.id ? 'Package updated' : 'Package created');
      setEditing(false); setDraft(blank());
      qc.invalidateQueries({ queryKey: ['dancer-packages', provider.id] });
    } catch (err: any) { toast.error(err.message || 'Failed to save package'); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    const { error } = await supabase.from('dancer_packages' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Package deleted'); qc.invalidateQueries({ queryKey: ['dancer-packages', provider.id] }); }
  };

  const STEPS = ['Basic Info', 'Dance Details', 'Pricing', 'Services', 'Media', 'Preview'];

  if (editing) {
    const price = Number(draft.package_price || 0);
    const advPct = Number(draft.advance_percentage || 20);
    const advAmount = Math.round(price * advPct / 100);
    const remaining = price - advAmount;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#3d1924]">{draft.id ? 'Edit Package' : 'New Dance Package'}</h2>
          <button onClick={() => { setEditing(false); setDraft(blank()); }} className="text-sm text-stone-500 hover:text-stone-700">Cancel</button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <button onClick={() => setStep(i + 1)} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-[#7c3aed] text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              {i < 5 && <div className={`mx-1 h-0.5 w-4 rounded ${step > i + 1 ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (<>
            <h3 className="font-bold text-[#3d1924]">Basic Information</h3>
            <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Package Name <span className="text-red-500">*</span></span>
              <input className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Sangeet Premium Performance" /></label>
            <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Description</span>
              <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe this dance package..." /></label>
            <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Package Type</span>
              <select className={inputClass} value={draft.package_type} onChange={e => setDraft({ ...draft, package_type: e.target.value })}>
                <option value="">Select package type</option>
                {PACKAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select></label>
          </>)}

          {/* Step 2: Dance Details */}
          {step === 2 && (<>
            <h3 className="font-bold text-[#3d1924]">Dance Details</h3>
            <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Dance Type <span className="text-red-500">*</span></span>
              <select className={inputClass} value={draft.dance_type} onChange={e => setDraft({ ...draft, dance_type: e.target.value })}>
                <option value="">Select dance type</option>
                {DANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select></label>
            <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Performance Style</span>
              <input className={inputClass} value={draft.performance_style} onChange={e => setDraft({ ...draft, performance_style: e.target.value })} placeholder="e.g. Classical, Fusion, Choreographed" /></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Team Size</span>
                <input className={inputClass} type="number" min="1" value={draft.team_size} onChange={e => setDraft({ ...draft, team_size: e.target.value })} /></label>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Duration</span>
                <select className={inputClass} value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })}>
                  <option value="">Select duration</option>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select></label>
            </div>
          </>)}

          {/* Step 3: Pricing */}
          {step === 3 && (<>
            <h3 className="font-bold text-[#3d1924]">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Package Price <span className="text-red-500">*</span></span>
                <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0" value={draft.package_price} onChange={e => setDraft({ ...draft, package_price: e.target.value })} placeholder="e.g. 20000" /></div></label>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Advance %</span>
                <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
                  <input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })} placeholder="20" /></div></label>
            </div>
            {price > 0 && (
              <div className="rounded-xl border border-[#eadfcf] bg-purple-50/30 p-4 space-y-2 mt-2">
                <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-bold text-purple-700">₹{price.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-emerald-700">₹{advAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
              </div>
            )}
          </>)}

          {/* Step 4: Services */}
          {step === 4 && (<>
            <h3 className="font-bold text-[#3d1924]">Services Included</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_SERVICES.map(s => (
                <button key={s} type="button" onClick={() => setDraft(d => ({ ...d, services_included: d.services_included.includes(s) ? d.services_included.filter(x => x !== s) : [...d.services_included, s] }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${draft.services_included.includes(s) ? 'bg-[#7c3aed] text-white border-[#7c3aed]' : 'bg-white text-stone-600 border-[#e7d9c4] hover:border-[#7c3aed]/40'}`}>
                  {draft.services_included.includes(s) && <Check className="inline h-3 w-3 mr-1" />}{s}
                </button>
              ))}
            </div>
            <label className="block mt-4"><span className="text-sm font-semibold text-[#3d1924]">Deliverables</span>
              <textarea className={`${inputClass} min-h-[60px] resize-y`} value={draft.deliverables.join('\n')} onChange={e => setDraft({ ...draft, deliverables: e.target.value.split('\n').filter(Boolean) })} placeholder="One deliverable per line..." /></label>
          </>)}

          {/* Step 5: Media */}
          {step === 5 && (<>
            <h3 className="font-bold text-[#3d1924]">Package Media</h3>
            {/* Cover */}
            <div>
              <span className="text-sm font-semibold text-[#3d1924]">Cover Photo</span>
              {(draft.cover_file || draft.cover_url) ? (
                <div className="relative rounded-xl overflow-hidden border mt-2">
                  <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-36 object-cover" />
                  <button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-6 hover:border-purple-600">
                  <Upload className="h-6 w-6 text-purple-700 mb-2" /><span className="text-sm font-semibold text-[#3d1924]">Upload cover photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 5 * 1024 * 1024) setDraft({ ...draft, cover_file: f }); else if (f) toast.error('Max 5MB'); }} />
                </label>
              )}
            </div>
            {/* Gallery */}
            <div>
              <span className="text-sm font-semibold text-[#3d1924]">Performance Photos</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {draft.gallery_urls.map((g, i) => (
                  <div key={g.id} className="relative rounded-lg overflow-hidden border aspect-square">
                    <img src={g.url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setDraft({ ...draft, gallery_urls: draft.gallery_urls.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {draft.gallery_files.map((f, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border aspect-square">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setDraft({ ...draft, gallery_files: draft.gallery_files.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-purple-200 aspect-square hover:border-purple-500">
                  <Plus className="h-5 w-5 text-purple-400" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] }); }} />
                </label>
              </div>
            </div>
            {/* Videos */}
            <div>
              <span className="text-sm font-semibold text-[#3d1924]">Performance Videos</span>
              <div className="mt-2 space-y-2">
                {draft.video_urls.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 rounded-lg border border-[#e7d9c4] p-2">
                    <Music className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="text-xs text-stone-600 truncate flex-1">Video {i + 1}</span>
                    <button type="button" onClick={() => setDraft({ ...draft, video_urls: draft.video_urls.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {draft.video_files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-[#e7d9c4] p-2">
                    <Music className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="text-xs text-stone-600 truncate flex-1">{f.name}</span>
                    <button type="button" onClick={() => setDraft({ ...draft, video_files: draft.video_files.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-purple-200 p-3 hover:border-purple-500">
                  <Upload className="h-4 w-4 text-purple-400" /><span className="text-xs text-purple-600 font-medium">Upload video</span>
                  <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 100 * 1024 * 1024) setDraft({ ...draft, video_files: [...draft.video_files, f] }); else if (f) toast.error('Max 100MB'); }} />
                </label>
              </div>
            </div>
          </>)}

          {/* Step 6: Preview */}
          {step === 6 && (<>
            <h3 className="font-bold text-[#3d1924]">Package Preview</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-600">Name</span><span className="font-semibold">{draft.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Dance Type</span><span className="font-medium">{draft.dance_type || '—'}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Package Type</span><span className="font-medium">{draft.package_type || '—'}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Team Size</span><span className="font-medium">{draft.team_size}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Duration</span><span className="font-medium">{draft.duration || '—'}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Price</span><span className="font-bold text-purple-700">₹{price.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Advance</span><span className="font-medium">{advPct}% (₹{advAmount.toLocaleString('en-IN')})</span></div>
              {draft.services_included.length > 0 && (
                <div><span className="text-stone-600 block mb-1">Services:</span>
                  <div className="flex flex-wrap gap-1">{draft.services_included.map(s => <span key={s} className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">{s}</span>)}</div></div>
              )}
            </div>
          </>)}
        </div>

        {/* Footer */}
        <div className="flex justify-between">
          <button onClick={() => step > 1 ? setStep(step - 1) : setEditing(false)} className="flex items-center gap-1 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 6 ? (
            <button onClick={() => setStep(step + 1)} className="flex items-center gap-1 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6d28d9]">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={busy} className="rounded-xl bg-[#7c3aed] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#6d28d9] disabled:opacity-60">
              {busy ? <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> : null}{draft.id ? 'Update Package' : 'Create Package'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Package list view
  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#3d1924]">Dance Packages</h2>
          <p className="text-sm text-muted-foreground">Create and manage your dance performance packages.</p>
        </div>
        <button onClick={() => { setDraft(blank()); setStep(1); setEditing(true); }} className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6d28d9]">
          <Plus className="h-4 w-4" />Add Package
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e7d9c4] p-10 text-center">
          <Music className="mx-auto h-10 w-10 text-purple-300 mb-3" />
          <p className="text-sm text-muted-foreground">No dance packages yet. Create your first package to start receiving bookings.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#3d1924]">{pkg.name}</h3>
                  {pkg.dance_type && <p className="text-xs text-purple-600 font-medium">{pkg.dance_type}</p>}
                  {pkg.package_type && <p className="text-xs text-muted-foreground">{pkg.package_type}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{pkg.status}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {pkg.team_size > 1 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.team_size} dancers</span>}
                {pkg.duration && <span>{pkg.duration}</span>}
              </div>
              <p className="text-lg font-bold text-[#7c3aed]">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>
              <div className="flex gap-2 pt-2 border-t border-[#eadfcf]">
                <button onClick={() => openEdit(pkg)} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-semibold text-[#3d1924] hover:bg-stone-50"><Edit3 className="h-3 w-3" />Edit</button>
                <button onClick={() => handleDelete(pkg.id)} className="flex items-center justify-center gap-1 rounded-lg border border-red-200 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
