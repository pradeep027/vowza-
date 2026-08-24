/**
 * useSafeBooking - Safe booking hook with self-booking prevention
 * 
 * Uses the backend create-booking function which enforces:
 * - User cannot book their own package
 * - User can book any other vendor's package
 * - All booking validations happen at backend (cannot be bypassed)
 */

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateBookingParams {
  category: string;
  packageId: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  notes?: string;
  guestCount?: number;
  addonIds?: string[];
  baseAmount?: number;
  addonsAmount?: number;
  totalAmount?: number;
}

export function useSafeBooking() {
  const { user } = useAuth();

  const createBooking = useCallback(
    async (params: CreateBookingParams) => {
      if (!user) {
        toast.error('You must be logged in to create a booking');
        throw new Error('User not authenticated');
      }

      try {
        // Get current session token
        const { data: sessionData } = await (window as any).supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error('Session expired. Please log in again.');
          throw new Error('No session');
        }

        const token = sessionData.session.access_token;

        // Call backend function
        const response = await fetch(
          `${(window as any).supabase._getSupabaseUrl()}/functions/v1/create-booking`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(params),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          if (result.code === 'SELF_BOOKING_PREVENTED') {
            toast.error(result.error || 'You cannot book your own package');
          } else {
            toast.error(result.error || 'Failed to create booking');
          }
          throw new Error(result.error || 'Booking failed');
        }

        toast.success('Booking created successfully!');
        return result.bookingId;

      } catch (error) {
        console.error('Booking error:', error);
        if (error instanceof Error && error.message !== 'User not authenticated' && error.message !== 'No session') {
          toast.error((error as Error).message || 'Failed to create booking');
        }
        throw error;
      }
    },
    [user]
  );

  return { createBooking };
}
