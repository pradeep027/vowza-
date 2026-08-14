// ─── Admin Layout — Premium Light Sidebar ─────────────────────────────────────
import { useState, useEffect, type ComponentType } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { LogOut, ChevronLeft, Menu, Activity, Home,
  LayoutDashboard, Users, UserCheck, BookOpen, CreditCard,
  Tag, Star, Megaphone, Bell, BarChart3, Ticket, FileText,
  Globe, HeadphonesIcon, Settings, Shield, ClipboardList, Image, Gift
} from 'lucide-react';

type NavigationItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  section: string;
  external?: boolean;
  superOnly?: boolean;
};

const NAV: NavigationItem[] = [
  { label: 'Home',           icon: Home,            path: '/',                    section: 'MAIN', external: true },
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/admin/dashboard',     section: 'MAIN' },
  { label: 'Artists',        icon: UserCheck,       path: '/admin/artists',       section: 'MAIN' },
  { label: 'Customers',      icon: Users,           path: '/admin/customers',     section: 'MAIN' },
  { label: 'Bookings',       icon: BookOpen,        path: '/admin/bookings',      section: 'MAIN' },
  { label: 'Payments',       icon: CreditCard,      path: '/admin/payments',      section: 'MAIN' },
  { label: 'Categories',     icon: Tag,             path: '/admin/categories',    section: 'CONTENT' },
  { label: 'Reviews',        icon: Star,            path: '/admin/reviews',       section: 'CONTENT' },
  { label: 'Announcements',  icon: Megaphone,       path: '/admin/announcements', section: 'CONTENT' },
  { label: 'Notifications',  icon: Bell,            path: '/admin/notifications', section: 'CONTENT' },
  { label: 'Analytics',      icon: BarChart3,       path: '/admin/analytics',     section: 'BUSINESS' },
  { label: 'Coupons',        icon: Ticket,          path: '/admin/coupons',       section: 'BUSINESS' },
  { label: 'Event Packages', icon: Gift,            path: '/admin/event-packages',section: 'BUSINESS' },
  { label: 'Reports',        icon: FileText,        path: '/admin/reports',       section: 'BUSINESS' },
  { label: 'Support',        icon: HeadphonesIcon,  path: '/admin/support',       section: 'SERVICES' },
  { label: 'AI Planner',     icon: VowzaIcon,       path: '/admin/ai-planner',    section: 'SERVICES' },
  { label: 'CMS',            icon: Globe,           path: '/admin/cms',           section: 'SERVICES' },
  { label: 'Settings',       icon: Settings,        path: '/admin/settings',      section: 'SYSTEM' },
  { label: 'Auth Promotion', icon: Image,           path: '/admin/auth-promotion',section: 'SYSTEM' },
  { label: 'Admins',         icon: Shield,          path: '/admin/admins',        section: 'SYSTEM', superOnly: true },
  { label: 'Audit Logs',     icon: ClipboardList,   path: '/admin/audit-logs',    section: 'SYSTEM' },
  { label: 'System Health',  icon: Activity,        path: '/admin/system-health', section: 'SYSTEM' },
];

const SECTIONS = ['MAIN', 'CONTENT', 'BUSINESS', 'SERVICES', 'SYSTEM'];

interface SidebarProps {
  collapsed: boolean;
  adminName: string;
  adminRole: string;
  onSignOut: () => void;
  isSuperAdmin: boolean;
}

function SidebarContent({ collapsed, adminName, adminRole, onSignOut, isSuperAdmin }: SidebarProps) {
  const filteredNav = NAV.filter(item => !item.superOnly || isSuperAdmin);

  return (
    <div className="flex flex-col h-full">
      {/* Logo — clickable, navigates to public home */}
      <div className={cn('flex items-center px-4 h-16 border-b border-border/60 flex-shrink-0', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <NavLink to="/" className="cursor-pointer hover:opacity-80 transition-opacity">
            <img src="/vowza-join-logo.svg" alt="Vowza Home" className="w-8 h-8 rounded-lg object-contain" />
          </NavLink>
        ) : (
          <NavLink to="/" className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
            <img src="/vowza-join-logo.svg" alt="Vowza Home" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-sm font-bold text-gray-900">Vowza Admin</span>
          </NavLink>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">
        {SECTIONS.map((section, si) => {
          const items = filteredNav.filter(i => i.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className={cn(si > 0 && 'mt-4')}>
              {!collapsed && si > 0 && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">{section}</p>
              )}
              <div className="space-y-0.5">
                {items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/admin/dashboard' || item.path === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                      collapsed && 'justify-center px-2',
                      item.external ? 'text-gray-600 hover:text-[#8B1538] hover:bg-[#8B1538]/5' :
                      isActive
                        ? 'bg-[#8B1538]/8 text-[#8B1538] font-semibold'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn(
                          'flex-shrink-0 w-[18px] h-[18px]',
                          item.external ? 'text-gray-500' : isActive ? 'text-[#8B1538]' : 'text-gray-500',
                        )} />
                        {!collapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn('border-t border-border/60 p-3 flex-shrink-0', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#8B1538]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#8B1538]">{adminName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{adminName}</p>
              <p className="text-[10px] text-gray-500">{adminRole}</p>
            </div>
            <button onClick={onSignOut} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={onSignOut} className="w-full flex justify-center text-gray-400 hover:text-red-500 transition-colors py-1" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── AdminLayout ───────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const { user, signOut, loading, isAdmin, isSuperAdmin, rolesLoaded, profile } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const adminName = profile?.full_name || user?.email?.split('@')[0] || 'Admin';
  const adminRole = isSuperAdmin ? 'Super Admin' : 'Admin';
  const handleSignOut = () => { signOut(); };

  if (loading || !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B1538] flex items-center justify-center animate-pulse">
            <VowzaIcon className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) { navigate('/auth', { replace: true }); return null; }
  if (!isAdmin) { navigate('/', { replace: true }); return null; }

  return (
    <div className="flex h-screen bg-[#f8f8fa] overflow-hidden">
      {/* Desktop sidebar — LIGHT */}
      <aside className={cn(
        'hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-border/60 transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-56',
      )}>
        <SidebarContent collapsed={collapsed} adminName={adminName} adminRole={adminRole} onSignOut={handleSignOut} isSuperAdmin={isSuperAdmin} />
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-20 -right-3 z-50 w-6 h-6 bg-white rounded-full border border-border/60 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('w-3.5 h-3.5 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-white shadow-2xl">
            <SidebarContent collapsed={false} adminName={adminName} adminRole={adminRole} onSignOut={handleSignOut} isSuperAdmin={isSuperAdmin} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-border/60 flex items-center justify-between px-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <Activity className="w-3 h-3" /> All systems operational
            </span>
            <div className="w-8 h-8 rounded-full bg-[#8B1538] flex items-center justify-center">
              <span className="text-xs font-bold text-white">{adminName.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
