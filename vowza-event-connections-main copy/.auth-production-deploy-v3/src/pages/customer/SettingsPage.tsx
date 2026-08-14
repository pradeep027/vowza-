// SettingsPage — Change Password, Notification Preferences, Privacy, Delete Account, Logout
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { KeyRound, Bell, ShieldCheck, Trash2, LogOut, AlertTriangle } from 'lucide-react';

const PREFS_KEY = 'vowza_notification_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Change password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Notification prefs (local-only — no notification_settings table in this schema)
  const [prefs, setPrefs] = useState(() => ({
    bookingUpdates: true,
    paymentUpdates: true,
    promotions: false,
    ...loadPrefs(),
  }));

  // Privacy
  const [profileVisible, setProfileVisible] = useState(() => loadPrefs().profileVisible ?? true);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const savePrefs = (next: Record<string, any>) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const handleTogglePref = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
    toast.success('Preference saved');
  };

  const handleToggleVisibility = (value: boolean) => {
    setProfileVisible(value);
    savePrefs({ ...prefs, profileVisible: value });
    toast.success('Privacy setting saved');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      toast.success('Your account has been deleted.');
      await signOut();
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account. Please try again or contact support.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-2xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and security.</p>
      </div>

      {/* Change Password */}
      <section className="rounded-2xl bg-white border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#8B1538]" />
          <h2 className="font-semibold text-foreground">Change Password</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
          </div>
        </div>
        <Button onClick={handleChangePassword} disabled={isChangingPw || !newPassword} className="bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
          {isChangingPw ? 'Updating…' : 'Update Password'}
        </Button>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-2xl bg-white border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#8B1538]" />
          <h2 className="font-semibold text-foreground">Notification Preferences</h2>
        </div>
        <PrefRow label="Booking updates" description="Confirmations, status changes, reminders" checked={prefs.bookingUpdates} onChange={v => handleTogglePref('bookingUpdates', v)} />
        <PrefRow label="Payment updates" description="Receipts and payment status changes" checked={prefs.paymentUpdates} onChange={v => handleTogglePref('paymentUpdates', v)} />
        <PrefRow label="Promotions & offers" description="Occasional updates about new features and offers" checked={prefs.promotions} onChange={v => handleTogglePref('promotions', v)} />
      </section>

      {/* Privacy */}
      <section className="rounded-2xl bg-white border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#8B1538]" />
          <h2 className="font-semibold text-foreground">Privacy Settings</h2>
        </div>
        <PrefRow
          label="Show profile to artists"
          description="Allow artists to see your name when you send a booking request"
          checked={profileVisible}
          onChange={handleToggleVisibility}
        />
      </section>

      {/* Delete Account */}
      <section className="rounded-2xl bg-white border border-red-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-red-700">Delete Account</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
          Delete My Account
        </Button>
      </section>

      {/* Logout */}
      <section className="rounded-2xl bg-white border border-border p-6 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Logout</h2>
          <p className="text-sm text-muted-foreground">Sign out of your Vowza account on this device.</p>
        </div>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-1.5" /> Logout
        </Button>
      </section>

      {/* Delete confirm dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account, bookings history references, and saved data. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" />
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              onClick={handleDeleteAccount}
            >
              {isDeleting ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function PrefRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
