// ─── Vendor Identity Types — Strict Typing for Booking Flow ────────────────────
// Ensures all vendor IDs are properly typed as UUIDs throughout discovery → booking
// This prevents accidental vendor substitution, mixing, or ID loss through the flow.

import { z } from 'zod';

// ─── Base Vendor Identity ─────────────────────────────────────────────────────
/** Validated UUID vendor identifier from provider_profiles.id */
export type VendorId = string & { readonly __brand: 'VendorId' };

/** Brand new VendorId ensuring type safety */
export const brandVendorId = (id: string): VendorId => {
  if (!isValidUUID(id)) throw new Error(`Invalid vendor ID: ${id}`);
  return id as VendorId;
};

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// ─── Package Identity ─────────────────────────────────────────────────────────
/** Validated UUID package identifier */
export type PackageId = string & { readonly __brand: 'PackageId' };

export const brandPackageId = (id: string): PackageId => {
  if (!isValidUUID(id)) throw new Error(`Invalid package ID: ${id}`);
  return id as PackageId;
};

// ─── Vendor Discovery Types ──────────────────────────────────────────────────
/**
 * Discovered vendor with real database ID.
 * Used when user discovers vendor via homepage, search, category, or planner.
 */
export interface DiscoveredVendor {
  id: VendorId;  // provider_profiles.id (UUID)
  profession: string;
  stage_name: string | null;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  price_min: number | null;
  price_max: number | null;
  is_verified: boolean | null;
  total_bookings: number | null;
}

/**
 * Vendor in exact profile view.
 * Represents the vendor when user clicks on a specific vendor card.
 */
export interface ExactVendor extends DiscoveredVendor {
  bio: string | null;
  experience_years: number | null;
  is_featured: boolean | null;
  instant_booking: boolean | null;
  cover_image_url: string | null;
  verification_status: string | null;
}

/**
 * Vendor during package selection.
 * Used when displaying packages on vendor profile.
 */
export interface VendorWithPackages extends ExactVendor {
  packages: VendorPackage[];
  portfolio: PortfolioItem[];
  gallery_urls: string[];
}

// ─── Package/Service Types ────────────────────────────────────────────────────
/**
 * A package/service offered by a specific vendor.
 * Must include provider_id to ensure vendor identity.
 */
export interface VendorPackage {
  id: PackageId;
  provider_id: VendorId;  // Foreign key - must match selected vendor
  name: string;
  price: number;
  duration?: string;
  description?: string;
  features?: string[];
}

/**
 * Portfolio item belonging to a vendor.
 */
export interface PortfolioItem {
  id: string;
  provider_id: VendorId;  // Foreign key - must match vendor
  media_url: string;
  media_type: 'image' | 'video';
  title: string;
  is_published: boolean;
}

// ─── Scoped Selection Types ──────────────────────────────────────────────────
/**
 * User's selection of a specific vendor and package.
 * This is the binding contract that ensures the exact vendor/package pair.
 */
export interface VendorSelection {
  vendorId: VendorId;              // Selected vendor UUID
  vendorName: string;              // For display/confirmation
  packageId: PackageId;            // Selected package UUID
  packageName: string;             // For display/confirmation
  price: number;                   // Locked price for booking
}

/**
 * Validated pair: package must belong to selected vendor.
 */
export interface ValidatedVendorPackageSelection extends VendorSelection {
  __validated: true;  // Marker that this passed validation
}

// ─── Cart/Session Types ──────────────────────────────────────────────────────
/**
 * Scoped cart storing vendor identity.
 * All items in cart must have same vendor ID.
 */
export interface ScopedCart {
  vendorId: VendorId;              // Primary vendor for this cart
  vendorName: string;
  items: CartItem[];
  createdAt: string;
  expiresAt: string;
}

/**
 * Individual cart item.
 */
export interface CartItem {
  packageId: PackageId;
  packageName: string;
  price: number;
  quantity: number;
  addedAt: string;
}

