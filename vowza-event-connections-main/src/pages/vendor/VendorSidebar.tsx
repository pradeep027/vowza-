// VendorSidebar — clean navigation with REAL-TIME badge counts from Supabase.
// Removed: Availability, Marketing Tools, AI Assistant, Transactions, Payouts, Documents & KYC.
// Transactions + Payouts + Bank Details now live as tabs inside Wallet.
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/AppLogo';
import { useVendorId, useVendorRealtime, useVendorBadges } from '@/hooks/useVendorData';
import { isPhotographer, isWaterSupplier, isCaterer, isVideographer, isDroneOperator, isDJ, isDecorator } from '@/lib/providerCategory';
import {
  LayoutDashboard, CalendarDays, BookOpen, MessageSquare,
  Image as ImageIcon, Package, Star, BarChart3, Wallet,
  Bell, Settings, HelpCircle, LogOut, ChevronLeft, ChevronRight,
  Users, Home,
} from 'lucide-react';

interface Props {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

/** `badge` names the key on VendorBadges to read the live count from. */
type BadgeKey = 'bookings' | 'messages' | 'inquiries' | 'notifications';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: BadgeKey;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',                     icon: Home,            label: 'Home' },
  { to: '/vendor/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendor/bookings',      icon: BookOpen,        label: 'Bookings',      badge: 'bookings' },
  { to: '/vendor/calendar',      icon: CalendarDays,    label: 'Calendar' },
  { to: '/vendor/inquiries',     icon: Users,           label: 'Inquiries',     badge: 'inquiries' },
  { to: '/vendor/messages',      icon: MessageSquare,   label: 'Messages',      badge: 'messages' },
  { to: '/vendor/notifications', icon: Bell,            label: 'Notifications', badge: 'notifications' },
  { to: '/vendor/portfolio',     icon: ImageIcon,       label: 'Portfolio' },
  { to: '/vendor/packages',      icon: Package,         label: 'Services & Packages' },
  { to: '/vendor/reviews',       icon: Star,            label: 'Reviews' },
  { to: '/vendor/analytics',     icon: BarChart3,       label: 'Analytics' },
  { to: '/vendor/wallet',        icon: Wallet,          label: 'Wallet' },
  { to: '/vendor/settings',      icon: Settings,        label: 'Profile Settings' },
  { to: '/vendor/help',          icon: HelpCircle,      label: 'Help & Support' },
];

export default function VendorSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: Props) {
  const { signOut } = useAuth();

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);
  const { data: badges } = useVendorBadges(vendorId);

  const countFor = (key?: BadgeKey): number =>
    key && badges ? (badges[key] ?? 0) : 0;

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full bg-white border-r border-border/60 flex flex-col z-50',
        'transition-all duration-300 shadow-sm',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Logo — role-aware Home navigation */}
      <div className={cn(
        'flex items-center h-16 border-b border-border/60 px-4 flex-shrink-0',
        collapsed && 'justify-center px-2',
      )}>
        <AppLogo collapsed={collapsed} size="md" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const count = countFor(item.badge);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? (item.to === '/vendor/packages' ? isWaterSupplier(provider) ? 'Water Products' : isPhotographer(provider) ? 'Photography Packages' : isCaterer(provider) ? 'Catering Packages' : isVideographer(provider) ? 'Videography Packages' : isDroneOperator(provider) ? 'Drone Packages' : isDJ(provider) ? 'DJ Packages' : isDecorator(provider) ? 'Decoration Packages' : item.label : item.label) : undefined}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative',
                isActive
                  ? 'bg-[#8B1538]/8 text-[#8B1538] font-semibold'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive && 'text-[#8B1538]')} />
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.to === '/vendor/packages' ? isWaterSupplier(provider) ? 'Water Products' : isPhotographer(provider) ? 'Photography Packages' : isCaterer(provider) ? 'Catering Packages' : isVideographer(provider) ? 'Videography Packages' : isDroneOperator(provider) ? 'Drone Packages' : isDJ(provider) ? 'DJ Packages' : isDecorator(provider) ? 'Decoration Packages' : item.label : item.label}</span>
                      {count > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-[#8B1538] text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && count > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#8B1538] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-3 flex-shrink-0 space-y-2">
        <button
          onClick={() => signOut()}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full',
            'text-red-600 hover:bg-red-50 transition-colors',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Logout</span>}
        </button>
        {!collapsed && (
          <div className="px-3 pt-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground">Vowza Artist v1.0</p>
            <p className="text-[10px] text-muted-foreground">&copy; 2026 Vowza Technologies</p>
          </div>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-border shadow-sm items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
