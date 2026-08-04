// ─── Admin Layout — Enterprise Shell ─────────────────────────────────────────
// Auth is handled entirely by AuthContext — no separate role fetch here.
// isAdmin is derived from public.user_roles (never hardcoded emails/UUIDs).
// Real-time role subscription is handled in AuthContext.

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/AppLogo';
import { cn } from '@/lib/utils';
import { Sparkles, LogOut, ChevronLeft, Menu, Activity,
  LayoutDashboard, Users, UserCheck, BookOpen, CreditCard,
  Tag, Star, Megaphone, Bell, BarChart3, Ticket, FileText,
  Globe, HeadphonesIcon, Settings, Shield, ClipboardList,
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/admin/dashboard'     },
  { label: 'Artists',        icon: UserCheck,       path: '/admin/artists'        },
  { label: 'Customers',      icon: Users,           path: '/admin/customers'      },
  { label: 'Bookings',       icon: BookOpen,        path: '/admin/bookings'       },
  { label: 'Payments',       icon: CreditCard,      path: '/admin/payments'       },
  { label: 'Categories',     icon: Tag,             path: '/admin/categories'     },
  { label: 'Reviews',        icon: Star,            path: '/admin/reviews'        },
  { label: 'Announcements',  icon: Megaphone,       path: '/admin/announcements'  },
  { label: 'Notifications',  icon: Bell,            path: '/admin/notifications'  },
  { label: 'Analytics',      icon: BarChart3,       path: '/admin/analytics'      },
  { label: 'Coupons',        icon: Ticket,          path: '/admin/coupons'        },
  { label: 'Reports',        icon: FileText,        path: '/admin/reports'        },
  { label: 'Support',        icon: HeadphonesIcon,  path: '/admin/support'        },
  { label: 'Vowza AI Planner', icon: Sparkles,        path: '/admin/ai-planner'     },
  { label: 'CMS',            icon: Globe,           path: '/admin/cms'            },
  { label: 'Settings',       icon: Settings,        path: '/admin/settings'       },
  { label: 'Admins',         icon: Shield,          path: '/admin/admins'         },
  { label: 'Audit Logs',     icon: ClipboardList,   path: '/admin/audit-logs'     },
  { label: 'System Health',  icon: Activity,        path: '/admin/system-health'  },
];

// ── SidebarContent at MODULE scope — never re-created on parent re-render ─────
interface SidebarProps {
  collapsed: boolean;
  adminName: string;
  onSignOut: () => void;
}

function SidebarContent({ collapsed, adminName, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo — role-aware Home navigation */}
      <div className={cn(
        'flex items-center px-4 py-5 border-b border-white/8 flex-shrink-0',
        collapsed && 'justify-center px-2',
      )}>
        <AppLogo
          label="Vowza Admin"
          collapsed={collapsed}
          theme="dark"
          size="sm"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin/dashboard'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/6',
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn(
                  'flex-shrink-0',
                  collapsed ? 'w-5 h-5' : 'w-4 h-4',
                  isActive ? 'text-gold' : 'text-current',
                )} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className={cn('border-t border-white/8 p-3 flex-shrink-0', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-gray-900">
                {adminName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{adminName}</p>
              <p className="text-[10px] text-white/40">Super Admin</p>
            </div>
            <button
              onClick={onSignOut}
              className="text-white/30 hover:text-white transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignOut}
            className="w-full flex justify-center text-white/30 hover:text-white transition-colors py-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── AdminLayout ───────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const { user, signOut, loading, isAdmin, rolesLoaded, profile } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const adminName   = profile?.full_name || user?.email?.split('@')[0] || 'Admin';
  const handleSignOut = () => { signOut(); }; // signOut() handles redirect internally

  // ── Auth + role check ──────────────────────────────────────────────────────
  // Show premium loader while auth resolves — never flicker
  if (loading || !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-maroon flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-white/50">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Not logged in → auth page
  if (!user) { navigate('/auth', { replace: true }); return null; }

  // Logged in but not admin → home
  if (!isAdmin) { navigate('/', { replace: true }); return null; }
  return (
    <div className="flex h-screen bg-[#f4f5f7] dark:bg-[#0f0f14] overflow-hidden">

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col flex-shrink-0 bg-[#12121a] transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-56',
      )}>
        <SidebarContent
          collapsed={collapsed}
          adminName={adminName}
          onSignOut={handleSignOut}
        />
        {/* Collapse toggle tab */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-24 -right-2.5 z-50 w-5 h-8 bg-[#12121a] rounded-r-lg flex items-center justify-center text-white/40 hover:text-white transition-colors border-r border-t border-b border-white/8"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('w-3 h-3 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-[#12121a] shadow-2xl">
            <SidebarContent
              collapsed={false}
              adminName={adminName}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-white dark:bg-[#1a1a24] border-b border-border/60 flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">All systems operational</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900">
              {adminName.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content via Outlet */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
