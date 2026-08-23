/**
 * Booking Validation Utilities
 * 
 * Provides runtime validation for vendor/package relationships before database operations.
 * Ensures exact vendor-to-booking preservation throughout the booking flow.
 */

import { toast } from 'sonner';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a package belongs to the selected vendor
 * 
 * @param vendorId - UUID of vendor (provider_profiles.id)
 * @param packageId - UUID of package (pricing_packages.id)
 * @param packageData - Package object from database
 * @returns ValidationResult with validity and error message
 * 
 * Usage:
 * ```typescript
 * const result = validateVendorPackageRelationship(
 *   vendorId: "550e8400-e29b-41d4-a716-446655440001",
 *   packageId: "660e8400-e29b-41d4-a716-446655440010",
 *   packageData: { id: "660e8400...", provider_id: "550e8400...", ... }
 * );
 * if (!result.valid) {
 *   toast.error(result.error);
 *   return; // Prevent booking
 * }
 * ```
 */
export function validateVendorPackageRelationship(
  vendorId: string,
  packageId: string,
  packageData: any
): ValidationResult {
  // Check vendor ID is provided
  if (!vendorId || typeof vendorId !== 'string') {
    return {
      valid: false,
      error: 'Invalid vendor ID. Please refresh and try again.',
    };
  }

  // Check package ID is provided
  if (!packageId || typeof packageId !== 'string') {
    return {
      valid: false,
      error: 'Invalid package ID. Please refresh and try again.',
    };
  }

  // Check package data exists
  if (!packageData) {
    return {
      valid: false,
      error: 'Package information not found. Please select a package again.',
    };
  }

  // Validate package has provider_id (FK)
  if (!packageData.provider_id) {
    return {
      valid: false,
      error: 'Package vendor information missing. Please select a different package.',
    };
  }

  // Critical: Validate vendor-package relationship
  // This is the most important check - ensures package belongs to vendor
  if (packageData.provider_id !== vendorId) {
    return {
      valid: false,
      error: `Package does not belong to selected vendor. Please book the correct vendor's package.`,
    };
  }

  // All validations passed
  return { valid: true };
}

/**
 * Validates booking data before database insert
 * 
 * @param bookingData - Booking object to insert
 * @returns ValidationResult with validity and error message
 * 
 * Usage:
 * ```typescript
 * const result = validateBookingData({
 *   provider_id: "550e8400-e29b-41d4-a716-446655440001",
 *   package_id: "660e8400-e29b-41d4-a716-446655440010",
 *   customer_id: "user123",
 *   event_date: "2025-06-15",
 *   amount: 150000
 * });
 * if (!result.valid) {
 *   toast.error(result.error);
 *   return;
 * }
 * ```
 */
export function validateBookingData(bookingData: any): ValidationResult {
  // Validate required fields
  if (!bookingData.provider_id) {
    return { valid: false, error: 'Vendor ID missing' };
  }

  if (!bookingData.customer_id) {
    return { valid: false, error: 'User not authenticated' };
  }

  if (!bookingData.event_date) {
    return { valid: false, error: 'Event date required' };
  }

  if (!bookingData.amount || bookingData.amount <= 0) {
    return { valid: false, error: 'Invalid booking amount' };
  }

  // Validate ID formats (basic UUID check)
  if (!isValidUUID(bookingData.provider_id)) {
    return { valid: false, error: 'Invalid vendor ID format' };
  }

  if (bookingData.package_id && !isValidUUID(bookingData.package_id)) {
    return { valid: false, error: 'Invalid package ID format' };
  }

  return { valid: true };
}

/**
 * Validates catering cart data from sessionStorage
 * 
 * @param cartData - Cart data from sessionStorage
 * @returns ValidationResult with validity and error message
 * 
 * Checks:
 * - Cart exists and has required fields
 * - Provider and package IDs match (vendor-package relationship)
 * - Cart not expired (24 hour default)
 * 
 * Usage:
 * ```typescript
 * const cart = JSON.parse(sessionStorage.getItem('vowza_catering_cart') || '{}');
 * const result = validateCateringCartData(cart);
 * if (!result.valid) {
 *   toast.error(result.error);
 *   sessionStorage.removeItem('vowza_catering_cart');
 *   navigate('/');
 * }
 * ```
 */
