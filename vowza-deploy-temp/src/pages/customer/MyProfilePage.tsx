// MyProfilePage — edit profile info, avatar (base64 preview persisted to avatar_url;
// no Supabase Storage bucket exists in this project yet).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/onboarding/ImageUpload';
import { Save } from 'lucide-react';

export default function MyProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [state, setState] = useState(profile?.state ?? '');
  const [area, setArea] = useState(profile?.area ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          phone: phone || null,
          city: city || null,
          state: state || null,
          area: area || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-2xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your personal information and address.</p>
      </div>

      <div className="rounded-2xl bg-white border border-border p-6 md:p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <ImageUpload
            value={avatarUrl}
            onChange={setAvatarUrl}
            onFileSelect={() => { /* preview only — persisted on Save */ }}
            variant="avatar"
          />
          <p className="text-xs text-muted-foreground">Click the avatar to change your profile picture</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Address / Area</Label>
            <Input value={area} onChange={e => setArea(e.target.value)} placeholder="Street, locality, landmark" />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input value={state} onChange={e => setState(e.target.value)} placeholder="State" />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full md:w-auto bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </motion.div>
  );
}
