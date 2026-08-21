// ─── Professional Photography & Videography Package Manager ──────────────────
// Multi-step wizard following Drone package UX pattern
// Creates professional packages with conditional step visibility
// Fixes price initialization: empty string (not 0), validates > 0

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Camera, Video, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const EVENT_TYPES = [
  'Wedding', 'Engagement', 'Reception', 'Haldi', 'Sangeet', 'Pre-Wedding',
  'Birthday', 'Corporate', 'Anniversary', 'Baby Shower', 'Housewarming', 'Other',
];

const COVERAGE_DURATIONS = [
  '1 Hour', '2 Hours', '4 Hours', '6 Hours', '8 Hours', 'Half Day', 'Full Day', '2 Days', '3 Days',
];

const PHOTOGRAPHY_DELIVERABLES = [
  'Edited Photos', 'RAW Photos', 'Photo Album', 'Digital Gallery',
  'Pre-Wedding Photos', 'Candid Photography', 'Traditional Photography',
];

const VIDEOGRAPHY_DELIVERABLES = [
  'Highlight Film', 'Full Event Video', 'Teaser Video', 'Instagram Reel',
  'Pre-Wedding Video', 'Cinematic Film', 'RAW Footage', 'Same-Day Edit',
];

const ADDON_TEMPLATES = [
  'Extra Photographer', 'Extra Videographer', 'Drone Coverage',
  'Premium Album', 'Pre-Wedding Shoot', 'Same-Day Edit',
  'Extra Hour', 'Engagement Video', 'Cinematic Film',
];

const STEP_LABELS = ['Basic Info', 'Pricing', 'Coverage', 'Photography', 'Videography', 'Deliverables Summary', 'Add-ons', 'Media', 'Preview'];

