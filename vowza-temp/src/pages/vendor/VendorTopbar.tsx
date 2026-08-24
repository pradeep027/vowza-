// VendorTopbar — sticky top nav with REAL notification + message counts.
// Zero hardcoded badges. Counts come from useVendorBadges (Supabase).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Menu, Search, Bell, MessageSquare, ChevronDown,
  User, Settings, LogOut, Wallet,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorBadges } from '@/hooks/useVendorData';

interface Props { onMenuToggle: () => void; }

/** Small count pill used on the bell / message icons. */
function CountPill({ count, tone = 'maroon' }: { count: number; tone?: 'maroon' | 'gold' }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full',
        'flex items-center justify-center text-[9px] font-bold text-white',
        'ring-2 ring-white',
        tone === 'maroon' ? 'bg-[#8B1538]' : 'bg-[#D4AF37]',
      )}
      aria-label={`${count} unread`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function VendorTopbar({ onMenuToggle }: Props) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingOnline, setSavingOnline] = useState(false);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);
  const { data: badges } = useVendorBadges(vendorId);

  const vendorName = profile?.full_name || user?.email?.split('@')[0] || 'Artist';
  const profession = provider?.profession
    ? String(provider.profession).replace(/_/g, ' ')
    : null;

  // Real availability flag from provider_profiles.is_available
  const online = provider?.is_available !== false;

  const toggleOnline = async () => {
    if (!vendorId) return;
    setSavingOnline(true);
    await supabase
      .from('provider_profiles')
      .update({ is_available: !online } as any)
      .eq('id', vendorId);
    qc.invalidateQueries({ queryKey: ['vendor-id'] });
    setSavingOnline(false);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-border/60 flex items-center px-4 md:px-6 gap-3 md:gap-4">
      {/* Mobile menu */}
      <button onClick={onMenuToggle} aria-label="Open menu"
        className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground">
        <Menu className="w-5 h-5" />
      </button>

      {/* Welcome */}
      <div className="hidden md:block min-w-0">
        <p className="text-xs text-muted-foreground">Welcome back</p>
        <p className="text-sm font-semibold text-foreground truncate">
          {vendorName}
          {profession && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground capitalize">
              · {profession}
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm mx-auto md:mx-0 md:ml-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search bookings, customers…"
            aria-label="Search"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 focus:border-[#8B1538]/40 transition-all"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Online toggle — real is_available value */}
        <button
          onClick={toggleOnline}
          disabled={savingOnline || !vendorId}
          aria-pressed={online}
          className={cn(
            'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all disabled:opacity-60',
            online
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200',
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', online ? 'bg-emerald-500' : 'bg-gray-400')} />
          {online ? 'Available' : 'Unavailable'}
        </button>

        {/* Messages — real unread count */}
        <button
          onClick={() => navigate('/vendor/messages')}
          aria-label={`Messages${badges?.messages ? `, ${badges.messages} unread` : ''}`}
          className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <CountPill count={badges?.messages ?? 0} tone="gold" />
        </button>

        {/* Notifications — real unread count */}
        <button
          onClick={() => navigate('/vendor/notifications')}
          aria-label={`Notifications${badges?.notifications ? `, ${badges.notifications} unread` : ''}`}
          className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          <Bell className="w-5 h-5" />
          <CountPill count={badges?.notifications ?? 0} />
        </button>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <User className="w-4 h-4 text-white" />}
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform hidden md:block',
              profileOpen && 'rotate-180')} />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-border/60 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                  <p className="text-sm font-semibold text-foreground truncate">{vendorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="p-2">
                  {[
                    { label: 'Profile Settings', icon: Settings, to: '/vendor/settings' },
                    { label: 'Wallet',           icon: Wallet,   to: '/vendor/wallet' },
                  ].map(item => (
                    <button key={item.to}
                      onClick={() => { setProfileOpen(false); navigate(item.to); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-left">
                      <item.icon className="w-4 h-4 text-muted-foreground" /> {item.label}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-border/40">
                  <button onClick={() => signOut()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
