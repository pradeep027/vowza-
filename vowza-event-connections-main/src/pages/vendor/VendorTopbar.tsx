// VendorTopbar — Premium sticky top navigation
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Menu, Search, Bell, MessageSquare, Sun, Moon,
  ChevronDown, User, Settings, LogOut,
} from 'lucide-react';

interface Props { onMenuToggle: () => void; }

export default function VendorTopbar({ onMenuToggle }: Props) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [online, setOnline] = useState(true);

  const vendorName = profile?.full_name || user?.email?.split('@')[0] || 'Artist';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-border/60 flex items-center px-4 md:px-6 gap-4">
      {/* Mobile menu */}
      <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground">
        <Menu className="w-5 h-5" />
      </button>

      {/* Welcome */}
      <div className="hidden md:block">
        <p className="text-xs text-muted-foreground">Welcome back</p>
        <p className="text-sm font-semibold text-foreground">{vendorName}</p>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm mx-auto md:mx-0 md:ml-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search bookings, customers..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 focus:border-[#8B1538]/40 transition-all"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Online toggle */}
        <button
          onClick={() => setOnline(!online)}
          className={cn('hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
            online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-500')}
        >
          <div className={cn('w-2 h-2 rounded-full', online ? 'bg-emerald-500' : 'bg-gray-400')} />
          {online ? 'Online' : 'Offline'}
        </button>

        {/* Notifications */}
        <button onClick={() => navigate('/vendor/notifications')} className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#8B1538] rounded-full" />
        </button>

        {/* Messages */}
        <button onClick={() => navigate('/vendor/messages')} className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
          <MessageSquare className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#D4AF37] rounded-full" />
        </button>

        {/* Profile dropdown */}
        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : <User className="w-4 h-4 text-white" />}
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform hidden md:block', profileOpen && 'rotate-180')} />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-border/60 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                  <p className="text-sm font-semibold text-foreground truncate">{vendorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button onClick={() => { setProfileOpen(false); navigate('/vendor/settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-left">
                    <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                  </button>
                  <button onClick={() => signOut()} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
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
