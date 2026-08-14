import { supabase } from '@/integrations/supabase/client';

/**
 * BOOKING GUARD - Frontend self-booking prevention
 * 
 * ⚠️ IMPORTANT: This is a UX guard only. Backend RLS policies provide the actual security.
 * 
 * BUSINESS RULE:
 * - Artist A creates Package A → Artist A CANNOT book Package A
 * - Artist A CAN book Artist B's packages
 * - Normal customers can book any package
 * 
 * IMPLEMENTATION:
 * - This frontend check prevents the booking UI from being submitted
 * - Backend RLS policies reject any self-booking attempts that bypass this guard
 * - Even if frontend is manipulated, backend RLS will block the booking
 * 
 * Checks if the current user can book a package owned by a vendor.
 * 
 * @param providerId - The provider/vendor ID who owns the package
 * @returns true if user CAN book, false if user CANNOT book (owner trying to self-book)
 */
export const canBookPackage = async (providerId: string | null): Promise<boolean> => {
  if (!providerId) return true; // If no provider ID, allow (shouldn't happen, but safe default)

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return true; // If not logged in, let them attempt (will fail at RLS layer)

  // Check if user owns this provider profile
  const { data: ownedProvider, error: queryError } = await supabase
    .from('provider_profiles')
    .select('id')
    .eq('id', providerId)
    .eq('user_id', user.id)
    .single();

  // If query fails (e.g., provider doesn't exist), allow the attempt
  if (queryError && queryError.code !== 'PGRST116') return true;

  // If user owns the provider, they cannot book
  return !ownedProvider;
};

/**
 * Check if booking should be blocked with user-friendly message
 */
export const getBookingBlockReason = async (providerId: string | null): Promise<string | null> => {
  const canBook = await canBookPackage(providerId);
  if (!canBook) {
    return 'You cannot book your own package.';
  }
  return null;
};

/**
 * Safe wrapper for booking attempts that handles self-booking gracefully
 */
export const attemptBooking = async (
  bookingData: any,
  bookingTable: string,
  onError?: (message: string) => void
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      onError?.('Please sign in to make a booking.');
      return false;
    }

    // Check self-booking before attempting insert
    const providerId = bookingData.provider_id || bookingData.photographer_id;
    const blockReason = await getBookingBlockReason(providerId);
    if (blockReason) {
      onError?.(blockReason);
      return false;
    }

    return true; // Proceed with booking
  } catch (error) {
    onError?.(error instanceof Error ? error.message : 'Booking attempt failed.');
    return false;
  }
};
