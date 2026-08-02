// ─── useAdminStats — Real-time Supabase queries for every admin dashboard card ─
// Exports a single hook that returns all stats + a refresh function.
// Components can call refresh() after any action to update all cards instantly.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminStats {
  // Artists
  totalArtists:          number;
  pendingVerifications:  number;
  approvedArtists:       number;
  rejectedArtists:       number;
  // Customers
  totalUsers:            number;
  activeCustomers:       number;
  // Bookings
  totalBookings:         number;
  todayBookings:         number;
  pendingBookings:       number;
  confirmedBookings:     number;
  completedBookings:     number;
  cancelledBookings:     number;
  // Revenue
  totalRevenue:          number;
  todayRevenue:          number;
  monthlyRevenue:        number;
  // Misc
  totalCategories:       number;
  totalReviews:          number;
  averageRating:         number;
  // Loading
  loading:               boolean;
  lastUpdated:           Date | null;
}

const INITIAL: AdminStats = {
  totalArtists:0, pendingVerifications:0, approvedArtists:0, rejectedArtists:0,
  totalUsers:0, activeCustomers:0,
  totalBookings:0, todayBookings:0, pendingBookings:0, confirmedBookings:0,
  completedBookings:0, cancelledBookings:0,
  totalRevenue:0, todayRevenue:0, monthlyRevenue:0,
  totalCategories:0, totalReviews:0, averageRating:0,
  loading:true, lastUpdated:null,
};

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>(INITIAL);

  const load = useCallback(async () => {
    setStats(s => ({ ...s, loading: true }));
    try {
      const today     = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        artistsRes, usersRes, bookingsRes,
        paymentsRes, catsRes, reviewsRes,
      ] = await Promise.allSettled([
        supabase.from('provider_profiles').select('id,verification_status', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id,status,total_amount,created_at', { count: 'exact' }),
        supabase.from('payments' as any).select('amount,created_at,status'),
        supabase.from('artist_categories' as any).select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('rating'),
      ]);

      const artists  = artistsRes.status  === 'fulfilled' ? (artistsRes.value.data  ?? []) : [];
      const totalUsers = usersRes.status  === 'fulfilled' ? (usersRes.value.count   ?? 0)  : 0;
      const bookings = bookingsRes.status === 'fulfilled' ? (bookingsRes.value.data ?? []) : [];
      const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data ?? []) : [];
      const cats     = catsRes.status     === 'fulfilled' ? (catsRes.value.count    ?? 0)  : 0;
      const reviews  = reviewsRes.status  === 'fulfilled' ? (reviewsRes.value.data  ?? []) : [];

      const completedPay = payments.filter((p: any) => p.status === 'completed');
      const todayPay     = completedPay.filter((p: any) => p.created_at?.startsWith(today));
      const monthPay     = completedPay.filter((p: any) => p.created_at >= monthStart);

      const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
        : 0;

      setStats({
        totalArtists:         artists.length,
        pendingVerifications: artists.filter((a: any) => a.verification_status === 'pending').length,
        approvedArtists:      artists.filter((a: any) => a.verification_status === 'approved').length,
        rejectedArtists:      artists.filter((a: any) => a.verification_status === 'rejected').length,
        totalUsers,
        activeCustomers:      Math.max(0, totalUsers - artists.length),
        totalBookings:        bookings.length,
        todayBookings:        bookings.filter((b: any) => b.created_at?.startsWith(today)).length,
        pendingBookings:      bookings.filter((b: any) => b.status === 'pending').length,
        confirmedBookings:    bookings.filter((b: any) => b.status === 'confirmed').length,
        completedBookings:    bookings.filter((b: any) => b.status === 'completed').length,
        cancelledBookings:    bookings.filter((b: any) => b.status === 'cancelled').length,
        totalRevenue:   completedPay.reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
        todayRevenue:   todayPay.reduce(   (s: number, p: any) => s + (p.amount ?? 0), 0),
        monthlyRevenue: monthPay.reduce(   (s: number, p: any) => s + (p.amount ?? 0), 0),
        totalCategories: cats,
        totalReviews:    reviews.length,
        averageRating:   parseFloat(avgRating.toFixed(1)),
        loading:         false,
        lastUpdated:     new Date(),
      });
    } catch (e) {
      console.error('[useAdminStats]', e);
      setStats(s => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription: refresh on booking or artist changes
  useEffect(() => {
    const ch1 = supabase.channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe();
    const ch2 = supabase.channel('admin-artists')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_profiles' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [load]);

  return { stats, refresh: load };
}

export const fmtCurrency = (n: number) =>
  n >= 10000000 ? `₹${(n/10000000).toFixed(1)}Cr`
: n >= 100000   ? `₹${(n/100000).toFixed(1)}L`
: n >= 1000     ? `₹${(n/1000).toFixed(0)}K`
: `₹${n.toLocaleString('en-IN')}`;