export function validateCateringCartData(cartData: any): ValidationResult {
  // Check cart exists
  if (!cartData) {
    return { valid: false, error: 'Cart data not found' };
  }

  // Check cart has required provider info
  if (!cartData.provider || !cartData.provider.id) {
    return { valid: false, error: 'Vendor information missing from cart' };
  }

  // Check cart has required package info
  if (!cartData.pkg || !cartData.pkg.id) {
    return { valid: false, error: 'Package information missing from cart' };
  }

  // Critical: Validate vendor-package relationship
  if (cartData.pkg.provider_id !== cartData.provider.id) {
    return {
      valid: false,
      error: 'Cart data is corrupted. Package does not belong to vendor.',
    };
  }

  // Check cart timestamp exists (for expiration check)
  if (!cartData.timestamp) {
    return { valid: false, error: 'Cart timestamp missing' };
  }

  // Check cart not expired (24 hours default)
  const CART_EXPIRATION_HOURS = 24;
  const cartAgeMinutes = (Date.now() - cartData.timestamp) / (1000 * 60);
  if (cartAgeMinutes > CART_EXPIRATION_HOURS * 60) {
    return {
      valid: false,
      error: `Cart expired after ${CART_EXPIRATION_HOURS} hours. Please start a new booking.`,
    };
  }

  return { valid: true };
}

/**
 * Validates special category (catering, water, mehendi, etc.) booking
 * 
 * @param category - Special category type ('catering', 'water', 'mehendi', etc.)
 * @param provider - Provider object with id and other details
 * @param pkg - Package object with id, provider_id, name, price
 * @param bookingDetails - Additional booking details (date, location, etc.)
 * @returns ValidationResult with validity and error message
 * 
 * Usage:
 * ```typescript
 * const result = validateSpecialCategoryBooking(
 *   'catering',
 *   provider,
 *   selectedPackage,
 *   { eventDate: "2025-07-20", guestCount: 300 }
 * );
 * ```
 */
export function validateSpecialCategoryBooking(
  category: string,
  provider: any,
  pkg: any,
  bookingDetails: any
): ValidationResult {
  // Validate provider
  if (!provider || !provider.id) {
    return { valid: false, error: `Vendor information missing for ${category} booking` };
  }

  // Validate package
  if (!pkg || !pkg.id) {
    return { valid: false, error: `${category} package information missing` };
  }

  // Critical: Validate vendor-package relationship
  if (pkg.provider_id !== provider.id) {
    return {
      valid: false,
      error: `Selected ${category} package does not belong to this vendor`,
    };
  }

  // Validate booking date
  if (!bookingDetails?.eventDate) {
    return { valid: false, error: 'Event date required' };
  }

  // Validate date is in future
  const bookingDate = new Date(bookingDetails.eventDate);
  if (bookingDate < new Date()) {
    return { valid: false, error: 'Event date must be in the future' };
  }

  return { valid: true };
}

/**
 * Validates vendor ID existence check before booking
 * 
 * Used during final confirmation to ensure vendor hasn't been deleted/disabled
 * 
 * @param vendor - Vendor object from database
 * @param vendorId - Expected vendor UUID
 * @returns ValidationResult
 */
export function validateVendorExists(vendor: any, vendorId: string): ValidationResult {
  if (!vendor) {
    return {
      valid: false,
      error: 'Vendor not found. The vendor may have been deleted or is no longer available.',
    };
  }

  if (vendor.id !== vendorId) {
    return {
      valid: false,
      error: 'Vendor ID mismatch. Please start a new booking.',
    };
  }

  if (!vendor.is_published || vendor.verification_status !== 'verified') {
    return {
      valid: false,
      error: 'This vendor is no longer available for bookings.',
    };
  }

  return { valid: true };
}

/**
 * Validates availability for selected date/time before booking
 * 
 * @param isAvailable - Boolean from availability check
 * @param reason - Reason why not available (if applicable)
 * @returns ValidationResult
 */
export function validateDateAvailability(isAvailable: boolean, reason?: string): ValidationResult {
  if (!isAvailable) {
    return {
      valid: false,
      error: reason || 'This date is no longer available. Please select a different date.',
    };
  }

  return { valid: true };
}

/**
 * Validates concurrent booking protection (double-booking prevention)
 * 
 * @param checkResult - Result from availability check that includes booking count
 * @returns ValidationResult
 */
export function validateNoDoubleBooking(checkResult: any): ValidationResult {
  if (!checkResult) {
    return { valid: false, error: 'Availability check failed' };
  }

  if (!checkResult.available) {
    return {
      valid: false,
      error: checkResult.reason || 'This date was just booked by another user. Please choose another date.',
    };
  }

  return { valid: true };
}

