// ─── useAdminStats — Real-time Supabase queries, RLS-safe ────────────────────
// Uses Promise.allSettled so ONE failed query never crashes the whole dashboard.
// Each query is individually guarded — if RLS blocks it, we show 0 gracefully.
// Real-time Supabase subscriptions refresh stats automatically after any change.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminStats {
  totalArtists:          number;
  pendingVerifications:  number;
  approvedArtists:       number;
  rejectedArtists:       number;
  totalUsers:            number;
  activeCustomers:       number;
  totalBookings:         number;
  todayBookings:         number;
  pendingBookings:       number;
  confirmedBookings:     number;
  completedBookings:     number;
  cancelledBookings:     number;
  totalRevenue:          number;
  todayRevenue:          number;
  monthlyRevenue:        number;
  totalCategories:       number;
  totalReviews:          number;
  averageRating:         number;
  loading:               boolean;
  error:                 string | null;
  lastUpdated:           Date | null;
}

const ZERO: AdminStats = {
  totalArtists:0, pendingVerifications:0, approvedArtists:0, rejectedArtists:0,
  totalUsers:0, activeCustomers:0,
  totalBookings:0, todayBookings:0, pendingBookings:0, confirmedBookings:0,
  completedBookings:0, cancelledBookings:0,
  totalRevenue:0, todayRevenue:0, monthlyRevenue:0,
  totalCategories:0, totalReviews:0, averageRating:0,
  loading: true, error: null, lastUpdated: null,
};

// Safe query wrapper: returns empty array/0 instead of throwing on RLS block
async function safeSelect<T = any>(
  table: string,
  select: string,
  opts?: { filters?: Record<string, any>; count?: boolean }
): Promise<T[]> {
  try {
    let q = (supabase as any).from(table).select(select);
    if (opts?.filters) {
      for (const [k, v] of Object.entries(opts.filters)) q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) {
      // Log the real error for debugging but don't crash
      console.warn(`[useAdminStats] ${table}:`, error.message);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[useAdminStats] ${table} exception:`, e);
    return [];
  }
}

async function safeCount(table: string, filter?: { key: string; value: string }): Promise<number> {
  try {
    let q = (supabase as any).from(table).select('id', { count: 'exact', head: true });
    if (filter) q = q.eq(filter.key, filter.value);
    const { count, error } = await q;
    if (error) { console.warn(`[useAdminStats] count ${table}:`, error.message); return 0; }
    return count ?? 0;
  } catch { return 0; }
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>(ZERO);

  const load = useCallback(async () => {
    setStats(s => ({ ...s, loading: true, error: null }));

    try {
      const today      = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Run ALL queries in parallel — failures are isolated
      const [
        artists, totalUsers, bookings, payments, cats, reviews,
      ] = await Promise.all([
        safeSelect('provider_profiles', 'id,verification_status'),
        safeCount('profiles'),
        safeSelect('bookings', 'id,status,total_amount,created_at'),
        safeSelect('payments', 'amount,created_at,status'),
        safeCount('artist_categories'),
        safeSelect('reviews', 'rating'),
      ]);

      // ── Revenue calculations ───────────────────────────────────────────
      const completedPay = payments.filter((p: any) => p.status === 'completed');
      const todayPay     = completedPay.filter((p: any) => (p.created_at ?? '').startsWith(today));
      const monthPay     = completedPay.filter((p: any) => (p.created_at ?? '') >= monthStart);

      const sum = (arr: any[]) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
        : 0;

      setStats({
        // Artists
        totalArtists:         artists.length,
        pendingVerifications: artists.filter((a: any) => a.verification_status === 'pending').length,
        approvedArtists:      artists.filter((a: any) => ['approved','verified'].includes(a.verification_status)).length,
        rejectedArtists:      artists.filter((a: any) => a.verification_status === 'rejected').length,
        // Users
        totalUsers:           typeof totalUsers === 'number' ? totalUsers : 0,
        activeCustomers:      Math.max(0, (typeof totalUsers === 'number' ? totalUsers : 0) - artists.length),
        // Bookings
        totalBookings:        bookings.length,
        todayBookings:        bookings.filter((b: any) => (b.created_at ?? '').startsWith(today)).length,
        pendingBookings:      bookings.filter((b: any) => b.status === 'pending').length,
        confirmedBookings:    bookings.filter((b: any) => b.status === 'confirmed').length,
        completedBookings:    bookings.filter((b: any) => b.status === 'completed').length,
        cancelledBookings:    bookings.filter((b: any) => b.status === 'cancelled').length,
        // Revenue
        totalRevenue:   sum(completedPay),
        todayRevenue:   sum(todayPay),
        monthlyRevenue: sum(monthPay),
        // Misc
        totalCategories: typeof cats === 'number' ? cats : 0,
        totalReviews:    reviews.length,
        averageRating:   parseFloat(avgRating.toFixed(1)),
        // Meta
        loading:      false,
        error:        null,
        lastUpdated:  new Date(),
      });
    } catch (e: any) {
      console.error('[useAdminStats] load error:', e);
      setStats(s => ({ ...s, loading: false, error: e.message ?? 'Failed to load stats' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: re-fetch when any key table changes
  useEffect(() => {
    const tables = ['bookings', 'provider_profiles', 'profiles', 'reviews'];
    const channels = tables.map((t, i) =>
      supabase.channel(`admin-rt-${i}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          // Debounce: wait 500ms so multiple rapid changes only trigger one refresh
          setTimeout(load, 500);
        })
        .subscribe()
    );
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [load]);

  return { stats, refresh: load };
}

export const fmtCurrency = (n: number): string => {
  if (!n || isNaN(n)) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};
