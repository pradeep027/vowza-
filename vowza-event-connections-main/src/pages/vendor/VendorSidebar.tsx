// VendorSidebar — Premium collapsible sidebar with badges
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/AppLogo';
import {
  LayoutDashboard, CalendarDays, BookOpen, MessageSquare,
  Image, Package, Clock, Star, BarChart3, Megaphone,
  Sparkles, Wallet, ArrowLeftRight, CreditCard, Shield,
  FileText, Settings, HelpCircle, LogOut, ChevronLeft,
  ChevronRight, Users, Bell,
} from 'lucide-react';

interface Props {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const NAV_ITEMS = [
  { to: '/vendor/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendor/bookings',      icon: BookOpen,        label: 'Bookings',         badge: 8 },
  { to: '/vendor/calendar',      icon: CalendarDays,    label: 'Calendar' },
  { to: '/vendor/inquiries',     icon: Users,           label: 'Inquiries',        badge: 12 },
  { to: '/vendor/messages',      icon: MessageSquare,   label: 'Messages',         badge: 5 },
  { to: '/vendor/portfolio',     icon: Image,           label: 'Portfolio' },
  { to: '/vendor/packages',      icon: Package,         label: 'Services & Packages' },
  { to: '/vendor/availability',  icon: Clock,           label: 'Availability' },
  { to: '/vendor/reviews',       icon: Star,            label: 'Reviews' },
  { to: '/vendor/analytics',     icon: BarChart3,       label: 'Analytics' },
  { to: '/vendor/marketing',     icon: Megaphone,       label: 'Marketing Tools' },
  { to: '/vendor/ai-assistant',  icon: Sparkles,        label: 'AI Assistant' },
  { to: '/vendor/wallet',        icon: Wallet,          label: 'Wallet' },
  { to: '/vendor/transactions',  icon: ArrowLeftRight,  label: 'Transactions' },
  { to: '/vendor/payouts',       icon: CreditCard,      label: 'Payouts' },
  { to: '/vendor/performance',   icon: Shield,          label: 'Performance' },
  { to: '/vendor/documents',     icon: FileText,        label: 'Documents & KYC' },
  { to: '/vendor/settings',      icon: Settings,        label: 'Profile Settings' },
  { to: '/vendor/help',          icon: HelpCircle,      label: 'Help & Support' },
];

export default function VendorSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: Props) {
  const { signOut, profile } = useAuth();
  const location = useLocation();

  const sidebarClasses = cn(
    'fixed top-0 left-0 h-full bg-white border-r border-border/60 flex flex-col z-50 transition-all duration-300 shadow-sm',
    collapsed ? 'w-[72px]' : 'w-[260px]',
    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  );

  return (
    <aside className={sidebarClasses}>
      {/* Logo */}
      <div className={cn('flex items-center h-16 border-b border-border/60 px-4 flex-shrink-0', collapsed && 'justify-center px-2')}>
        <AppLogo collapsed={collapsed} size="md" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
              isActive
                ? 'bg-[#8B1538]/8 text-[#8B1538] font-semibold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', location.pathname === item.to && 'text-[#8B1538]')} />
            {!collapsed && (
              <>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] font-bold bg-[#8B1538] text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </>
            )}
            {collapsed && item.badge && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#8B1538] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-3 flex-shrink-0 space-y-2">
        <button onClick={() => signOut()} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full', collapsed && 'justify-center')}>
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
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-border shadow-sm items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
