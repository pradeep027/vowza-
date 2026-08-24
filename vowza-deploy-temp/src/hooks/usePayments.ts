// ─── usePayments — Customer payment history ───────────────────────────────────
// payments table has no customer_id column — scope via bookings.customer_id
// using a two-step query (same pattern as useBookings/useArtists — no PGRST200
// nested-join errors).

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface PaymentWithBooking {
  id: string;
  booking_id: string;
  amount: number;
  provider_amount: number;
  platform_fee: number | null;
  payment_method: string | null;
  status: PaymentStatus;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  // Joined booking context
  booking_event_date: string | null;
  booking_venue_city: string | null;
  provider_name: string;
}

export const usePayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentWithBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!user) {
      setPayments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1 — bookings belonging to this customer
      const { data: bookings, error: bErr } = await supabase
        .from('bookings')
        .select('id, event_date, venue_city, provider_id')
        .eq('customer_id', user.id);

      if (bErr) throw bErr;
      if (!bookings || bookings.length === 0) {
        setPayments([]);
        setIsLoading(false);
        return;
      }

      const bookingIds = bookings.map(b => b.id);
      const bookingMap = new Map(bookings.map(b => [b.id, b]));

      // Step 2 — payments for those bookings
      const { data: paymentsData, error: pErr } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;
      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        setIsLoading(false);
        return;
      }

      // Step 3 — provider names for context (provider_profiles -> profiles)
      const providerIds = [...new Set(bookings.map(b => b.provider_id).filter(Boolean))];
      const { data: providersData } = await supabase
        .from('provider_profiles')
        .select('id, user_id, stage_name')
        .in('id', providerIds);

      const providerUserIds = (providersData ?? []).map(p => p.user_id).filter(Boolean);
      const { data: profilesData } = providerUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', providerUserIds)
        : { data: [] as { id: string; full_name: string | null }[] };

      const profileNameMap = new Map((profilesData ?? []).map(p => [p.id, p.full_name]));
      const providerNameMap = new Map(
        (providersData ?? []).map(p => [p.id, p.stage_name || profileNameMap.get(p.user_id) || 'Unknown Artist'])
      );

      const merged: PaymentWithBooking[] = paymentsData.map((p: any) => {
        const booking = bookingMap.get(p.booking_id);
        return {
          ...p,
          booking_event_date: booking?.event_date ?? null,
          booking_venue_city: booking?.venue_city ?? null,
          provider_name: booking ? (providerNameMap.get(booking.provider_id) ?? 'Unknown Artist') : 'Unknown Artist',
        };
      });

      setPayments(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, isLoading, error, refetch: fetchPayments };
};