/**
 * Basic UUID validation
 * Checks if string is valid UUID format (v4)
 * 
 * @param uuid - String to validate
 * @returns boolean - true if valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Comprehensive pre-booking validation
 * Runs all validation checks before inserting into database
 * 
 * @param bookingContext - Complete booking context
 * @returns ValidationResult with all checks
 * 
 * Usage:
 * ```typescript
 * const context = {
 *   vendor: vendorData,
 *   vendorId: "550e8400-e29b-41d4-a716-446655440001",
 *   pkg: packageData,
 *   packageId: "660e8400-e29b-41d4-a716-446655440010",
 *   availabilityCheck: { available: true },
 *   bookingData: { ... }
 * };
 * 
 * const result = validatePreBooking(context);
 * if (!result.valid) {
 *   toast.error(result.error);
 *   return;
 * }
 * // Proceed with booking insert
 * ```
 */
export function validatePreBooking(bookingContext: any): ValidationResult {
  // 1. Validate vendor exists
  const vendorCheck = validateVendorExists(bookingContext.vendor, bookingContext.vendorId);
  if (!vendorCheck.valid) return vendorCheck;

  // 2. Validate package exists
  if (!bookingContext.pkg || !bookingContext.pkg.id) {
    return { valid: false, error: 'Package information missing' };
  }

  // 3. Validate vendor-package relationship
  const relationshipCheck = validateVendorPackageRelationship(
    bookingContext.vendorId,
    bookingContext.packageId,
    bookingContext.pkg
  );
  if (!relationshipCheck.valid) return relationshipCheck;

  // 4. Validate availability
  const availabilityCheck = validateNoDoubleBooking(bookingContext.availabilityCheck);
  if (!availabilityCheck.valid) return availabilityCheck;

  // 5. Validate booking data
  const bookingCheck = validateBookingData(bookingContext.bookingData);
  if (!bookingCheck.valid) return bookingCheck;

  // All checks passed
  return { valid: true };
}

/**
 * Error message formatter for user display
 * Converts validation errors to user-friendly messages
 * 
 * @param validationResult - ValidationResult from any validation function
 * @returns Formatted error message
 */
export function formatValidationError(validationResult: ValidationResult): string {
  if (validationResult.valid) return '';

  return validationResult.error || 'An error occurred during validation. Please try again.';
}

/**
 * Toast notification helper for validation errors
 * Shows validation error as toast notification and logs to console
 * 
 * @param validationResult - ValidationResult to display
 * @param context - Optional context for logging
 */
export function showValidationError(validationResult: ValidationResult, context?: string): void {
  if (validationResult.valid) return;

  const message = formatValidationError(validationResult);
  toast.error(message);

  // Log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Validation Error${context ? ` - ${context}` : ''}]`, validationResult);
  }
}

/**
 * Assert vendor-package relationship or throw error
 * Stricter version for critical operations
 * 
 * @param vendorId - Vendor UUID
 * @param packageData - Package object from database
 * @throws Error if validation fails
 */
export function assertVendorPackageRelationship(vendorId: string, packageData: any): void {
  const result = validateVendorPackageRelationship(vendorId, '', packageData);
  if (!result.valid) {
    throw new Error(result.error || 'Vendor-package relationship validation failed');
  }

  if (packageData.provider_id !== vendorId) {
    throw new Error('Package does not belong to vendor');
  }
}

/**
 * Extract and validate vendor/package IDs from route params
 * 
 * @param routeParams - Route parameters object
 * @returns { vendorId: string, packageId?: string } or null if invalid
 */
export function extractAndValidateIDs(routeParams: any): { vendorId: string; packageId?: string } | null {
  const vendorId = routeParams?.vendorId || routeParams?.id;
  if (!vendorId || !isValidUUID(vendorId)) {
    return null;
  }

  const packageId = routeParams?.packageId;
  if (packageId && !isValidUUID(packageId)) {
    return null;
  }

  return { vendorId, packageId };
}

/**
 * Validation hook for React components
 * Returns true if vendor/package relationship is valid
 * 
 * @param vendorId - Vendor UUID
 * @param packageData - Package object
 * @returns boolean - true if valid relationship
 * 
 * Usage in React:
 * ```typescript
 * const isValid = useValidateVendorPackage(vendorId, pkg);
 * if (!isValid) {
 *   return <ErrorScreen message="Invalid vendor/package selection" />;
 * }
 * ```
 */
export function useValidateVendorPackage(vendorId: string, packageData: any): boolean {
  if (!vendorId || !packageData) return false;
  if (!packageData.provider_id) return false;
  return packageData.provider_id === vendorId;
}
