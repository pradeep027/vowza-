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
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBookings(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Subscribe to realtime updates
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
