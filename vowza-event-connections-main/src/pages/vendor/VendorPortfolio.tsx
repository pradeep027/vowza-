// VendorPortfolio — 100% real data. Uploads to Supabase Storage, rows in portfolio_items.
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Image as ImageIcon, Video, Upload, Plus, Trash2, Star,
  Grid3X3, LayoutGrid, ExternalLink, Eye,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorPortfolio } from '@/hooks/useVendorData';

export default function VendorPortfolio() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<'grid' | 'large'>('grid');

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data, isLoading } = useVendorPortfolio(vendorId);
  const items      = data?.items      ?? [];
  const imageCount = data?.imageCount ?? 0;
  const videoCount = data?.videoCount ?? 0;
  const mostViewed = data?.mostViewed ?? null;

  // Registration gallery already stored on provider_profiles.gallery_urls
  const galleryUrls: string[] = Array.isArray(provider?.gallery_urls) ? provider.gallery_urls : [];

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !vendorId) return;
    setUploading(true);
    let ok = 0;

    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `portfolio/${vendorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('provider-media')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }

      const { data: pub } = supabase.storage.from('provider-media').getPublicUrl(path);

      const { error: insErr } = await supabase.from('portfolio_items').insert({
        provider_id: vendorId,
        media_url:   pub.publicUrl,
        media_type:  file.type.startsWith('video') ? 'video' : 'image',
        title:       file.name.replace(/\.[^.]+$/, ''),
      } as any);

      if (insErr) { toast.error(`${file.name}: ${insErr.message}`); continue; }
      ok++;
    }

    if (ok > 0) {
      toast.success(`${ok} item${ok === 1 ? '' : 's'} uploaded`);
      qc.invalidateQueries({ queryKey: ['vendor-portfolio'] });
      qc.invalidateQueries({ queryKey: ['vendor-kpis'] });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (item: any) => {
    if (!confirm('Delete this portfolio item permanently?')) return;
    const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Item deleted');
    qc.invalidateQueries({ queryKey: ['vendor-portfolio'] });
  };

  // ── Set as cover ──────────────────────────────────────────────────────────
  const setCover = async (item: any) => {
    if (!vendorId) return;
    await supabase.from('portfolio_items').update({ is_cover: false } as any).eq('provider_id', vendorId);
    const { error } = await supabase.from('portfolio_items').update({ is_cover: true } as any).eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('provider_profiles').update({ cover_image_url: item.media_url } as any).eq('id', vendorId);
    toast.success('Cover image updated');
    qc.invalidateQueries({ queryKey: ['vendor-portfolio'] });
    qc.invalidateQueries({ queryKey: ['vendor-id'] });
  };

  const gridCls = view === 'grid'
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${imageCount} image${imageCount === 1 ? '' : 's'} · ${videoCount} video${videoCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-0.5 bg-secondary rounded-lg border border-border/50">
            <button onClick={() => setView('grid')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-white shadow-xs' : 'text-muted-foreground')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('large')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'large' ? 'bg-white shadow-xs' : 'text-muted-foreground')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading || !vendorId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={e => handleUpload(e.target.files)} />
        </div>
      </div>

      {/* Stats — only when there is data */}
      {!isLoading && (items.length > 0 || galleryUrls.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Items',   value: String(items.length + galleryUrls.length) },
            { label: 'Images',        value: String(imageCount + galleryUrls.length) },
            { label: 'Videos',        value: String(videoCount) },
            { label: 'Most Viewed',   value: mostViewed?.view_count ? `${mostViewed.view_count} views` : '—' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-border/60 p-4">
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Registration gallery (read-only, from provider_profiles.gallery_urls) */}
      {galleryUrls.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Registration Gallery ({galleryUrls.length})
          </h3>
          <div className={cn('grid gap-4', gridCls)}>
            {galleryUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="relative group aspect-square rounded-2xl overflow-hidden bg-muted border border-border/60">
                <img src={url} alt="" loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded portfolio items */}
      {isLoading ? (
        <div className={cn('grid gap-4', gridCls)}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 && galleryUrls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
          <ImageIcon className="w-16 h-16 text-muted-foreground/20 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-foreground mb-2">No Portfolio Items Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Upload your best work to attract customers. Photos and videos of past events help customers
            understand your style before they book.
          </p>
          <button onClick={() => fileRef.current?.click()} disabled={!vendorId}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> Upload Your First Work
          </button>
        </div>
      ) : (
        <div>
          {items.length > 0 && (
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Portfolio Items ({items.length})
            </h3>
          )}
          <div className={cn('grid gap-4', gridCls)}>
            {items.map((item: any) => (
              <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-muted border border-border/60">
                {item.media_type === 'video' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-2">
                    <Video className="w-10 h-10 text-white/50" />
                    <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">VIDEO</span>
                  </div>
                ) : (
                  <img src={item.media_url} alt={item.title ?? ''} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <a href={item.media_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white/90 text-foreground hover:bg-white transition-colors" title="Open">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {item.media_type !== 'video' && !item.is_cover && (
                    <button onClick={() => setCover(item)}
                      className="p-2 rounded-full bg-white/90 text-[#D4AF37] hover:bg-white transition-colors" title="Set as cover">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(item)}
                    className="p-2 rounded-full bg-white/90 text-red-600 hover:bg-white transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {item.is_cover && (
                  <span className="absolute top-2 left-2 text-[9px] font-bold bg-[#D4AF37] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-white" /> Cover
                  </span>
                )}
                {Number(item.view_count ?? 0) > 0 && (
                  <span className="absolute bottom-2 right-2 text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5" /> {item.view_count}
                  </span>
                )}
              </div>
            ))}

            <button onClick={() => fileRef.current?.click()} disabled={!vendorId}
              className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-[#8B1538]/40 flex flex-col items-center justify-center gap-2 transition-colors group disabled:opacity-50">
              <Plus className="w-8 h-8 text-muted-foreground group-hover:text-[#8B1538] transition-colors" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground">Add More</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
