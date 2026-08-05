// ─── useReviews — Reviews written by the current customer ─────────────────────
// reviews table has no updated_at column — reviews are NOT editable per schema.
// Two-step query pattern: reviews -> provider_profiles -> profiles.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReviewWithContext {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  // Joined context
  provider_name: string;
  provider_profession: string | null;
  booking_event_date: string | null;
}

export const useReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!user) {
      setReviews([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: reviewsData, error: rErr } = await supabase
        .from('reviews')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;
      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        setIsLoading(false);
        return;
      }

      const bookingIds = [...new Set(reviewsData.map(r => r.booking_id))];
      const providerIds = [...new Set(reviewsData.map(r => r.provider_id))];

      const [{ data: bookingsData }, { data: providersData }] = await Promise.all([
        supabase.from('bookings').select('id, event_date').in('id', bookingIds),
        supabase.from('provider_profiles').select('id, user_id, stage_name, profession').in('id', providerIds),
      ]);

      const bookingMap = new Map((bookingsData ?? []).map(b => [b.id, b]));

      const providerUserIds = (providersData ?? []).map(p => p.user_id).filter(Boolean);
      const { data: profilesData } = providerUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', providerUserIds)
        : { data: [] as { id: string; full_name: string | null }[] };

      const profileNameMap = new Map((profilesData ?? []).map(p => [p.id, p.full_name]));
      const providerMap = new Map(
        (providersData ?? []).map(p => [p.id, {
          name: p.stage_name || profileNameMap.get(p.user_id) || 'Unknown Artist',
          profession: p.profession as string | null,
        }])
      );

      const merged: ReviewWithContext[] = reviewsData.map(r => {
        const provider = providerMap.get(r.provider_id);
        const booking = bookingMap.get(r.booking_id);
        return {
          ...r,
          provider_name: provider?.name ?? 'Unknown Artist',
          provider_profession: provider?.profession ?? null,
          booking_event_date: booking?.event_date ?? null,
        };
      });

      setReviews(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return { reviews, isLoading, error, refetch: fetchReviews };
};
