// ─── useVendorData — Single source of truth for all Vendor Dashboard metrics ───
// Every value is computed from real Supabase rows. Zero hardcoded data.
// Realtime subscriptions invalidate the relevant queries automatically.
//
// SCHEMA NOTES (verified against live DB):
//   bookings.provider_id      → provider_profiles.id  (NOT user_id)
//   payments.provider_id      → added + backfilled by VENDOR_DASHBOARD_MIGRATION.sql
//   reviews.provider_id       → provider_profiles.id
//   portfolio_items.provider_id → provider_profiles.id

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export type Period = '7d' | '30d' | '90d' | '1y';

export interface VendorKPIs {
  totalEarnings:    number;
  monthlyRevenue:   number;
  lastMonthRevenue: number;
  totalBookings:    number;
  upcomingEvents:   number;
  averageRating:    number;
  totalReviews:     number;
  pendingRequests:  number;
  repeatCustomers:  number;
  profileViews:     number;
  viewsThisWeek:    number;
  viewsToday:       number;
}

export interface VendorAnalytics {
  revenueGrowth:      number;
  bookingGrowth:      number;
  avgBookingValue:    number;
  acceptanceRate:     number;
  completionRate:     number;
  cancellationRate:   number;
  repeatCustomerRate: number;
  conversionRate:     number;
  responseRate:       number;
  customerLifetimeValue: number;
}

