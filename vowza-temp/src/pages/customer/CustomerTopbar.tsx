// CustomerTopbar — mobile menu trigger + user greeting + avatar
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Props {
  onMenuToggle: () => void;
}

export default function CustomerTopbar({ onMenuToggle }: Props) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';
  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-white/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="hidden lg:block">
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <p className="font-semibold text-foreground">{displayName}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/profile')}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
          aria-label="Go to My Profile"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-sm font-semibold">{initials}</span>
          )}
        </button>
        <button
          onClick={() => signOut()}
          className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors duration-200"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </header>
  );
}
