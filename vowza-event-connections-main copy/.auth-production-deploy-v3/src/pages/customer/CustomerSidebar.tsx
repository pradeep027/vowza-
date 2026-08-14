// CustomerSidebar — fixed left navigation for the customer dashboard
import { NavLink } from 'react-router-dom';
import VowzaIcon from '@/components/VowzaIcon';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CalendarCheck, Heart, Bell, User, CreditCard,
  Star, Settings, ChevronLeft, ChevronRight, X, LogOut, Home, HelpCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/AppLogo';
import { cn } from '@/lib/utils';

interface Props {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/bookings', label: 'My Bookings', icon: CalendarCheck },
  { to: '/dashboard/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/profile', label: 'My Profile', icon: User },
  { to: '/dashboard/payments', label: 'Payment History', icon: CreditCard },
  { to: '/dashboard/reviews', label: 'My Reviews', icon: Star },
  { to: '/dashboard/ai-planner', label: 'Vowza AI Planner', icon: VowzaIcon },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  { to: '/dashboard/help', label: 'Help & Support', icon: HelpCircle },
];

export default function CustomerSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: Props) {
  const { signOut, profile } = useAuth();

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-50 bg-white border-r border-border flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
        {!collapsed || mobileOpen ? (
          <AppLogo className="h-8" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">V</span>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-muted-foreground hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item, idx) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-[#8B1538]/8 text-[#8B1538] font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium'
              )
            }
          >
            {({ isActive }) => (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className="flex items-center gap-3 w-full"
              >
                <item.icon className={cn('w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110', isActive && 'text-[#8B1538]')} />
                {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                {isActive && (!collapsed || mobileOpen) && (
                  <motion.span layoutId="customer-active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1 shrink-0">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {(!collapsed || mobileOpen) && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