export interface ChartPoint { name: string; value: number; }
export interface BookingsChartPoint {
  name: string; completed: number; pending: number;
  cancelled: number; confirmed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function growth(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorId — resolves provider_profiles.id for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vendor-id', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('provider_profiles')
        .select('id, verification_status, is_published, is_available, profession, average_rating, total_reviews, total_bookings, bio, gallery_urls, vendor_details, price_min, experience_years, languages, social_links, cover_image_url, stage_name, whatsapp, bank_name, bank_account_holder, bank_account_number, bank_ifsc, branch_name, is_bank_verified')
        .eq('user_id', user.id)
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? (data[0] as any) : null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorRealtime — invalidates queries when any relevant table changes
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorRealtime(vendorId?: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vendorId) return;

    const tables = [
      'bookings', 'payments', 'reviews', 'messages',
      'portfolio_items', 'provider_availability',
      'profile_views', 'inquiries', 'pricing_packages',
      'notifications', 'provider_profiles', 'profiles',
    ];

    const channel = supabase.channel(`vendor-rt-${vendorId}`);

    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          // Invalidate every vendor query — cheap because all are keyed by vendorId
          qc.invalidateQueries({ queryKey: ['vendor-kpis'] });
          qc.invalidateQueries({ queryKey: ['vendor-analytics'] });
          qc.invalidateQueries({ queryKey: ['vendor-revenue-chart'] });
          qc.invalidateQueries({ queryKey: ['vendor-bookings-chart'] });
          qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
          qc.invalidateQueries({ queryKey: ['vendor-payments'] });
          qc.invalidateQueries({ queryKey: ['vendor-reviews'] });
          qc.invalidateQueries({ queryKey: ['vendor-portfolio'] });
          qc.invalidateQueries({ queryKey: ['vendor-packages'] });
          qc.invalidateQueries({ queryKey: ['vendor-messages'] });
          qc.invalidateQueries({ queryKey: ['vendor-inquiries'] });
          qc.invalidateQueries({ queryKey: ['vendor-availability'] });
          qc.invalidateQueries({ queryKey: ['vendor-insights'] });
          qc.invalidateQueries({ queryKey: ['vendor-badges'] });
          qc.invalidateQueries({ queryKey: ['vendor-notifications'] });
          qc.invalidateQueries({ queryKey: ['vendor-bank'] });
          qc.invalidateQueries({ queryKey: ['vendor-id'] });
        }
      );
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendorId, qc]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorKPIs — all 8 dashboard KPI values, computed from real rows
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorKPIs(vendorId?: string | null) {
  return useQuery<VendorKPIs>({
    queryKey: ['vendor-kpis', vendorId],
    queryFn: async () => {
      const empty: VendorKPIs = {
        totalEarnings: 0, monthlyRevenue: 0, lastMonthRevenue: 0,
        totalBookings: 0, upcomingEvents: 0, averageRating: 0,
        totalReviews: 0, pendingRequests: 0, repeatCustomers: 0,
        profileViews: 0, viewsThisWeek: 0, viewsToday: 0,
      };
      if (!vendorId) return empty;

      const todayISO = new Date().toISOString().split('T')[0];
      const thisMonth = startOfMonth(0);
      const lastMonth = startOfMonth(-1);

      // Run all queries in parallel
      const [bookingsRes, paymentsRes, reviewsRes, viewsRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, customer_id, status, amount, event_date, created_at')
          .eq('provider_id', vendorId),
        supabase.from('payments' as any)
          .select('id, amount, status, created_at, paid_at, payment_type')
          .eq('provider_id', vendorId),
        supabase.from('reviews' as any)
          .select('id, rating')
          .eq('provider_id', vendorId),
        supabase.from('profile_views' as any)
          .select('id, created_at')
          .eq('provider_id', vendorId),
      ]);

      const bookings = (bookingsRes.data ?? []) as any[];
      const payments = (paymentsRes.data ?? []) as any[];
      const reviews  = (reviewsRes.data  ?? []) as any[];
      const views    = (viewsRes.data    ?? []) as any[];

      // ── Earnings from completed payments ───────────────────────────────────
      const completedPayments = payments.filter(p =>
        ['completed', 'success', 'paid', 'captured'].includes(String(p.status ?? '').toLowerCase())
      );

      // Fall back to completed bookings if payments table is not yet populated
      const earningsSource = completedPayments.length > 0
        ? completedPayments
        : bookings
            .filter(b => b.status === 'completed')
            .map(b => ({ amount: b.amount, created_at: b.created_at, paid_at: b.created_at }));

      const totalEarnings = earningsSource.reduce((s, p) => s + Number(p.amount ?? 0), 0);

      const monthlyRevenue = earningsSource
        .filter(p => (p.paid_at ?? p.created_at) >= thisMonth)
        .reduce((s, p) => s + Number(p.amount ?? 0), 0);

      const lastMonthRevenue = earningsSource
        .filter(p => {
          const d = p.paid_at ?? p.created_at;
          return d >= lastMonth && d < thisMonth;
        })
        .reduce((s, p) => s + Number(p.amount ?? 0), 0);

      // ── Bookings ───────────────────────────────────────────────────────────
      const upcomingEvents = bookings.filter(b =>
        b.event_date && b.event_date >= todayISO &&
        ['confirmed', 'accepted', 'requested', 'pending'].includes(String(b.status))
      ).length;

      const pendingRequests = bookings.filter(b =>
        ['requested', 'pending'].includes(String(b.status))
      ).length;

      // ── Repeat customers: >1 completed booking ─────────────────────────────
      const completedByCustomer = new Map<string, number>();
      bookings
        .filter(b => b.status === 'completed' && b.customer_id)
        .forEach(b => completedByCustomer.set(b.customer_id, (completedByCustomer.get(b.customer_id) ?? 0) + 1));
      const repeatCustomers = [...completedByCustomer.values()].filter(c => c > 1).length;

      // ── Rating ─────────────────────────────────────────────────────────────
      const averageRating = reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviews.length) * 10) / 10
        : 0;

      // ── Profile views ──────────────────────────────────────────────────────
      const weekAgo = daysAgo(7);
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const dayStartISO = dayStart.toISOString();

      return {
        totalEarnings,
        monthlyRevenue,
        lastMonthRevenue,
        totalBookings:   bookings.length,
        upcomingEvents,
        averageRating,
        totalReviews:    reviews.length,
        pendingRequests,
        repeatCustomers,
        profileViews:    views.length,
        viewsThisWeek:   views.filter(v => v.created_at >= weekAgo).length,
        viewsToday:      views.filter(v => v.created_at >= dayStartISO).length,
      };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorAnalytics — derived business metrics
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorAnalytics(vendorId?: string | null) {
  return useQuery<VendorAnalytics>({
    queryKey: ['vendor-analytics', vendorId],
    queryFn: async () => {
      const empty: VendorAnalytics = {
        revenueGrowth: 0, bookingGrowth: 0, avgBookingValue: 0,
        acceptanceRate: 0, completionRate: 0, cancellationRate: 0,
        repeatCustomerRate: 0, conversionRate: 0, responseRate: 0,
        customerLifetimeValue: 0,
      };
      if (!vendorId) return empty;

      const thisMonth = startOfMonth(0);
      const lastMonth = startOfMonth(-1);

      const [bookingsRes, inquiriesRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, customer_id, status, amount, created_at, responded_at')
          .eq('provider_id', vendorId),
        supabase.from('inquiries' as any)
          .select('id, status, created_at')
          .eq('provider_id', vendorId),
      ]);

      const bookings  = (bookingsRes.data  ?? []) as any[];
      const inquiries = (inquiriesRes.data ?? []) as any[];

      if (bookings.length === 0 && inquiries.length === 0) return empty;

      const completed = bookings.filter(b => b.status === 'completed');
      const cancelled = bookings.filter(b => ['cancelled', 'rejected'].includes(String(b.status)));
      const accepted  = bookings.filter(b => ['confirmed', 'accepted', 'completed'].includes(String(b.status)));
      const responded = bookings.filter(b => b.responded_at || b.status !== 'requested');

      const thisMonthRev = completed
        .filter(b => b.created_at >= thisMonth)
        .reduce((s, b) => s + Number(b.amount ?? 0), 0);
      const lastMonthRev = completed
        .filter(b => b.created_at >= lastMonth && b.created_at < thisMonth)
        .reduce((s, b) => s + Number(b.amount ?? 0), 0);

      const thisMonthCount = bookings.filter(b => b.created_at >= thisMonth).length;
      const lastMonthCount = bookings.filter(b => b.created_at >= lastMonth && b.created_at < thisMonth).length;

      const totalRevenue = completed.reduce((s, b) => s + Number(b.amount ?? 0), 0);

      // Unique + repeat customers
      const byCustomer = new Map<string, number>();
      completed.filter(b => b.customer_id).forEach(b =>
        byCustomer.set(b.customer_id, (byCustomer.get(b.customer_id) ?? 0) + 1));
      const uniqueCustomers = byCustomer.size;
      const repeatCount = [...byCustomer.values()].filter(c => c > 1).length;

      return {
        revenueGrowth:      growth(thisMonthRev, lastMonthRev),
        bookingGrowth:      growth(thisMonthCount, lastMonthCount),
        avgBookingValue:    completed.length ? Math.round(totalRevenue / completed.length) : 0,
        acceptanceRate:     pct(accepted.length,  bookings.length),
        completionRate:     pct(completed.length, bookings.length),
        cancellationRate:   pct(cancelled.length, bookings.length),
        repeatCustomerRate: pct(repeatCount, uniqueCustomers),
        conversionRate:     inquiries.length ? pct(bookings.length, inquiries.length) : 0,
        responseRate:       pct(responded.length, bookings.length),
        customerLifetimeValue: uniqueCustomers ? Math.round(totalRevenue / uniqueCustomers) : 0,
      };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorRevenueChart — revenue aggregated by day/week/month for the period
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorRevenueChart(vendorId?: string | null, period: Period = '7d') {
  return useQuery<ChartPoint[]>({
    queryKey: ['vendor-revenue-chart', vendorId, period],
    queryFn: async () => {
      if (!vendorId) return [];
      const days = PERIOD_DAYS[period];
      const since = daysAgo(days);

      const [payRes, bookRes] = await Promise.all([
        supabase.from('payments' as any)
          .select('amount, status, created_at, paid_at')
          .eq('provider_id', vendorId)
          .gte('created_at', since),
        supabase.from('bookings')
          .select('amount, status, created_at')
          .eq('provider_id', vendorId)
          .eq('status', 'completed')
          .gte('created_at', since),
      ]);

      const payments = ((payRes.data ?? []) as any[]).filter(p =>
        ['completed', 'success', 'paid', 'captured'].includes(String(p.status ?? '').toLowerCase())
      );
      const rows = payments.length > 0
        ? payments.map(p => ({ amount: p.amount, date: p.paid_at ?? p.created_at }))
        : ((bookRes.data ?? []) as any[]).map(b => ({ amount: b.amount, date: b.created_at }));

      // Bucket by day (7d/30d) or month (90d/1y)
      const byMonth = period === '90d' || period === '1y';
      const buckets = new Map<string, number>();

      // Pre-seed buckets so the chart shows a continuous axis even with zero revenue
      if (byMonth) {
        const months = period === '90d' ? 3 : 12;
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i, 1);
          buckets.set(d.toLocaleDateString('en-US', { month: 'short' }), 0);
        }
      } else {
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          buckets.set(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), 0);
        }
      }

      rows.forEach(r => {
        if (!r.date) return;
        const d = new Date(r.date);
        const key = byMonth
          ? d.toLocaleDateString('en-US', { month: 'short' })
          : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(r.amount ?? 0));
      });

      return [...buckets.entries()].map(([name, value]) => ({ name, value }));
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorBookingsChart — booking counts by status, grouped by period
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorBookingsChart(vendorId?: string | null, period: Period = '30d') {
  return useQuery<BookingsChartPoint[]>({
    queryKey: ['vendor-bookings-chart', vendorId, period],
    queryFn: async () => {
      if (!vendorId) return [];
      const days = PERIOD_DAYS[period];
      const since = daysAgo(days);

      const { data } = await supabase.from('bookings')
        .select('status, created_at')
        .eq('provider_id', vendorId)
        .gte('created_at', since);

      const rows = (data ?? []) as any[];
      const byMonth = period === '90d' || period === '1y';
      const buckets = new Map<string, BookingsChartPoint>();

      const mk = (name: string): BookingsChartPoint =>
        ({ name, completed: 0, pending: 0, cancelled: 0, confirmed: 0 });

      if (byMonth) {
        const months = period === '90d' ? 3 : 12;
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i, 1);
          const k = d.toLocaleDateString('en-US', { month: 'short' });
          buckets.set(k, mk(k));
        }
      } else {
        const step = period === '30d' ? 5 : 1; // group 30d into 6 buckets
        for (let i = days - 1; i >= 0; i -= step) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const k = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          buckets.set(k, mk(k));
        }
      }

      const keys = [...buckets.keys()];

      rows.forEach(r => {
        const d = new Date(r.created_at);
        const key = byMonth
          ? d.toLocaleDateString('en-US', { month: 'short' })
          : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

        // Snap to the nearest existing bucket
        const target = buckets.has(key) ? key : keys[keys.length - 1];
        const b = buckets.get(target);
        if (!b) return;

        const s = String(r.status).toLowerCase();
        if (s === 'completed')                     b.completed++;
        else if (['requested', 'pending'].includes(s)) b.pending++;
        else if (['cancelled', 'rejected'].includes(s)) b.cancelled++;
        else if (['confirmed', 'accepted'].includes(s)) b.confirmed++;
      });

      return [...buckets.values()];
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorBookings — booking list with customer profile joined
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorBookings(vendorId?: string | null, status?: string) {
  return useQuery({
    queryKey: ['vendor-bookings', vendorId, status ?? 'all'],
    queryFn: async () => {
      if (!vendorId) return [];

      // Map UI status → DB values
      const statusMap: Record<string, string[]> = {
        requested: ['requested', 'pending'],
        confirmed: ['confirmed', 'accepted'],
        completed: ['completed'],
        cancelled: ['cancelled', 'rejected'],
      };
      const statusValues = status ? (statusMap[status] ?? [status]) : undefined;

      // Query 1: Generic bookings table
      let q1 = supabase.from('bookings')
        .select('*')
        .eq('provider_id', vendorId)
        .order('created_at', { ascending: false });
      if (statusValues) q1 = q1.in('status', statusValues);
      const { data: genericBookings } = await q1;

      // Query 2: Photography package bookings table
      let q2 = supabase.from('photography_package_bookings' as any)
        .select('*, photography_packages(name, photography_type)')
        .eq('photographer_id', vendorId)
        .order('created_at', { ascending: false });
      if (statusValues) q2 = q2.in('status', statusValues);
      const { data: photoBookings } = await q2;

      // Normalize photography bookings to match generic booking shape
      const normalizedPhotoBookings = (photoBookings ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.photographer_id,
        event_date: b.event_date,
        event_time: b.event_time,
        venue_address: b.venue,
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        requirements: b.notes,
        amount: b.total_amount,
        status: b.status,
        created_at: b.created_at,
        package_name: b.photography_packages?.name || 'Photography Package',
        photography_type: b.photography_packages?.photography_type,
        base_amount: b.base_amount,
        addons_amount: b.addons_amount,
        album_amount: b.album_amount,
        _source: 'photography',
      }));

      // Combine both lists
      const allBookings = [
        ...(genericBookings ?? []).map((b: any) => ({ ...b, _source: 'generic' })),
        ...normalizedPhotoBookings,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (allBookings.length === 0) return [];

      // Enrich with customer profiles
      const customerIds = [...new Set(allBookings.map(b => b.customer_id).filter(Boolean))];
      const profileMap = new Map<string, any>();
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id, full_name, email, phone, avatar_url')
          .in('id', customerIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      // Enrich generic bookings with package names
      const pkgIds = [...new Set(allBookings.filter(b => b._source === 'generic' && b.package_id).map(b => b.package_id))];
      const pkgMap = new Map<string, any>();
      if (pkgIds.length > 0) {
        const { data: pkgs } = await supabase.from('pricing_packages' as any)
          .select('id, name')
          .in('id', pkgIds);
        (pkgs ?? []).forEach((p: any) => pkgMap.set(p.id, p));
      }

      return allBookings.map(b => ({
        ...b,
        customer: profileMap.get(b.customer_id) ?? null,
        package_name: b.package_name || pkgMap.get(b.package_id)?.name || null,
      }));
    },
    enabled: !!vendorId,
    staleTime: 1000 * 30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorPayments — wallet balances + transaction list
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorPayments(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-payments', vendorId],
    queryFn: async () => {
      const empty = {
        available: 0, pending: 0, withdrawn: 0, lifetime: 0,
        transactions: [] as any[],
      };
      if (!vendorId) return empty;

      const { data } = await supabase.from('payments' as any)
        .select('*')
        .eq('provider_id', vendorId)
        .order('created_at', { ascending: false });

      const rows = (data ?? []) as any[];
      if (rows.length === 0) return empty;

      const isDone = (s: any) =>
        ['completed', 'success', 'paid', 'captured'].includes(String(s ?? '').toLowerCase());

      const lifetime  = rows.filter(r => isDone(r.status)).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const pending   = rows.filter(r => String(r.status).toLowerCase() === 'pending')
                            .reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const withdrawn = rows.filter(r => String(r.payout_status).toLowerCase() === 'withdrawn')
                            .reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const available = lifetime - withdrawn;

      return { available, pending, withdrawn, lifetime, transactions: rows };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorReviews — reviews + rating breakdown, customer names joined
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorReviews(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-reviews', vendorId],
    queryFn: async () => {
      const empty = { reviews: [] as any[], average: 0, total: 0, breakdown: [5,4,3,2,1].map(s => ({ stars: s, count: 0, percent: 0 })) };
      if (!vendorId) return empty;

      const { data } = await supabase.from('reviews' as any)
        .select('*')
        .eq('provider_id', vendorId)
        .order('created_at', { ascending: false });

      const rows = (data ?? []) as any[];
      if (rows.length === 0) return empty;

      // Join customer names
      const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))];
      const map = new Map<string, any>();
      if (custIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', custIds);
        (profiles ?? []).forEach((p: any) => map.set(p.id, p));
      }

      const reviews = rows.map(r => ({ ...r, customer: map.get(r.customer_id) ?? null }));
      const total = reviews.length;
      const average = Math.round((reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / total) * 10) / 10;
      const breakdown = [5, 4, 3, 2, 1].map(stars => {
        const count = reviews.filter(r => Number(r.rating) === stars).length;
        return { stars, count, percent: pct(count, total) };
      });

      return { reviews, average, total, breakdown };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorPortfolio — items + image/video counts
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorPortfolio(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-portfolio', vendorId],
    queryFn: async () => {
      const empty = { items: [] as any[], imageCount: 0, videoCount: 0, mostViewed: null as any };
      if (!vendorId) return empty;

      const { data } = await supabase.from('portfolio_items')
        .select('*')
        .eq('provider_id', vendorId)
        .order('created_at', { ascending: false });

      const items = (data ?? []) as any[];
      const imageCount = items.filter(i => i.media_type !== 'video').length;
      const videoCount = items.filter(i => i.media_type === 'video').length;
      const mostViewed = items.length > 0
        ? [...items].sort((a, b) => Number(b.view_count ?? 0) - Number(a.view_count ?? 0))[0]
        : null;

      return { items, imageCount, videoCount, mostViewed };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorPackages — packages + booking counts + conversion
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorPackages(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-packages', vendorId],
    queryFn: async () => {
      const empty = { packages: [] as any[], mostPopular: null as any, totalBookings: 0 };
      if (!vendorId) return empty;

      const { data } = await supabase.from('pricing_packages' as any)
        .select('*')
        .eq('provider_id', vendorId)
        .order('price', { ascending: true });

      const packages = (data ?? []) as any[];
      if (packages.length === 0) return empty;

      const totalBookings = packages.reduce((s, p) => s + Number(p.booking_count ?? 0), 0);
      const withMetrics = packages.map(p => ({
        ...p,
        conversionRate: Number(p.view_count) > 0
          ? pct(Number(p.booking_count ?? 0), Number(p.view_count))
          : 0,
        sharePct: pct(Number(p.booking_count ?? 0), totalBookings),
      }));
      const mostPopular = [...withMetrics].sort(
        (a, b) => Number(b.booking_count ?? 0) - Number(a.booking_count ?? 0)
      )[0];

      return { packages: withMetrics, mostPopular, totalBookings };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorMessages — recent chats grouped by booking, unread counts
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorMessages(vendorId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vendor-messages', vendorId, user?.id],
    queryFn: async () => {
      const empty = { chats: [] as any[], unreadTotal: 0 };
      if (!vendorId || !user) return empty;

      // Bookings for this vendor define the chat threads
      const { data: bookings } = await supabase.from('bookings')
        .select('id, customer_id, event_type_id, event_date')
        .eq('provider_id', vendorId);

      const bookingList = (bookings ?? []) as any[];
      if (bookingList.length === 0) return empty;

      const bookingIds = bookingList.map(b => b.id);
      const { data: msgs } = await supabase.from('messages' as any)
        .select('*')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      const messages = (msgs ?? []) as any[];

      // Customer profiles
      const custIds = [...new Set(bookingList.map(b => b.customer_id).filter(Boolean))];
      const profileMap = new Map<string, any>();
      if (custIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id, full_name, avatar_url, last_active_at')
          .in('id', custIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      // Build one chat per booking that has messages
      const chats = bookingList
        .map(b => {
          const thread = messages.filter(m => m.booking_id === b.id);
          if (thread.length === 0) return null;
          const last = thread[0];
          const unread = thread.filter(m => !m.is_read && m.sender_id !== user.id).length;
          return {
            bookingId: b.id,
            customer:  profileMap.get(b.customer_id) ?? null,
            lastMessage: last.content ?? '',
            lastAt:      last.created_at,
            unread,
            messages:    [...thread].reverse(),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (a.lastAt < b.lastAt ? 1 : -1));

      const unreadTotal = chats.reduce((s: number, c: any) => s + c.unread, 0);
      return { chats, unreadTotal };
    },
    enabled: !!vendorId && !!user,
    staleTime: 1000 * 20,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorInquiries — inquiry counts by status
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorInquiries(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-inquiries', vendorId],
    queryFn: async () => {
      const empty = { inquiries: [] as any[], unread: 0, read: 0, replied: 0, pending: 0 };
      if (!vendorId) return empty;

      const { data } = await supabase.from('inquiries' as any)
        .select('*')
        .eq('provider_id', vendorId)
        .order('created_at', { ascending: false });

      const inquiries = (data ?? []) as any[];
      return {
        inquiries,
        unread:  inquiries.filter(i => !i.is_read).length,
        read:    inquiries.filter(i => i.is_read).length,
        replied: inquiries.filter(i => i.status === 'replied').length,
        pending: inquiries.filter(i => i.status === 'pending').length,
      };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorAvailability — calendar state: booked / tentative / blocked dates
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorAvailability(vendorId?: string | null) {
  return useQuery({
    queryKey: ['vendor-availability', vendorId],
    queryFn: async () => {
      const empty = { booked: [] as string[], tentative: [] as string[], blocked: [] as string[] };
      if (!vendorId) return empty;

      const [availRes, bookRes] = await Promise.all([
        supabase.from('provider_availability')
          .select('unavailable_date, status, slot_type')
          .eq('provider_id', vendorId),
        supabase.from('bookings')
          .select('event_date, status')
          .eq('provider_id', vendorId)
          .in('status', ['confirmed', 'accepted', 'requested', 'pending']),
      ]);

      const avail = (availRes.data ?? []) as any[];
      const books = (bookRes.data  ?? []) as any[];

      // Confirmed bookings → red (booked). Requested → orange (tentative).
      const booked = books
        .filter(b => ['confirmed', 'accepted'].includes(String(b.status)))
        .map(b => String(b.event_date)).filter(Boolean);

      const tentativeFromBookings = books
        .filter(b => ['requested', 'pending'].includes(String(b.status)))
        .map(b => String(b.event_date)).filter(Boolean);

      const tentativeFromAvail = avail
        .filter(a => String(a.status) === 'tentative')
        .map(a => String(a.unavailable_date)).filter(Boolean);

      const blocked = avail
        .filter(a => String(a.status) !== 'tentative' && String(a.status) !== 'available')
        .map(a => String(a.unavailable_date)).filter(Boolean);

      return {
        booked:    [...new Set(booked)],
        tentative: [...new Set([...tentativeFromBookings, ...tentativeFromAvail])],
        blocked:   [...new Set(blocked)],
      };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorInsights — AI insights generated from real metrics only
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorInsights(
  vendorId?: string | null,
  provider?: any,
  kpis?: VendorKPIs,
  analytics?: VendorAnalytics,
  packages?: any[],
) {
  return useMemo<string[]>(() => {
    if (!vendorId || !kpis) return [];
    const out: string[] = [];

    // Profile views
    if (kpis.viewsThisWeek > 0) {
      out.push(`You received ${kpis.viewsThisWeek} profile view${kpis.viewsThisWeek === 1 ? '' : 's'} this week.`);
    }

    // Portfolio depth
    const galleryCount = Array.isArray(provider?.gallery_urls) ? provider.gallery_urls.length : 0;
    if (galleryCount > 0 && galleryCount < 10) {
      out.push(`Your portfolio has ${galleryCount} item${galleryCount === 1 ? '' : 's'}. Vendors with 10+ items receive noticeably more enquiries.`);
    }

    // Package performance
    if (packages && packages.length > 1) {
      const sorted = [...packages].sort((a, b) => Number(b.booking_count ?? 0) - Number(a.booking_count ?? 0));
      const top = sorted[0];
      if (Number(top?.booking_count ?? 0) > 0) {
        out.push(`"${top.name}" is your most-booked package with ${top.booking_count} booking${Number(top.booking_count) === 1 ? '' : 's'}.`);
      }
    }

    // Analytics-driven
    if (analytics) {
      if (analytics.revenueGrowth !== 0) {
        const dir = analytics.revenueGrowth > 0 ? 'increased' : 'decreased';
        out.push(`Revenue ${dir} ${Math.abs(analytics.revenueGrowth)}% compared with last month.`);
      }
      if (analytics.bookingGrowth !== 0) {
        const dir = analytics.bookingGrowth > 0 ? 'up' : 'down';
        out.push(`Bookings are ${dir} ${Math.abs(analytics.bookingGrowth)}% month over month.`);
      }
      if (analytics.cancellationRate > 0) {
        out.push(`Your cancellation rate is ${analytics.cancellationRate}%. Keeping this low improves search ranking.`);
      }
      if (analytics.avgBookingValue > 0) {
        out.push(`Average booking value is ₹${analytics.avgBookingValue.toLocaleString('en-IN')}.`);
      }
      if (analytics.repeatCustomerRate > 0) {
        out.push(`${analytics.repeatCustomerRate}% of your customers book more than once.`);
      }
      if (analytics.conversionRate > 0) {
        out.push(`${analytics.conversionRate}% of enquiries convert into bookings.`);
      }
    }

    // Pending action
    if (kpis.pendingRequests > 0) {
      out.push(`${kpis.pendingRequests} booking request${kpis.pendingRequests === 1 ? '' : 's'} awaiting your response. Faster replies win more bookings.`);
    }

    // Rating
    if (kpis.totalReviews > 0) {
      out.push(`Your rating is ${kpis.averageRating}/5 across ${kpis.totalReviews} review${kpis.totalReviews === 1 ? '' : 's'}.`);
    } else if (kpis.totalBookings > 0) {
      out.push('You have no reviews yet. Ask completed customers to leave one — reviews strongly influence bookings.');
    }

    // Bio completeness
    if (!provider?.bio || String(provider.bio).trim().length < 50) {
      out.push('Your bio is short. A detailed bio helps customers understand your style and pricing.');
    }

    return out;
  }, [vendorId, provider, kpis, analytics, packages]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorProfileCompletion — real completion % from actual profile data
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorProfileCompletion(provider?: any, portfolioCount = 0, packageCount = 0) {
  return useMemo(() => {
    if (!provider) return { percent: 0, checklist: [] };

    const vd = provider.vendor_details ?? {};
    const galleryCount = Array.isArray(provider.gallery_urls) ? provider.gallery_urls.length : 0;

    const checklist = [
      { label: 'Basic Details',  done: !!provider.profession && !!provider.experience_years },
      { label: 'About / Bio',    done: String(provider.bio ?? '').trim().length > 50 },
      { label: 'Portfolio',      done: galleryCount + portfolioCount >= 2 },
      { label: 'Packages',       done: packageCount > 0 },
      { label: 'Pricing',        done: Number(provider.price_min ?? 0) > 0 },
      { label: 'Verification',   done: provider.verification_status === 'approved' },
      { label: 'Documents',      done: !!vd.aadhaar_url && !!vd.govt_id_url },
      { label: 'Bank Details',   done: !!provider.bank_account_number },
    ];

    const done = checklist.filter(c => c.done).length;
    return {
      percent: Math.round((done / checklist.length) * 100),
      checklist,
    };
  }, [provider, portfolioCount, packageCount]);
}

// ─────────────────────────────────────────────────────────────────────────────
// trackProfileView — call this from the public provider profile page
// ─────────────────────────────────────────────────────────────────────────────
export async function trackProfileView(
  providerId: string,
  viewerId?: string | null,
  source: string = 'direct',
) {
  if (!providerId) return;
  try {
    await supabase.from('profile_views' as any).insert({
      provider_id: providerId,
      viewer_id:   viewerId ?? null,
      source,
    });
  } catch (e) {
    // Non-critical — never block the UI on analytics
    console.warn('[trackProfileView] failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorBadges — REAL sidebar/topbar counts. No hardcoded numbers.
//   bookings      = COUNT(status IN ('requested','pending'))
//   messages      = COUNT(unread messages not sent by me)
//   inquiries     = COUNT(is_read = false)
//   notifications = COUNT(is_read = false) for my auth user
// ─────────────────────────────────────────────────────────────────────────────
export interface VendorBadges {
  bookings:      number;
  messages:      number;
  inquiries:     number;
  notifications: number;
}

export function useVendorBadges(vendorId?: string | null) {
  const { user } = useAuth();

  return useQuery<VendorBadges>({
    queryKey: ['vendor-badges', vendorId, user?.id],
    queryFn: async () => {
      const empty: VendorBadges = { bookings: 0, messages: 0, inquiries: 0, notifications: 0 };
      if (!vendorId || !user) return empty;

      // Pending bookings — exact count, no rows transferred
      const bookingsP = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', vendorId)
        .in('status', ['requested', 'pending']);

      // Unread inquiries
      const inquiriesP = supabase
        .from('inquiries' as any)
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', vendorId)
        .eq('is_read', false);

      // Unread notifications for this auth user
      const notifsP = supabase
        .from('notifications' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      // Unread messages: need my booking ids first
      const bookingIdsP = supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', vendorId);

      const [bRes, iRes, nRes, idRes] = await Promise.all([
        bookingsP, inquiriesP, notifsP, bookingIdsP,
      ]);

      let messages = 0;
      const bookingIds = ((idRes.data ?? []) as any[]).map(b => b.id);
      if (bookingIds.length > 0) {
        const { count } = await supabase
          .from('messages' as any)
          .select('id', { count: 'exact', head: true })
          .in('booking_id', bookingIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);
        messages = count ?? 0;
      }

      return {
        bookings:      bRes.count ?? 0,
        messages,
        inquiries:     iRes.count ?? 0,
        notifications: nRes.count ?? 0,
      };
    },
    enabled: !!vendorId && !!user,
    staleTime: 1000 * 10,
    refetchOnWindowFocus: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorNotifications — real notification feed with unread count
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorNotifications(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vendor-notifications', user?.id, limit],
    queryFn: async () => {
      const empty = { notifications: [] as any[], unread: 0 };
      if (!user) return empty;

      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      const notifications = (data ?? []) as any[];
      return {
        notifications,
        unread: notifications.filter(n => !n.is_read).length,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 10,
  });
}

/** Mark a single notification read. */
export async function markNotificationRead(id: string) {
  return supabase.from('notifications' as any).update({ is_read: true }).eq('id', id);
}

/** Mark every notification read for the given user. */
export async function markAllNotificationsRead(userId: string) {
  return supabase
    .from('notifications' as any)
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

/** Mark all unread messages in a booking thread as read (not sent by me). */
export async function markThreadRead(bookingId: string, myUserId: string) {
  return supabase
    .from('messages' as any)
    .update({ is_read: true })
    .eq('booking_id', bookingId)
    .eq('is_read', false)
    .neq('sender_id', myUserId);
}

/** Mark an inquiry as read. */
export async function markInquiryRead(id: string) {
  return supabase
    .from('inquiries' as any)
    .update({ is_read: true, status: 'read' })
    .eq('id', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorBankDetails — real bank/payout details from provider_profiles
// ─────────────────────────────────────────────────────────────────────────────
export interface BankDetails {
  hasBank:        boolean;
  bankName:       string | null;
  accountHolder:  string | null;
  accountNumber:  string | null;  // raw — mask at render time
  maskedAccount:  string | null;
  ifsc:           string | null;
  branchName:     string | null;
  isVerified:     boolean;
}

export function useVendorBankDetails(vendorId?: string | null) {
  return useQuery<BankDetails>({
    queryKey: ['vendor-bank', vendorId],
    queryFn: async () => {
      const empty: BankDetails = {
        hasBank: false, bankName: null, accountHolder: null,
        accountNumber: null, maskedAccount: null, ifsc: null,
        branchName: null, isVerified: false,
      };
      if (!vendorId) return empty;

      const { data } = await supabase
        .from('provider_profiles')
        .select('bank_name, bank_account_holder, bank_account_number, bank_ifsc, branch_name, is_bank_verified')
        .eq('id', vendorId)
        .limit(1);

      const row = (data ?? [])[0] as any;
      if (!row) return empty;

      const acct = row.bank_account_number ? String(row.bank_account_number) : null;

      return {
        hasBank:       !!acct,
        bankName:      row.bank_name ?? null,
        accountHolder: row.bank_account_holder ?? null,
        accountNumber: acct,
        maskedAccount: acct ? `${'•'.repeat(Math.max(0, acct.length - 4))}${acct.slice(-4)}` : null,
        ifsc:          row.bank_ifsc ?? null,
        branchName:    row.branch_name ?? null,
        isVerified:    !!row.is_bank_verified,
      };
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });
}

/** Persist bank details onto provider_profiles. */
export async function saveBankDetails(vendorId: string, payload: {
  bank_name?: string;
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  branch_name?: string;
}) {
  return supabase
    .from('provider_profiles')
    .update({ ...payload, is_bank_verified: false } as any)  // re-verify on change
    .eq('id', vendorId);
}
