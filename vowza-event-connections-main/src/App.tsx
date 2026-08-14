import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProviderRegistrationProvider } from "@/contexts/ProviderRegistrationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import InactivityWarning from "@/components/InactivityWarning";
import BookAnArtistFloat from "@/components/BookAnArtistFloat";

const Index                = lazy(() => import("./pages/Index"));
const Auth                 = lazy(() => import("./pages/Auth"));
const AuthCallback         = lazy(() => import("./pages/AuthCallback"));
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
const BookingSuccess       = lazy(() => import("./pages/BookingSuccess"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const AIPlanner            = lazy(() => import("./pages/AIPlanner"));
const EventPlanning        = lazy(() => import("./pages/EventPlanning"));
const CustomerEventDashboard = lazy(() => import("./pages/CustomerEventDashboard"));
const Contact              = lazy(() => import("./pages/Contact"));
const PrivacyPolicy        = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService       = lazy(() => import("./pages/TermsOfService"));
const CategoryPage         = lazy(() => import("./pages/CategoryPage"));
const CateringCartPage     = lazy(() => import("./pages/CateringCartPage"));
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
const AdminEventPackages   = lazy(() => import("./pages/admin/AdminEventPackages"));
const AdminReports         = lazy(() => import("./pages/admin/AdminReports"));
const AdminSupport         = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAIPlanner       = lazy(() => import("./pages/admin/AdminAIPlanner"));
const AdminCMS             = lazy(() => import("./pages/admin/AdminCMS"));
const AdminSettings        = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAdmins          = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminAuditLogs       = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminSystemHealth    = lazy(() => import("./pages/admin/AdminSystemHealth"));
const AdminAuthPromotionalManager = lazy(() => import("./pages/admin/AdminAuthPromotionalManager"));

// ─── Customer (user dashboard) ────────────────────────────────────────────────
const CustomerLayout       = lazy(() => import("./pages/customer/CustomerLayout"));
const DashboardHome        = lazy(() => import("./pages/customer/DashboardHome"));
const MyBookingsPage       = lazy(() => import("./pages/customer/MyBookingsPage"));
const WishlistPage         = lazy(() => import("./pages/customer/WishlistPage"));
const NotificationsPage    = lazy(() => import("./pages/customer/NotificationsPage"));
const MyProfilePage        = lazy(() => import("./pages/customer/MyProfilePage"));
const PaymentHistoryPage   = lazy(() => import("./pages/customer/PaymentHistoryPage"));
const MyReviewsPage        = lazy(() => import("./pages/customer/MyReviewsPage"));
const AIPlannerListPage    = lazy(() => import("./pages/customer/AIPlannerListPage"));
const CustomerSettingsPage = lazy(() => import("./pages/customer/SettingsPage"));
const CustomerHelpSupport  = lazy(() => import("./pages/customer/CustomerHelpSupport"));

// ─── Vendor (artist/provider dashboard) ───────────────────────────────────────
const VendorLayout         = lazy(() => import("./pages/vendor/VendorLayout"));
const VendorDashboardHome  = lazy(() => import("./pages/vendor/VendorDashboardHome"));
const VendorBookings       = lazy(() => import("./pages/vendor/VendorBookings"));
const VendorPortfolio      = lazy(() => import("./pages/vendor/VendorPortfolio"));
const VendorPackages       = lazy(() => import("./pages/vendor/VendorPackages"));
const VendorWallet         = lazy(() => import("./pages/vendor/VendorWallet"));
const VendorReviews        = lazy(() => import("./pages/vendor/VendorReviews"));
const VendorMessages       = lazy(() => import("./pages/vendor/VendorMessages"));
const VendorNotifications  = lazy(() => import("./pages/vendor/VendorNotifications"));
const VendorSettings       = lazy(() => import("./pages/vendor/VendorSettings"));
const VendorCalendar       = lazy(() => import("./pages/vendor/VendorCalendar"));
const VendorHelpSupport    = lazy(() => import("./pages/vendor/VendorHelpSupport"));

// ─── Page loader fallback ─────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <img src="/favicon.svg" alt="Vowza" className="w-12 h-12 animate-pulse" />
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
          <Route path="/auth/callback" element={<AuthCallback />} />
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
          <Route path="/catering-cart" element={<ProtectedRoute><CateringCartPage /></ProtectedRoute>} />
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
            <Route path="event-packages" element={<AdminEventPackages />} />
            <Route path="reports"      element={<AdminReports />} />
            <Route path="support"      element={<AdminSupport />} />
            <Route path="ai-planner"   element={<AdminAIPlanner />} />
            <Route path="cms"          element={<AdminCMS />} />
            <Route path="settings"     element={<AdminSettings />} />
            <Route path="admins"       element={<AdminAdmins />} />
            <Route path="audit-logs"   element={<AdminAuditLogs />} />
            <Route path="system-health"element={<AdminSystemHealth />} />
            <Route path="auth-promotion" element={<AdminAuthPromotionalManager />} />
          </Route>

          {/* ── Customer — CustomerLayout handles auth + customer-only role check internally ── */}
          <Route path="/dashboard" element={<CustomerLayout />}>
            <Route index               element={<DashboardHome />} />
            <Route path="bookings"     element={<MyBookingsPage />} />
            <Route path="wishlist"     element={<WishlistPage />} />
            <Route path="notifications"element={<NotificationsPage />} />
            <Route path="profile"      element={<MyProfilePage />} />
            <Route path="payments"     element={<PaymentHistoryPage />} />
            <Route path="reviews"      element={<MyReviewsPage />} />
            <Route path="ai-planner"   element={<AIPlannerListPage />} />
            <Route path="settings"     element={<CustomerSettingsPage />} />
            <Route path="help"         element={<CustomerHelpSupport />} />
          </Route>

          {/* ── Vendor — VendorLayout handles auth + provider role check internally ── */}
          <Route path="/vendor" element={<VendorLayout />}>
            <Route path="dashboard"     element={<VendorDashboardHome />} />
            <Route path="bookings"      element={<VendorBookings />} />
            <Route path="calendar"      element={<VendorCalendar />} />
            <Route path="inquiries"     element={<VendorBookings />} />
            <Route path="messages"      element={<VendorMessages />} />
            <Route path="notifications" element={<VendorNotifications />} />
            <Route path="portfolio"     element={<VendorPortfolio />} />
            <Route path="packages"      element={<VendorPackages />} />
            <Route path="reviews"       element={<VendorReviews />} />
            <Route path="analytics"     element={<VendorDashboardHome />} />
            <Route path="wallet"        element={<VendorWallet />} />
            <Route path="settings"      element={<VendorSettings />} />
            <Route path="help"          element={<VendorHelpSupport />} />
          </Route>

          <Route path="/booking-success" element={<ProtectedRoute><BookingSuccess /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {/* Global overlays — always visible regardless of route */}
      <InactivityWarning />
      <BookAnArtistFloat />
    </>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <ProviderRegistrationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" richColors />
            <BrowserRouter>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </ProviderRegistrationProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