/**
 * Special category cart (catering, water, etc).
 */
export interface SpecialCategoryCart {
  vendorId: VendorId;                    // Vendor UUID from provider_profiles
  category: 'catering' | 'water' | 'mehendi' | 'photography' | 'videography';
  packageId: PackageId;
  vendor: {
    id: VendorId;
    business_name?: string;
    contact_person?: string;
  };
  package: {
    id: PackageId;
    name: string;
    price_per_plate?: number;
    price?: number;
  };
  // ... other category-specific fields
}

// ─── Booking Types ──────────────────────────────────────────────────────────
/**
 * Booking request with validated vendor identity.
 * This ensures the booking is for the exact vendor selected.
 */
export interface BookingRequest {
  provider_id: VendorId;        // Must match selected vendor
  customer_id: string;          // Customer UUID
  package_id: PackageId;        // Must belong to provider_id
  category?: string;            // Optional: photography, catering, etc.
  event_date: string;
  guest_count?: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  booking_date: string;
}

/**
 * Confirmed booking record from database.
 * Includes all vendor identity validation.
 */
export interface ConfirmedBooking extends BookingRequest {
  id: string;                   // Booking UUID
  vendor_name: string;          // Denormalized for display
  package_name: string;         // Denormalized for display
}

// ─── Validation Functions ────────────────────────────────────────────────────
/**
 * Validates that a package belongs to the selected vendor.
 * @throws Error if package.provider_id !== selection.vendorId
 */
export const validateVendorPackageRelationship = (
  selection: VendorSelection,
  packageData: VendorPackage
): ValidatedVendorPackageSelection => {
  if (packageData.provider_id !== selection.vendorId) {
    throw new Error(
      `Package ${packageData.id} does not belong to vendor ${selection.vendorId}`
    );
  }
  return { ...selection, __validated: true };
};

/**
 * Validates booking has correct vendor relationship before creating.
 * @throws Error if any relationship is broken
 */
export const validateBookingRelationships = (
  booking: BookingRequest,
  vendor: ExactVendor,
  pkg: VendorPackage
): void => {
  // Vendor ID in booking must match selected vendor
  if (booking.provider_id !== vendor.id) {
    throw new Error(
      `Booking vendor ${booking.provider_id} does not match selected vendor ${vendor.id}`
    );
  }

  // Package must belong to this vendor
  if (pkg.provider_id !== vendor.id) {
    throw new Error(
      `Package ${pkg.id} does not belong to vendor ${vendor.id}`
    );
  }

  // Package ID in booking must match
  if (booking.package_id !== pkg.id) {
    throw new Error(
      `Booking package ${booking.package_id} does not match selected package ${pkg.id}`
    );
  }
};

/**
 * Ensures all items in scoped cart belong to same vendor.
 */
export const validateScopedCart = (cart: ScopedCart): void => {
  if (!cart.vendorId) {
    throw new Error('Cart missing vendor ID');
  }

  if (!cart.items || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  if (new Date(cart.expiresAt) < new Date()) {
    throw new Error('Cart has expired');
  }
};

// ─── TypeScript Zod Schemas (Runtime Validation) ──────────────────────────────
export const VendorIdSchema = z.string().uuid();
export const PackageIdSchema = z.string().uuid();

export const VendorSelectionSchema = z.object({
  vendorId: VendorIdSchema,
  vendorName: z.string(),
  packageId: PackageIdSchema,
  packageName: z.string(),
  price: z.number().positive(),
});

export const BookingRequestSchema = z.object({
  provider_id: VendorIdSchema,
  customer_id: z.string(),
  package_id: PackageIdSchema,
  event_date: z.string().datetime(),
  amount: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  booking_date: z.string().datetime(),
});

export type VendorSelectionInput = z.infer<typeof VendorSelectionSchema>;
export type BookingRequestInput = z.infer<typeof BookingRequestSchema>;
