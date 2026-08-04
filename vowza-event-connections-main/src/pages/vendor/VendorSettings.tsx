// VendorSettings — Premium profile settings with sections
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  User, Mail, Phone, MapPin, Camera, Save, Globe,
  Instagram, Youtube, FileText, Shield,
} from 'lucide-react';

export default function VendorSettings() {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', city: '', state: '', area: '',
    bio: '', experience_years: '', price_min: '',
    instagram: '', youtube: '', website: '',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).limit(1);
      const { data: prov } = await supabase.from('provider_profiles').select('*').eq('user_id', user.id).limit(1);
      const p = prof?.[0] as any ?? {};
      const v = prov?.[0] as any ?? {};
      const social = v.social_links ?? {};
      setForm({
        full_name: p.full_name ?? '', phone: p.phone ?? '',
        city: p.city ?? '', state: p.state ?? '', area: p.area ?? '',
        bio: v.bio ?? '', experience_years: String(v.experience_years ?? ''),
        price_min: String(v.price_min ?? ''),
        instagram: social.instagram ?? '', youtube: social.youtube ?? '', website: social.website ?? '',
      });
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update profiles
      await supabase.from('profiles').update({
        full_name: form.full_name, phone: form.phone,
        city: form.city, state: form.state, area: form.area,
      } as any).eq('id', user.id);

      // Update provider_profiles
      await supabase.from('provider_profiles').update({
        bio: form.bio,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        price_min: form.price_min ? Number(form.price_min) : null,
        social_links: { instagram: form.instagram, youtube: form.youtube, website: form.website },
      } as any).eq('user_id', user.id);

      toast.success('Profile updated successfully!');
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, icon: Icon, value, onChange, type = 'text', placeholder = '' }: any) => (
    <div>
      <label className="text-xs font-semibold text-foreground block mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 transition-all" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[800px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-sm text-muted-foreground">Update your public profile information</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Profile Photo</h3>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                : <User className="w-8 h-8 text-white" />}
            </div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-border shadow-sm flex items-center justify-center hover:bg-secondary transition-colors">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Upload a professional photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, max 2MB. Square crop recommended.</p>
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name" icon={User} value={form.full_name} onChange={(e: any) => setForm(f => ({...f, full_name: e.target.value}))} placeholder="Your name" />
          <Field label="Phone" icon={Phone} value={form.phone} onChange={(e: any) => setForm(f => ({...f, phone: e.target.value}))} placeholder="+91..." />
          <Field label="City" icon={MapPin} value={form.city} onChange={(e: any) => setForm(f => ({...f, city: e.target.value}))} placeholder="Hyderabad" />
          <Field label="State" icon={MapPin} value={form.state} onChange={(e: any) => setForm(f => ({...f, state: e.target.value}))} placeholder="Telangana" />
        </div>
      </div>

      {/* Professional info */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Professional Details</h3>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">Bio / About</label>
          <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))}
            rows={4} placeholder="Tell customers about your work, style, and experience..."
            className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Experience (years)" icon={FileText} type="number" value={form.experience_years} onChange={(e: any) => setForm(f => ({...f, experience_years: e.target.value}))} placeholder="3" />
          <Field label="Starting Price (₹)" icon={Shield} type="number" value={form.price_min} onChange={(e: any) => setForm(f => ({...f, price_min: e.target.value}))} placeholder="15000" />
        </div>
      </div>

      {/* Social links */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Social Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Instagram" icon={Instagram} value={form.instagram} onChange={(e: any) => setForm(f => ({...f, instagram: e.target.value}))} placeholder="https://instagram.com/..." />
          <Field label="YouTube" icon={Youtube} value={form.youtube} onChange={(e: any) => setForm(f => ({...f, youtube: e.target.value}))} placeholder="https://youtube.com/..." />
          <Field label="Website" icon={Globe} value={form.website} onChange={(e: any) => setForm(f => ({...f, website: e.target.value}))} placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}
