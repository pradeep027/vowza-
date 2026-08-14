// CustomerLayout — Premium sidebar + topbar layout for the customer dashboard
// Customer-only. Artists are redirected to /vendor/dashboard, unauthenticated
// users are redirected to /auth.
import { useState, useEffect } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import CustomerSidebar from './CustomerSidebar';
import CustomerTopbar from './CustomerTopbar';

export default function CustomerLayout() {
  const { user, loading, roles, rolesLoaded, isProvider } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Auth guard
  if (loading || !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center animate-pulse">
            <VowzaIcon className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) { navigate('/auth', { replace: true }); return null; }
  // Artists must use the Artist Dashboard, never this customer-only dashboard
  if (isProvider && !roles.includes('admin')) { navigate('/vendor/dashboard', { replace: true }); return null; }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <CustomerSidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className={cn('flex-1 flex flex-col min-h-screen transition-all duration-300', collapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]')}>
        <CustomerTopbar onMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </div>
  );
}
