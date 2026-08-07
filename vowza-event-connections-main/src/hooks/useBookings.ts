import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

export interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  event_type_id: string | null;
  event_date: string;
  event_time: string | null;
  event_duration_hours: number | null;
  venue_address: string;
  venue_city: string;
  venue_area: string | null;
  requirements: string | null;
  amount: number;
  platform_fee: number | null;
  status: BookingStatus;
  customer_notes: string | null;
  provider_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBookings = async () => {
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch generic bookings
      const { data: genericData, error: genericError } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (genericError) throw genericError;

      // Fetch photography bookings
      const { data: photoData } = await supabase
        .from('photography_package_bookings' as any)
        .select('*, photography_packages(name, photography_type)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      // Normalize photography bookings to match Booking interface
      const normalizedPhoto = (photoData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.photographer_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.notes,
        amount: Number(b.total_amount),
        platform_fee: Math.round(Number(b.total_amount) * 0.1),
        status: (b.status === 'confirmed' ? 'accepted' : b.status === 'pending' ? 'requested' : b.status) as BookingStatus,
        customer_notes: b.notes,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'photography',
        _packageName: b.photography_packages?.name || 'Photography Package',
      }));

      // Combine and sort by date
      const combined = [
        ...(genericData || []).map((b: any) => ({ ...b, _source: 'generic' })),
        ...normalizedPhoto,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBookings(combined as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Subscribe to realtime updates for both tables
    const channel = supabase
      .channel('customer-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photography_package_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createBooking = async (bookingData: {
    provider_id: string;
    event_type_id?: string;
    event_date: string;
    event_time?: string;
    event_duration_hours?: number;
    venue_address: string;
    venue_city: string;
    venue_area?: string;
    requirements?: string;
    amount: number;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...bookingData,
        customer_id: user.id,
        platform_fee: Math.round(bookingData.amount * 0.1) // 10% platform fee
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  };

  const cancelBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' as BookingStatus })
      .eq('id', bookingId);

    if (error) throw error;

    await fetchBookings();
  };

  return {
    bookings,
    isLoading,
    error,
    createBooking,
    cancelBooking,
    refetch: fetchBookings
  };
};