/* ─── Types ─────────────────────────────────────────────────────────────── */
type PackageType = 'photography_only' | 'videography_only' | 'photography_and_videography';
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  package_type: PackageType;
  event_type: string;
  status: string;
  package_price: string; // EMPTY STRING, NOT 0
  advance_percentage: string;
  travel_charges_amount: string;
  coverage_duration: string;
  
  // Photography fields
  photography_team_size: string;
  photography_edited_photos: string;
  photography_unlimited_edited: boolean;
  photography_raw_photos_included: boolean;
  photography_album_included: boolean;
  photography_pre_event_shoot: boolean;
  photography_deliverables: string[];
  photography_delivery_time: string;
  
  // Videography fields
  videography_team_videographers: string;
  videography_team_assistants: string;
  videography_coverage_hours: string;
  videography_pre_event_shoot: boolean;
  videography_deliverables: string[];
  videography_delivery_time: string;
  videography_editing_options: string[];
  
  // Add-ons & Images
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[];
  video_urls: { id: string; url: string; duration_seconds?: number; thumbnail_url?: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: 'photography_only', event_type: 'Wedding', status: 'draft',
  package_price: '', // KEY FIX: Empty string, not 0
  advance_percentage: '20',
  travel_charges_amount: '',
  coverage_duration: 'Full Day',
  
  photography_team_size: '1',
  photography_edited_photos: '500',
  photography_unlimited_edited: false,
  photography_raw_photos_included: false,
  photography_album_included: false,
  photography_pre_event_shoot: false,
  photography_deliverables: [],
  photography_delivery_time: '7 Days',
  
  videography_team_videographers: '1',
  videography_team_assistants: '0',
  videography_coverage_hours: '8 Hours',
  videography_pre_event_shoot: false,
  videography_deliverables: [],
  videography_delivery_time: '14 Days',
  videography_editing_options: [],
  
  addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function PhotoVideoPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['photo-video-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('photography_videography_packages')
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['photo-video-packages', provider.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`photo-video-packages-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'photography_videography_packages',
        filter: `provider_id=eq.${provider.id}`,
      }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  /* ─── Get visible steps based on package type ──────────────────────────── */
  const getVisibleSteps = (): number[] => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // Steps 1-9
    const visible = [1, 2, 3]; // Basics, Pricing, Coverage always visible
    
    if (draft?.package_type !== 'videography_only') visible.push(4); // Photography
    if (draft?.package_type !== 'photography_only') visible.push(5); // Videography
    
    visible.push(6, 7, 8, 9); // Deliverables, Add-ons, Images, Preview always visible
    
    return visible;
  };

  const visibleSteps = getVisibleSteps();
  const canAdvance = step < Math.max(...visibleSteps);

  /* ─── Edit existing package ────────────────────────────────────────────── */
  const edit = async (pkg: any) => {
    let addons: Addon[] = [];
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = [];
    let videoUrls: { id: string; url: string; duration_seconds?: number; thumbnail_url?: string }[] = [];
    let coverUrl = '';

    try {
      const addonRes = await supabase
        .from('photography_videography_package_addons')
        .select('name, price, description')
        .eq('package_id', pkg.id)
        .order('sort_order');
      if (addonRes.data) {
        addons = addonRes.data.map((a: any) => ({
          name: a.name, price: String(a.price ?? ''), description: a.description || '',
        }));
      }
    } catch (_) { /* non-critical */ }

    try {
      const galRes = await supabase
        .from('photography_videography_package_images')
        .select('id, public_url, is_cover, sort_order, media_type, duration_seconds, thumbnail_url')
        .eq('package_id', pkg.id)
        .order('sort_order');
      const gallery = (galRes.data ?? []).filter((g: any) => g.media_type === 'image').map((g: any) => ({
        id: g.id, url: g.public_url, is_cover: g.is_cover,
      }));
      const videos = (galRes.data ?? []).filter((g: any) => g.media_type === 'video').map((v: any) => ({
        id: v.id, url: v.public_url, duration_seconds: v.duration_seconds, thumbnail_url: v.thumbnail_url,
      }));
      const cover = gallery.find((g: any) => g.is_cover);
      coverUrl = cover?.url || '';
      galleryUrls = gallery;
      videoUrls = videos;
    } catch (_) { /* non-critical */ }

    setDraft({
      id: pkg.id,
      name: pkg.name || '',
      description: pkg.description || '',
      package_type: pkg.package_type || 'photography_only',
      event_type: pkg.event_type || 'Wedding',
      status: pkg.status || 'draft',
      package_price: String(pkg.price ?? ''), // Load as string
      advance_percentage: String(pkg.advance_percentage ?? '20'),
      travel_charges_amount: String(pkg.travel_extra_charge ?? ''),
      coverage_duration: pkg.duration || 'Full Day',
      
      photography_team_size: String(pkg.photography_team_size ?? '1'),
      photography_edited_photos: String(pkg.photography_edited_photos ?? '500'),
      photography_unlimited_edited: pkg.photography_unlimited_edited ?? false,
      photography_raw_photos_included: pkg.photography_raw_photos_included ?? false,
      photography_album_included: pkg.photography_album_included ?? false,
      photography_pre_event_shoot: pkg.photography_pre_event_shoot ?? false,
      photography_deliverables: pkg.photography_deliverables ?? [],
      photography_delivery_time: pkg.photography_delivery_time || '7 Days',
      
      videography_team_videographers: String(pkg.videography_team_videographers ?? '1'),
      videography_team_assistants: String(pkg.videography_team_assistants ?? '0'),
      videography_coverage_hours: pkg.videography_coverage_hours || '8 Hours',
      videography_pre_event_shoot: pkg.videography_pre_event_shoot ?? false,
      videography_deliverables: pkg.videography_deliverables ?? [],
      videography_delivery_time: pkg.videography_delivery_time || '14 Days',
      videography_editing_options: pkg.videography_editing_options ?? [],
      
      addons,
      cover_file: null, cover_url: coverUrl,
      gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls,
    });
    setStep(1);
  };

  /* ─── Save handler with PRICE VALIDATION ──────────────────────────────── */
  const save = async () => {
    if (!draft || !draft.name.trim()) {
      toast.error('Package name is required.');
      setStep(1);
      return;
    }
    
    // CRITICAL: Price validation - must NOT be empty or 0
    if (!draft.package_price || draft.package_price.trim() === '') {
      toast.error('Package price is required. Enter a valid amount.');
      setStep(2);
      return;
    }
    
    const priceNum = Number(draft.package_price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Package price must be greater than ₹0.');
      setStep(2);
      return;
    }
    
    if (!draft.cover_file && !draft.cover_url) {
      toast.error('Cover photo is required.');
      setStep(8);
      return;
    }

    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        package_type: draft.package_type,
        event_type: draft.event_type || null,
        status: draft.status,
        price: priceNum,
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        travel_extra_charge: draft.travel_charges_amount ? Number(draft.travel_charges_amount) : null,
        duration: draft.coverage_duration,
        
        photography_team_size: draft.package_type !== 'videography_only' ? Number(draft.photography_team_size) || 1 : null,
        photography_edited_photos: draft.package_type !== 'videography_only' ? Number(draft.photography_edited_photos) || 500 : null,
        photography_unlimited_edited: draft.package_type !== 'videography_only' ? draft.photography_unlimited_edited : null,
        photography_raw_photos_included: draft.package_type !== 'videography_only' ? draft.photography_raw_photos_included : null,
        photography_album_included: draft.package_type !== 'videography_only' ? draft.photography_album_included : null,
        photography_pre_event_shoot: draft.package_type !== 'videography_only' ? draft.photography_pre_event_shoot : null,
        photography_deliverables: draft.package_type !== 'videography_only' ? draft.photography_deliverables : [],
        photography_delivery_time: draft.package_type !== 'videography_only' ? draft.photography_delivery_time : null,
        
        videography_team_videographers: draft.package_type !== 'photography_only' ? Number(draft.videography_team_videographers) || 1 : null,
        videography_team_assistants: draft.package_type !== 'photography_only' ? Number(draft.videography_team_assistants) || 0 : null,
        videography_coverage_hours: draft.package_type !== 'photography_only' ? draft.videography_coverage_hours : null,
        videography_pre_event_shoot: draft.package_type !== 'photography_only' ? draft.videography_pre_event_shoot : null,
        videography_deliverables: draft.package_type !== 'photography_only' ? draft.videography_deliverables : [],
        videography_delivery_time: draft.package_type !== 'photography_only' ? draft.videography_delivery_time : null,
        videography_editing_options: draft.package_type !== 'photography_only' ? draft.videography_editing_options : [],
      };

      console.log('📝 PACKAGE PAYLOAD:', {
        provider_id: payload.provider_id,
        name: payload.name,
        package_type: payload.package_type,
        event_type: payload.event_type,
        price: payload.price,
        advance_percentage: payload.advance_percentage,
        duration: payload.duration,
      });

      let packageId = draft.id;
      if (draft.id) {
        console.log('✏️ STAGE: UPDATE_PACKAGE');
        const r = await supabase
          .from('photography_videography_packages')
          .update(payload)
          .eq('id', draft.id)
          .select('id')
          .single();
        if (r.error) throw r.error;
        console.log('✅ PACKAGE_UPDATE_SUCCESS:', r.data);
      } else {
        console.log('➕ STAGE: INSERT_PACKAGE');
        const r = await supabase
          .from('photography_videography_packages')
          .insert(payload)
          .select('id')
          .single();
        if (r.error) throw r.error;
        packageId = r.data.id;
        console.log('✅ PACKAGE_INSERT_SUCCESS:', packageId);
      }

      // Save add-ons (with price > 0 validation)
      if (packageId) {
        console.log('🔧 STAGE: ADDON_INSERT');
        await supabase.from('photography_videography_package_addons').delete().eq('package_id', packageId);
        const validAddons = draft.addons.filter(a => a.name.trim() && a.price && Number(a.price) > 0);
        if (validAddons.length > 0) {
          const addonsToInsert = validAddons.map((a, i) => ({
            package_id: packageId,
            name: a.name.trim(),
            price: Number(a.price),
            description: a.description || null,
            sort_order: i,
          }));
          const r = await supabase.from('photography_videography_package_addons').insert(addonsToInsert);
          if (r.error) throw r.error;
          console.log('✅ ADDON_INSERT_SUCCESS');
        }

        // Upload cover photo
        if (draft.cover_file) {
          console.log('📷 STAGE: COVER_UPLOAD');
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('photography-videography-package-images')
            .upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (uploadError) {
            console.error('❌ COVER_UPLOAD_FAILED:', uploadError);
            throw uploadError;
          }

          const { data: urlData } = supabase.storage
            .from('photography-videography-package-images')
            .getPublicUrl(path);

          console.log('📝 STAGE: COVER_MEDIA_INSERT');
          const imgResult = await supabase
            .from('photography_videography_package_images')
            .insert({
              package_id: packageId,
              storage_path: path,
              public_url: urlData.publicUrl,
              is_cover: true,
              sort_order: 0,
              media_type: 'image',
            });
          if (imgResult.error) throw imgResult.error;
          console.log('✅ COVER_MEDIA_INSERT_SUCCESS');
        }

        // Upload gallery files
        if (draft.gallery_files.length > 0) {
          console.log('🖼️ STAGE: GALLERY_UPLOAD');
          for (let i = 0; i < draft.gallery_files.length; i++) {
            const f = draft.gallery_files[i];
            const ext = f.name.split('.').pop();
            const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('photography-videography-package-images')
              .upload(path, f, { contentType: f.type });
            if (uploadError) {
              console.error(`❌ GALLERY_UPLOAD_FAILED [${i+1}]:`, uploadError);
              throw uploadError;
            }

            const { data: urlData } = supabase.storage
              .from('photography-videography-package-images')
              .getPublicUrl(path);

            const imgResult = await supabase
              .from('photography_videography_package_images')
              .insert({
                package_id: packageId,
                storage_path: path,
                public_url: urlData.publicUrl,
                is_cover: false,
                sort_order: draft.gallery_urls.length + i + 1,
                media_type: 'image',
              });
            if (imgResult.error) throw imgResult.error;
          }
          console.log('✅ GALLERY_UPLOAD_SUCCESS');
        }

        // Upload video files
        if (draft.video_files.length > 0) {
          console.log('🎬 STAGE: VIDEO_UPLOAD');
          for (let i = 0; i < draft.video_files.length; i++) {
            const f = draft.video_files[i];
            const ext = f.name.split('.').pop();
            const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('photography-videography-package-images')
              .upload(path, f, { contentType: f.type });
            if (uploadError) {
              console.error(`❌ VIDEO_UPLOAD_FAILED [${i+1}]:`, uploadError);
              throw uploadError;
            }

            const { data: urlData } = supabase.storage
              .from('photography-videography-package-images')
              .getPublicUrl(path);

            const videoResult = await supabase
              .from('photography_videography_package_images')
              .insert({
                package_id: packageId,
                storage_path: path,
                public_url: urlData.publicUrl,
                is_cover: false,
                sort_order: draft.gallery_urls.length + draft.gallery_files.length + i + 1,
                media_type: 'video',
                duration_seconds: null,
                thumbnail_url: null,
              });
            if (videoResult.error) throw videoResult.error;
          }
          console.log('✅ VIDEO_UPLOAD_SUCCESS');
        }
      }

      console.log('🎉 STAGE: FINALIZE_SUCCESS');
      toast.success(draft.id ? 'Package updated' : 'Package created');
      setDraft(null);
      setStep(1);
      refresh();
    } catch (err: any) {
      const errorMessage = err.message || err.details || String(err);
      const errorCode = err.code || 'UNKNOWN';
      const errorHint = err.hint || '';
      
      console.error('💥 PACKAGE SAVE FAILED', {
        stage: 'UNKNOWN',
        error_code: errorCode,
        error_message: errorMessage,
        error_details: err.details,
        error_hint: errorHint,
        provider_id: provider.id,
        user_id: user?.id,
        full_error: err,
      });
      
      // Determine user-friendly error message based on actual error
      let userError = 'Unable to create package. Please try again.';
      
      if (errorMessage.includes('column') || errorCode === '42703' || errorMessage.includes('does not exist')) {
        userError = `Database schema mismatch: ${errorMessage}. The migration may need to be applied. Check logs for details.`;
      } else if (errorMessage.includes('RLS policy') || errorMessage.includes('permission') || errorCode === '42501') {
        userError = 'Permission denied. Please ensure you are logged in as a vendor.';
      } else if (errorMessage.includes('upload')) {
        userError = 'Image upload failed. Please check your file and try again.';
      } else if (errorMessage.includes('foreign key') || errorCode === '23503') {
        userError = 'Package reference error. Please try again.';
      } else if (errorMessage.includes('unique')) {
        userError = 'A package with this name already exists.';
      }
      
      toast.error(userError);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (pkg: any) => {
    try {
      await supabase
        .from('photography_videography_packages')
        .update({ status: pkg.status === 'active' ? 'paused' : 'active' })
        .eq('id', pkg.id);
      refresh();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    try {
      await supabase.from('photography_videography_packages').delete().eq('id', pkg.id);
      refresh();
      toast.success('Package deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // Helper: ChipSelect component for multi-select
  const ChipSelect = ({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) => (
    <div>
      <label className="block text-sm font-semibold text-[#4b1d2b] mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => {
            if (selected.includes(opt)) {
              onChange(selected.filter(x => x !== opt));
            } else {
              onChange([...selected, opt]);
            }
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            selected.includes(opt)
              ? 'bg-[#8b1538] text-white border-[#8b1538]'
              : 'border-[#e7d9c4] text-[#4b1d2b] hover:border-[#8b1538]/40'
          }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  // Helper: render step
  const renderStep = (): React.ReactNode => {
    if (!draft) return null;

    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-[#62132d]">Basic Information</h3>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Package Name <span className="text-red-500">*</span></span>
                  <input className={inputClass} value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Premium Wedding Photo + Video" />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Package Type <span className="text-red-500">*</span></span>
                  <select className={inputClass} value={draft.package_type}
                    onChange={e => setDraft({ ...draft, package_type: e.target.value as PackageType })}>
                    <option value="photography_only">📸 Photography Only</option>
                    <option value="videography_only">🎥 Videography Only</option>
                    <option value="photography_and_videography">📸🎥 Photography + Videography</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Event Type</span>
                  <select className={inputClass} value={draft.event_type}
                    onChange={e => setDraft({ ...draft, event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Description</span>
                  <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description}
                    onChange={e => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Describe what makes this package special..." />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Status</span>
                  <select className={inputClass} value={draft.status}
                    onChange={e => setDraft({ ...draft, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-[#62132d]">Pricing</h3>
              <p className="mb-4 text-xs text-stone-500">Package price is required and must be greater than ₹0.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Package Price <span className="text-red-500">*</span></span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                    <input className={`${inputClass} pl-7`} type="number" min="1"
                      value={draft.package_price}
                      onChange={e => setDraft({ ...draft, package_price: e.target.value })}
                      placeholder="Enter package price" />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Advance Percentage</span>
                  <div className="relative">
                    <input className={`${inputClass} pr-7`} type="number" min="0" max="100"
                      value={draft.advance_percentage}
                      onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })} />
                    <span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
                  </div>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Travel Charges (Optional)</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                    <input className={`${inputClass} pl-7`} type="number" min="0"
                      value={draft.travel_charges_amount}
                      onChange={e => setDraft({ ...draft, travel_charges_amount: e.target.value })}
                      placeholder="Optional extra charges for travel" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-[#62132d]">Coverage & Duration</h3>

              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Coverage Duration <span className="text-red-500">*</span></span>
                <select className={inputClass} value={draft.coverage_duration}
                  onChange={e => setDraft({ ...draft, coverage_duration: e.target.value })}>
                  {COVERAGE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
          </div>
        );

      case 4:
        if (draft.package_type === 'videography_only') return null;
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-[#62132d]">📸 Photography Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Number of Photographers</span>
                  <input className={inputClass} type="number" min="1"
                    value={draft.photography_team_size}
                    onChange={e => setDraft({ ...draft, photography_team_size: e.target.value })} />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Edited Photos</span>
                  <input className={inputClass} type="number" min="0"
                    value={draft.photography_edited_photos}
                    onChange={e => setDraft({ ...draft, photography_edited_photos: e.target.value })} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.photography_unlimited_edited}
                    onChange={e => setDraft({ ...draft, photography_unlimited_edited: e.target.checked })}
                    className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538]" />
                  <span className="text-sm text-[#4b1d2b]">Unlimited Edited Photos</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.photography_raw_photos_included}
                    onChange={e => setDraft({ ...draft, photography_raw_photos_included: e.target.checked })}
                    className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538]" />
                  <span className="text-sm text-[#4b1d2b]">RAW Photos Included</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.photography_album_included}
                    onChange={e => setDraft({ ...draft, photography_album_included: e.target.checked })}
                    className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538]" />
                  <span className="text-sm text-[#4b1d2b]">Album Included</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.photography_pre_event_shoot}
                    onChange={e => setDraft({ ...draft, photography_pre_event_shoot: e.target.checked })}
                    className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538]" />
                  <span className="text-sm text-[#4b1d2b]">Pre-Event Shoot</span>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Delivery Time</span>
                <select className={inputClass} value={draft.photography_delivery_time}
                  onChange={e => setDraft({ ...draft, photography_delivery_time: e.target.value })}>
                  {['3 Days', '7 Days', '15 Days', '30 Days'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <ChipSelect label="Deliverables" options={PHOTOGRAPHY_DELIVERABLES}
                selected={draft.photography_deliverables}
                onChange={(v: string[]) => setDraft({ ...draft, photography_deliverables: v })} />
            </div>
          </div>
        );

      case 5:
        if (draft.package_type === 'photography_only') return null;
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-[#62132d]">🎥 Videography Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Videographers</span>
                  <input className={inputClass} type="number" min="1"
                    value={draft.videography_team_videographers}
                    onChange={e => setDraft({ ...draft, videography_team_videographers: e.target.value })} />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Assistants</span>
                  <input className={inputClass} type="number" min="0"
                    value={draft.videography_team_assistants}
                    onChange={e => setDraft({ ...draft, videography_team_assistants: e.target.value })} />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Coverage Hours</span>
                  <input className={inputClass} placeholder="e.g. 8-10 Hours"
                    value={draft.videography_coverage_hours}
                    onChange={e => setDraft({ ...draft, videography_coverage_hours: e.target.value })} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.videography_pre_event_shoot}
                    onChange={e => setDraft({ ...draft, videography_pre_event_shoot: e.target.checked })}
                    className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538]" />
                  <span className="text-sm text-[#4b1d2b]">Pre-Event Shoot</span>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Delivery Time</span>
                <select className={inputClass} value={draft.videography_delivery_time}
                  onChange={e => setDraft({ ...draft, videography_delivery_time: e.target.value })}>
                  {['7 Days', '14 Days', '30 Days', '45 Days'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <ChipSelect label="Deliverables" options={VIDEOGRAPHY_DELIVERABLES}
                selected={draft.videography_deliverables}
                onChange={(v: string[]) => setDraft({ ...draft, videography_deliverables: v })} />

              <ChipSelect label="Editing Options" options={['Color Grading', 'Motion Graphics', 'Sound Design', 'Music Sync']}
                selected={draft.videography_editing_options}
                onChange={(v: string[]) => setDraft({ ...draft, videography_editing_options: v })} />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-[#62132d]">Deliverables Summary</h3>
              <p className="mb-4 text-xs text-stone-600">Review the deliverables included in your package. Edit them in the Photography and Videography steps above.</p>
              <div className="space-y-3 text-sm">
                {draft.package_type !== 'videography_only' && (
                  <div>
                    <p className="font-semibold text-[#4b1d2b]">📸 Photography:</p>
                    <p className="text-stone-600">{draft.photography_deliverables.length > 0 ? draft.photography_deliverables.join(', ') : 'Not specified'}</p>
                  </div>
                )}
                {draft.package_type !== 'photography_only' && (
                  <div>
                    <p className="font-semibold text-[#4b1d2b]">🎥 Videography:</p>
                    <p className="text-stone-600">{draft.videography_deliverables.length > 0 ? draft.videography_deliverables.join(', ') : 'Not specified'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#62132d]">Add-ons</h3>
                  <p className="mt-0.5 text-xs text-stone-500">Optional extras customers can add</p>
                </div>
                <button type="button" onClick={() => setDraft({ ...draft, addons: [...draft.addons, { name: '', price: '', description: '' }] })}
                  className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
                  <Plus className="mr-1 inline h-3 w-3" />Add Custom
                </button>
              </div>

              {/* Templates */}
              <div className="mb-4">
                <span className="text-xs font-medium text-stone-500 mb-1.5 block">Quick add templates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ADDON_TEMPLATES.map(tpl => (
                    <button key={tpl} type="button" onClick={() => setDraft({ ...draft, addons: [...draft.addons, { name: tpl, price: '', description: '' }] })}
                      className="rounded-full border border-[#e7d9c4] px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-[#8b1538] hover:bg-[#8b1538]/5 hover:text-[#8b1538]">
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add-on List */}
              {draft.addons.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-4">No add-ons yet. Use quick-add above or add custom.</p>
              ) : (
                <div className="space-y-2">
                  {draft.addons.map((addon, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 items-center">
                      <input className={inputClass} value={addon.name}
                        onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], name: e.target.value }; setDraft({ ...draft, addons: a }); }}
                        placeholder="Add-on name" />
                      <div className="relative">
                        <span className="absolute left-2 top-2.5 text-xs text-stone-400">₹</span>
                        <input className={`${inputClass} pl-5`} type="number" min="0" value={addon.price}
                          onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], price: e.target.value }; setDraft({ ...draft, addons: a }); }}
                          placeholder="Price" />
                      </div>
                      <input className={inputClass} value={addon.description}
                        onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], description: e.target.value }; setDraft({ ...draft, addons: a }); }}
                        placeholder="Description" />
                      <button type="button" onClick={() => setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-[#62132d]">Package Images</h3>

              {/* Cover Photo */}
              <div>
                <span className="text-sm font-semibold text-[#4b1d2b]">Cover Photo <span className="text-red-500">*</span></span>
                <p className="text-xs text-stone-500 mb-2">Recommended: 1600x900px, max 5MB</p>
                {(draft.cover_file || draft.cover_url) ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50">
                    <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-40 object-cover" />
                    <button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] p-6 transition hover:border-[#8b1538] hover:bg-[#fbf0e4]">
                    <Upload className="h-6 w-6 text-[#8b1538] mb-2" />
                    <span className="text-sm font-semibold text-[#4b1d2b]">Upload cover photo</span>
                    <span className="text-xs text-stone-500 mt-1">Drag & drop or click</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f && f.size <= 5 * 1024 * 1024) setDraft({ ...draft, cover_file: f });
                        else if (f) toast.error('Max 5MB');
                      }} />
                  </label>
                )}
              </div>

              {/* Gallery */}
              <div>
                <span className="text-sm font-semibold text-[#4b1d2b]">Gallery Images</span>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {draft.gallery_urls.map((img, i) => (
                    <div key={img.id || i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setDraft({ ...draft, gallery_urls: draft.gallery_urls.filter((_, idx) => idx !== i) })}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {draft.gallery_files.map((f, i) => (
                    <div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 rounded-full bg-[#f4d58d] px-1.5 py-0.5 text-[9px] font-bold text-[#62132d]">NEW</span>
                      <button type="button" onClick={() => setDraft({ ...draft, gallery_files: draft.gallery_files.filter((_, idx) => idx !== i) })}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-square transition hover:border-[#8b1538]">
                    <Plus className="h-5 w-5 text-[#8b1538]" />
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []).filter(f => f.size <= 5 * 1024 * 1024);
                        if (files.length) setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] });
                      }} />
                  </label>
                </div>
              </div>

              {/* Package Videos */}
              <div>
                <span className="text-sm font-semibold text-[#4b1d2b]">Package Videos</span>
                <p className="text-xs text-stone-500 mb-2">Supported: MP4, WebM (max 100MB each)</p>
                <div className="space-y-2">
                  {draft.video_urls.map((video, i) => (
                    <div key={video.id || i} className="flex items-center justify-between rounded-lg border border-[#eadfcf] bg-stone-50 p-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Video className="h-4 w-4 text-[#8b1538] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#4b1d2b] truncate">Video {i + 1}</p>
                          {video.duration_seconds && <p className="text-xs text-stone-500">{Math.round(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}</p>}
                        </div>
                      </div>
                      <button type="button" onClick={() => setDraft({ ...draft, video_urls: draft.video_urls.filter((_, idx) => idx !== i) })}
                        className="rounded-full bg-black/60 p-1 text-white hover:bg-black/80 flex-shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {draft.video_files.map((f, i) => (
                    <div key={`new-video-${i}`} className="flex items-center justify-between rounded-lg border border-[#eadfcf] bg-stone-50 p-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Video className="h-4 w-4 text-[#8b1538] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#4b1d2b] truncate">{f.name}</p>
                          <p className="text-xs text-stone-500">{(f.size / 1024 / 1024).toFixed(1)}MB</p>
                        </div>
                        <span className="rounded-full bg-[#f4d58d] px-1.5 py-0.5 text-[9px] font-bold text-[#62132d] flex-shrink-0">NEW</span>
                      </div>
                      <button type="button" onClick={() => setDraft({ ...draft, video_files: draft.video_files.filter((_, idx) => idx !== i) })}
                        className="rounded-full bg-black/60 p-1 text-white hover:bg-black/80 flex-shrink-0 ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] p-4 transition hover:border-[#8b1538]">
                    <Video className="h-5 w-5 text-[#8b1538] mb-1" />
                    <span className="text-sm font-semibold text-[#4b1d2b]">Upload Videos</span>
                    <span className="text-xs text-stone-500 mt-1">Drag & drop or click</span>
                    <input type="file" accept="video/mp4,video/webm" multiple className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []).filter(f => {
                          // Validate MIME type
                          if (!f.type.startsWith('video/')) {
                            toast.error(`${f.name} is not a valid video file`);
                            return false;
                          }
                          // Validate file size (max 100MB)
                          if (f.size > 100 * 1024 * 1024) {
                            toast.error(`${f.name} exceeds 100MB limit`);
                            return false;
                          }
                          return true;
                        });
                        if (files.length) setDraft({ ...draft, video_files: [...draft.video_files, ...files] });
                      }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
              <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
                {draft.cover_file || draft.cover_url ? (
                  <div className="h-32 overflow-hidden">
                    <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50">
                    <Camera className="h-8 w-8 text-[#8b1538]/40" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-bold text-[#3d1924]">{draft.name || 'Package Name'}</h4>
                  {draft.description && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{draft.description}</p>}
                  {draft.package_price && (
                    <p className="mt-2 text-xl font-bold text-[#8b1538]">
                      ₹{Number(draft.package_price || 0).toLocaleString('en-IN')}
                    </p>
                  )}
                  <div className="mt-1.5 text-xs text-stone-500">
                    {draft.package_type === 'photography_only' && '📸 Photography'}
                    {draft.package_type === 'videography_only' && '🎥 Videography'}
                    {draft.package_type === 'photography_and_videography' && '📸🎥 Photography + Videography'}
                    {' · '}{draft.coverage_duration}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Main render: List or Create mode
  if (!draft) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">📸🎥 Photography & Videography Packages</h2>
            <p className="text-sm text-muted-foreground mt-1">Create and manage professional packages</p>
          </div>
          <button onClick={() => { setDraft(blank()); setStep(1); }}
            className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors">
            <Plus className="w-4 h-4" />Create Package
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <Camera className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No packages yet</h3>
            <p className="text-muted-foreground mb-6">Create your first professional package</p>
            <button onClick={() => { setDraft(blank()); setStep(1); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark">
              <Plus className="w-4 h-4" />Create Package
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {packages.map((pkg: any) => {
              const coverImg = pkg.cover_url || '';
              return (
                <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#fffaf3] shadow-sm transition hover:shadow-md">
                  {coverImg ? (
                    <div className="h-28 overflow-hidden">
                      <img src={coverImg} alt={pkg.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50">
                      <Camera className="h-10 w-10 text-[#8b1538]/40" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-[#3d1924] leading-tight">{pkg.name}</h2>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        pkg.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>{pkg.status}</span>
                    </div>
                    {pkg.price && (
                      <p className="mt-1.5 text-lg font-bold text-[#8b1538]">
                        ₹{Number(pkg.price).toLocaleString('en-IN')}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#3d1924] transition hover:bg-[#fffaf3]">
                        <Pencil className="mr-1 inline h-3 w-3" />Edit
                      </button>
                      <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#fffaf3]" title="Toggle status">
                        {pkg.status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 transition hover:bg-red-50" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Create/Edit mode: Modal wizard
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Photo & Video</p>
            <h2 className="mt-1 text-lg font-bold text-white">{draft.id ? 'Edit Package' : 'Create New Package'}</h2>
          </div>
          <button onClick={() => { setDraft(null); setStep(1); }} className="rounded-full p-2 text-white/85 hover:bg-white/15">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Progress Bar */}
        <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isVisible = visibleSteps.includes(stepNum);
              if (!isVisible) return null;

              const isCompleted = step > stepNum;
              const isCurrent = step === stepNum;
              const visibleIndex = visibleSteps.indexOf(stepNum);
              const maxVisible = visibleSteps.length;

              return (
                <div key={i} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                      isCompleted ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-[#8b1538] text-white shadow-md shadow-[#8b1538]/30' :
                      'border-2 border-[#e7d9c4] text-stone-400'
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" /> : visibleIndex + 1}
                    </div>
                    <span className={`mt-1 hidden text-[10px] font-medium sm:block ${
                      isCurrent ? 'text-[#8b1538]' : isCompleted ? 'text-emerald-600' : 'text-stone-400'
                    }`}>{label}</span>
                  </div>
                  {visibleIndex < maxVisible - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${isCompleted ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => { if (step === 1) setDraft(null); else setStep(step - 1); }}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {canAdvance ? (
            <button type="button" onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d]">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={save}
              className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60">
              {busy ? 'Saving…' : 'Save Package'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
