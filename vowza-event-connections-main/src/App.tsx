import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import InactivityWarning from "@/components/InactivityWarning";
import AIFloatingButton from "@/components/ai/AIFloatingButton";

const Index                = lazy(() => import("./pages/Index"));
const Auth                 = lazy(() => import("./pages/Auth"));
const AccountTypeSelection = lazy(() => import("./pages/AccountTypeSelection"));
const ProviderRegistration = lazy(() => import("./pages/ProviderRegistration"));
const ArtistOnboarding     = lazy(() => import("./pages/ArtistOnboarding"));
const TestFeatures         = lazy(() => import("./pages/TestFeatures"));
const ProviderDashboard    = lazy(() => import("./pages/ProviderDashboard"));
const CustomerDashboard    = lazy(() => import("./pages/CustomerDashboard"));
const ProviderProfile      = lazy(() => import("./pages/ProviderProfile"));
const MyBookings           = lazy(() => import("./pages/MyBookings"));
const BookingChat          = lazy(() => import("./pages/BookingChat"));
const Artists              = lazy(() => import("./pages/Artists"));
const Checkout             = lazy(() => import("./pages/Checkout"));
const Cart                 = lazy(() => import("./components/Cart"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const AIPlanner            = lazy(() => import("./pages/AIPlanner"));
const EventPlanning        = lazy(() => import("./pages/EventPlanning"));
const CustomerEventDashboard = lazy(() => import("./pages/CustomerEventDashboard"));
const Contact              = lazy(() => import("./pages/Contact"));
const PrivacyPolicy        = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService       = lazy(() => import("./pages/TermsOfService"));
const CategoryPage         = lazy(() => import("./pages/CategoryPage"));
const VendorEditProfile    = lazy(() => import("./pages/VendorEditProfile"));

// ─── Admin (new enterprise layout) ───────────────────────────────────────────
const AdminLayout          = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboardHome   = lazy(() => import("./pages/admin/AdminDashboardHome"));
const AdminArtists         = lazy(() => import("./pages/admin/AdminArtists"));
const AdminCustomers       = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminBookings        = lazy(() => import("./pages/admin/AdminBookings"));
const AdminPayments        = lazy(() => import("./pages/admin/AdminPayments"));
const AdminCategories      = lazy(() => import("./pages/admin/AdminCategories"));
const AdminReviews         = lazy(() => import("./pages/admin/AdminReviews"));
const AdminAnnouncements   = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminNotifications   = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminAnalytics       = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminCoupons         = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminReports         = lazy(() => import("./pages/admin/AdminReports"));
const AdminSupport         = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAIPlanner       = lazy(() => import("./pages/admin/AdminAIPlanner"));
const AdminCMS             = lazy(() => import("./pages/admin/AdminCMS"));
const AdminSettings        = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAdmins          = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminAuditLogs       = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminSystemHealth    = lazy(() => import("./pages/admin/AdminSystemHealth"));

// ─── Page loader fallback ─────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold animate-pulse">
        <svg className="w-6 h-6 text-foreground" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-gold animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// ─── AppContent — uses router context so hooks like useNavigate work ──────────
const AppContent = () => {
  useInactivityLogout();

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/test-features" element={<TestFeatures />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/event/:eventId" element={<EventPlanning />} />
          <Route path="/ai-planner" element={<AIPlanner />} />
          <Route path="/contact"    element={<Contact />} />
          <Route path="/privacy"    element={<PrivacyPolicy />} />
          <Route path="/terms"      element={<TermsOfService />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/provider/:id" element={<ProviderProfile />} />
          <Route path="/artist/:id"   element={<ProviderProfile />} />

          {/* Protected routes */}
          <Route path="/select-account-type" element={<ProtectedRoute><AccountTypeSelection /></ProtectedRoute>} />
          <Route path="/browse" element={<ProtectedRoute><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/event-dashboard" element={<ProtectedRoute><CustomerEventDashboard /></ProtectedRoute>} />
          <Route path="/chat/:bookingId" element={<ProtectedRoute><BookingChat /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/provider/register" element={<ProtectedRoute><ProviderRegistration /></ProtectedRoute>} />
          <Route path="/artist/onboarding" element={<ProtectedRoute><ArtistOnboarding /></ProtectedRoute>} />
          <Route path="/vendor/edit" element={<ProtectedRoute allowedRoles={['provider']}><VendorEditProfile /></ProtectedRoute>} />
          <Route path="/provider/dashboard" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />

          {/* ── Admin — AdminLayout handles auth + admin role check internally ── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard"    element={<AdminDashboardHome />} />
            <Route path="artists"      element={<AdminArtists />} />
            <Route path="customers"    element={<AdminCustomers />} />
            <Route path="bookings"     element={<AdminBookings />} />
            <Route path="payments"     element={<AdminPayments />} />
            <Route path="categories"   element={<AdminCategories />} />
            <Route path="reviews"      element={<AdminReviews />} />
            <Route path="announcements"element={<AdminAnnouncements />} />
            <Route path="notifications"element={<AdminNotifications />} />
            <Route path="analytics"    element={<AdminAnalytics />} />
            <Route path="coupons"      element={<AdminCoupons />} />
            <Route path="reports"      element={<AdminReports />} />
            <Route path="support"      element={<AdminSupport />} />
            <Route path="ai-planner"   element={<AdminAIPlanner />} />
            <Route path="cms"          element={<AdminCMS />} />
            <Route path="settings"     element={<AdminSettings />} />
            <Route path="admins"       element={<AdminAdmins />} />
            <Route path="audit-logs"   element={<AdminAuditLogs />} />
            <Route path="system-health"element={<AdminSystemHealth />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {/* Global overlays — always visible regardless of route */}
      <InactivityWarning />
      <AIFloatingButton />
    </>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <BrowserRouter>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
