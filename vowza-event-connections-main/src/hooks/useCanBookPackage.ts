import { useState, useEffect } from 'react';
import { canBookPackage } from '@/utils/bookingGuard';

/**
 * Hook to determine if the current user can book a specific package
 * 
 * RULE: Vendors cannot book their own packages
 * 
 * @param providerId - The provider/vendor ID who owns the package
 * @returns { canBook: boolean, loading: boolean }
 */
export const useCanBookPackage = (providerId: string | null) => {
  const [canBook, setCanBook] = useState(true); // Default allow (for non-vendors)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!providerId) {
      setCanBook(true);
      return;
    }

    const check = async () => {
      setLoading(true);
      try {
        const result = await canBookPackage(providerId);
        setCanBook(result);
      } catch (error) {
        console.error('[useCanBookPackage] Error checking booking eligibility:', error);
        setCanBook(true); // Default allow on error
      } finally {
        setLoading(false);
      }
    };

    void check();
  }, [providerId]);

  return { canBook, loading };
};
