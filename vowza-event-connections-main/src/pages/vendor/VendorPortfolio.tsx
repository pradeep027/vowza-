// VendorPortfolio — Premium portfolio grid with upload, categories, and management
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Image as ImageIcon, Video, Upload, Plus, Trash2, Eye,
  Grid3X3, LayoutGrid, Star, Sparkles, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface PortfolioItem {
  id: string; media_url: string; media_type: 'image' | 'video';
  title?: string; category?: string; is_cover?: boolean; created_at: string;
}

export default function VendorPortfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<'grid' | 'large'>('grid');
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch portfolio
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Get provider_id first
      const { data: provider } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (provider && provider.length > 0) {
        const { data } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('provider_id', provider[0].id)
          .order('created_at', { ascending: false });
        setItems((data as any) ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  // Upload handler
  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);

    try {
      // Get provider_id
      const { data: provider } = await supabase
        .from('provider_profiles').select('id').eq('user_id', user.id).limit(1);
      if (!provider || provider.length === 0) { toast.error('Provider profile not found'); return; }
      const providerId = provider[0].id;

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `portfolio/${providerId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('provider-media')
          .upload(path, file);

        if (uploadErr) { toast.error(`Upload failed: ${uploadErr.message}`); continue; }

        const { data: { publicUrl } } = supabase.storage.from('provider-media').getPublicUrl(path);

        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        const { data: inserted, error: insertErr } = await supabase
          .from('portfolio_items')
          .insert({ provider_id: providerId, media_url: publicUrl, media_type: mediaType, title: file.name })
          .select();

        if (insertErr) { toast.error(`Save failed: ${insertErr.message}`); continue; }
        if (inserted) setItems(prev => [inserted[0] as any, ...prev]);
      }
      toast.success('Portfolio updated!');
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete handler
  const handleDelete = async (item: PortfolioItem) => {
    if (!confirm('Delete this portfolio item?')) return;
    const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast.success('Item deleted');
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Portfolio</h1>
          <p className="text-sm text-muted-foreground">{items.length} items uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-0.5 p-0.5 bg-secondary rounded-lg border border-border/50">
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-white shadow-xs' : 'text-muted-foreground')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('large')} className={cn('p-1.5 rounded-md transition-colors', view === 'large' ? 'bg-white shadow-xs' : 'text-muted-foreground')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {/* Upload button */}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className={cn('grid gap-4', view === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2')}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
          <ImageIcon className="w-16 h-16 text-muted-foreground/20 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-foreground mb-2">No Portfolio Items Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Upload your best work to attract customers. Photos, videos, behind-the-scenes — showcase everything.
          </p>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
            <Plus className="w-4 h-4" /> Upload Your First Work
          </button>
        </div>
      ) : (
        <div className={cn('grid gap-4', view === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2')}>
          {items.map(item => (
            <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-muted border border-border/60">
              {item.media_type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Video className="w-10 h-10 text-white/60" />
                  <span className="absolute bottom-2 left-2 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">VIDEO</span>
                </div>
              ) : (
                <img src={item.media_url} alt={item.title || ''} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button className="p-2 rounded-full bg-white/90 text-foreground hover:bg-white transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-2 rounded-full bg-white/90 text-red-600 hover:bg-white transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {item.is_cover && (
                <span className="absolute top-2 left-2 text-[9px] font-bold bg-[#D4AF37] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Cover
                </span>
              )}
            </div>
          ))}
          {/* Upload tile */}
          <button onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-[#8B1538]/40 flex flex-col items-center justify-center gap-2 transition-colors group">
            <Plus className="w-8 h-8 text-muted-foreground group-hover:text-[#8B1538] transition-colors" />
            <span className="text-xs text-muted-foreground group-hover:text-foreground">Add More</span>
          </button>
        </div>
      )}
    </div>
  );
}
