# FIX 5: Booking Validation Integration Guide

**Status**: ✅ VALIDATION UTILITIES CREATED & DOCUMENTED

This document describes the booking validation utilities and integration points for vendor/package relationship validation.

---

## Overview

Created `src/lib/bookingValidation.ts` with comprehensive validation functions for:
- Vendor-package relationship validation
- Booking data validation
- Cart data validation
- Special category booking validation
- Pre-booking comprehensive checks

---

## Validation Functions Reference

### 1. `validateVendorPackageRelationship()`

**Purpose**: Validates that selected package belongs to selected vendor

**Usage**:
```typescript
import { validateVendorPackageRelationship, showValidationError } from '@/lib/bookingValidation';

// In BookingModal.tsx or special category modal
const result = validateVendorPackageRelationship(
  provider.id,           // Vendor UUID
  selectedPackage.id,    // Package UUID
  selectedPackage        // Package data object
);

if (!result.valid) {
  showValidationError(result, 'Package Selection');
  return; // Prevent booking
}
```

**Validates**:
- ✅ Vendor ID exists and is valid
- ✅ Package ID exists and is valid
- ✅ Package data contains provider_id (FK)
- ✅ **Critical**: package.provider_id === vendor.id

**Error Messages**:
- "Invalid vendor ID. Please refresh and try again."
- "Invalid package ID. Please refresh and try again."
- "Package information not found. Please select a package again."
- "Package vendor information missing. Please select a different package."
- "Package does not belong to selected vendor. Please book the correct vendor's package."

---

### 2. `validateBookingData()`

**Purpose**: Validates booking object before database insert

**Usage**:
```typescript
import { validateBookingData, showValidationError } from '@/lib/bookingValidation';

const bookingPayload = {
  provider_id: provider.id,
  customer_id: user.id,
  package_id: selectedPackage.id,
  event_date: eventDate,
  event_time: eventTime,
  amount: bookingAmount
};

const result = validateBookingData(bookingPayload);
if (!result.valid) {
  showValidationError(result, 'Booking Data');
  return;
}

// Proceed with database insert
await supabase.from('bookings').insert(bookingPayload);
```

**Validates**:
- ✅ provider_id exists
- ✅ customer_id exists
- ✅ event_date exists
- ✅ amount > 0
- ✅ All IDs are valid UUID format

---

### 3. `validateCateringCartData()`

**Purpose**: Validates catering cart from sessionStorage before checkout

**Usage**:
```typescript
import { validateCateringCartData, showValidationError } from '@/lib/bookingValidation';

// In CateringCartPage.tsx
const cart = JSON.parse(sessionStorage.getItem('vowza_catering_cart') || '{}');

const result = validateCateringCartData(cart);
if (!result.valid) {
  showValidationError(result, 'Catering Cart');
  sessionStorage.removeItem('vowza_catering_cart');
  navigate('/');
  return;
}

// Cart is valid, proceed with checkout
const { provider, pkg } = cart;
```

**Validates**:
- ✅ Cart data exists
- ✅ Provider info present with valid ID
- ✅ Package info present with valid ID
- ✅ **Critical**: pkg.provider_id === provider.id
- ✅ Cart timestamp exists
- ✅ Cart not expired (24 hours)

**Error Messages**:
- "Cart data not found"
- "Vendor information missing from cart"
- "Package information missing from cart"
- "Cart data is corrupted. Package does not belong to vendor."
- "Cart expired after 24 hours. Please start a new booking."

---

### 4. `validateSpecialCategoryBooking()`

**Purpose**: Validates special category (catering, water, mehendi, etc.) booking

**Usage**:
```typescript
import { validateSpecialCategoryBooking, showValidationError } from '@/lib/bookingValidation';

// In any special category booking modal (CateringBookingModal, WaterBookingModal, etc.)
const result = validateSpecialCategoryBooking(
  'catering',                    // Category type
  provider,                      // Provider object
  selectedPackage,               // Package object
  {                              // Booking details
    eventDate: eventDate,
    guestCount: guestCount,
    venue: venueName
  }
);

if (!result.valid) {
  showValidationError(result, 'Catering Booking');
  return;
}
```

**Validates**:
- ✅ Provider exists and has ID
- ✅ Package exists and has ID
- ✅ **Critical**: pkg.provider_id === provider.id
- ✅ Event date provided
- ✅ Event date is in future

---

### 5. `validatePreBooking()`

**Purpose**: Comprehensive validation before any booking insert (recommended final check)

**Usage**:
```typescript
import { validatePreBooking, showValidationError } from '@/lib/bookingValidation';

// In BookingModal.tsx handleSubmit()
const bookingContext = {
  vendor: providerData,
  vendorId: provider.id,
  pkg: selectedPackage,
  packageId: selectedPackage.id,
  availabilityCheck: { available: true },
  bookingData: {
    provider_id: provider.id,
    customer_id: user.id,
    event_date: eventDate,
    amount: bookingAmount
  }
};

const result = validatePreBooking(bookingContext);
if (!result.valid) {
  showValidationError(result, 'Pre-Booking Check');
  return;
}

// All validations passed, proceed with booking insert
const { data: booking } = await supabase
  .from('bookings')
  .insert(bookingContext.bookingData)
  .select()
  .single();
```

**Runs** (in order):
1. Vendor exists check
2. Package exists check
3. Vendor-package relationship check
4. Availability check
5. Booking data validation

---

### 6. `isValidUUID()`

**Purpose**: Basic UUID format validation

**Usage**:
```typescript
import { isValidUUID } from '@/lib/bookingValidation';

if (!isValidUUID(providerId)) {
  console.error('Invalid provider ID format');
  return;
}

if (!isValidUUID(packageId)) {
  console.error('Invalid package ID format');
  return;
}
```

---

### 7. `useValidateVendorPackage()` - React Hook

**Purpose**: React hook for component-level vendor-package validation

**Usage**:
```typescript
import { useValidateVendorPackage } from '@/lib/bookingValidation';

function MyBookingComponent({ vendorId, selectedPackage }) {
  const isValid = useValidateVendorPackage(vendorId, selectedPackage);

  if (!isValid) {
    return <ErrorMessage message="Invalid vendor/package selection" />;
  }

  return <BookingForm />;
}
```

---

## Integration Points

### Integration 1: BookingModal.tsx (Standard Booking)

**Location**: `src/components/BookingModal.tsx` - `handleSubmit()` method

**Current Code** (Line ~254):
```typescript
const { data: bookingData, error } = await supabase
  .from('bookings')
  .insert({
    customer_id: user.id,
    provider_id: provider.id,
    // ... other fields
  })
```

**Add Validation Before Insert**:
```typescript
import { validatePreBooking, showValidationError } from '@/lib/bookingValidation';

// Inside handleSubmit(), before INSERT
const validationContext = {
  vendor: provider,
  vendorId: provider.id,
  pkg: selectedPackage,
  packageId: selectedPackage?.id,
  availabilityCheck: { available: true }, // Set after availability check
  bookingData: {
    customer_id: user.id,
    provider_id: provider.id,
    event_type_id: eventTypeId || null,
    event_date: eventDate,
    event_time: eventTime || null,
    event_duration_hours: parseInt(duration),
    venue_address: venueAddress,
    amount: bookingAmount,
    status: 'requested'
  }
};

const validationResult = validatePreBooking(validationContext);
if (!validationResult.valid) {
  showValidationError(validationResult, 'Booking Submission');
  setIsLoading(false);
  return;
}

// Validation passed, proceed with insert
const { data: bookingData, error } = await supabase
  .from('bookings')
  .insert(validationContext.bookingData)
```

**Impact**: ✅ Prevents invalid bookings with wrong vendor/package mix

---

### Integration 2: CateringBookingModal.tsx (Special Category)

**Location**: `src/components/CateringBookingModal.tsx` - handleSubmit()

**Current Code** (Line ~198):
```typescript
sessionStorage.setItem('vowza_catering_cart', JSON.stringify({
  pkg,
  provider,
  // ... other data
}));
```

**Add Validation Before Store**:
```typescript
import { validateSpecialCategoryBooking, showValidationError } from '@/lib/bookingValidation';

// Inside handleSubmit()
const validationResult = validateSpecialCategoryBooking(
  'catering',
  provider,
  pkg,
  {
    eventDate: eventDate,
    guestCount: parseInt(guestCount)
  }
);

if (!validationResult.valid) {
  showValidationError(validationResult, 'Catering Booking');
  return;
}

// Validation passed, store in sessionStorage
sessionStorage.setItem('vowza_catering_cart', JSON.stringify({
  provider: { id: provider.id, full_name: provider.full_name, ... },
  pkg: { id: pkg.id, provider_id: pkg.provider_id, name: pkg.name, ... },
  eventDate: eventDate,
  guestCount: guestCount,
  timestamp: Date.now(),
  cart_expires: Date.now() + (24 * 60 * 60 * 1000)
}));
```

**Impact**: ✅ Prevents catering carts with mismatched vendor/package

---

### Integration 3: CateringCartPage.tsx (Cart Checkout)

**Location**: `src/pages/CateringCartPage.tsx` - Component load & checkout

**Current Code** (Line ~47):
```typescript
const cart = JSON.parse(sessionStorage.getItem('vowza_catering_cart') || '{}');
const { pkg, provider } = cart;
```

**Add Validation After Retrieve**:
```typescript
import { validateCateringCartData, showValidationError } from '@/lib/bookingValidation';

useEffect(() => {
  const cartJson = sessionStorage.getItem('vowza_catering_cart');
  if (!cartJson) {
    navigate('/');
    return;
  }

  const cart = JSON.parse(cartJson);
  
  // Validate cart before using
  const validationResult = validateCateringCartData(cart);
  if (!validationResult.valid) {
    showValidationError(validationResult, 'Cart Retrieval');
    sessionStorage.removeItem('vowza_catering_cart');
    navigate('/');
    return;
  }

  // Cart is valid, load data
  setCart(cart);
}, []);
```

**Also in handleCheckout()**:
```typescript
import { validateBookingData, showValidationError } from '@/lib/bookingValidation';

const handleCheckout = async () => {
  // Re-validate before final insert (cart may have changed)
  const cartValidation = validateCateringCartData(cart);
  if (!cartValidation.valid) {
    showValidationError(cartValidation);
    return;
  }

  // Validate booking data
  const bookingPayload = {
    customer_id: user.id,
    provider_id: cart.provider.id,
    package_id: cart.pkg.id,
    event_date: cart.eventDate,
    guest_count: cart.guestCount,
    amount: totalAmount
  };

  const bookingValidation = validateBookingData(bookingPayload);
  if (!bookingValidation.valid) {
    showValidationError(bookingValidation);
    return;
  }

  // All validations passed, insert booking
  const { data, error } = await supabase
    .from('catering_bookings')
    .insert(bookingPayload);
};
```

**Impact**: ✅ Prevents expired or corrupted carts from being booked

---

### Integration 4: WaterBookingModal, MehendiBookingModal, etc.

**Pattern**: Same as CateringBookingModal

**All special category modals should use**:
```typescript
import { validateSpecialCategoryBooking } from '@/lib/bookingValidation';

// Before sessionStorage.setItem()
const validationResult = validateSpecialCategoryBooking(
  'water',  // or 'mehendi', 'drone', etc.
  provider,
  pkg,
  { eventDate, guestCount, venue }
);

if (!validationResult.valid) {
  showValidationError(validationResult);
  return;
}

// Then store in sessionStorage
```

---

## Usage Examples

### Example 1: Simple Package Selection Validation

```typescript
import { validateVendorPackageRelationship } from '@/lib/bookingValidation';

function handlePackageSelect(package: any) {
  const result = validateVendorPackageRelationship(
    vendorId,
    package.id,
    package
  );

  if (!result.valid) {
    toast.error(result.error);
    return false;
  }

  setSelectedPackage(package);
  return true;
}
```

### Example 2: Cart Integrity Check

```typescript
import { validateCateringCartData, formatValidationError } from '@/lib/bookingValidation';

function validateAndLoadCart() {
  const cartJson = sessionStorage.getItem('vowza_catering_cart');
  const cart = JSON.parse(cartJson);

  const result = validateCateringCartData(cart);
  
  if (!result.valid) {
    // Show user-friendly error
    const errorMsg = formatValidationError(result);
    alert(errorMsg);
    
    // Clear corrupted cart
    sessionStorage.removeItem('vowza_catering_cart');
    return null;
  }

  return cart;
}
```

### Example 3: Pre-Booking Comprehensive Check

```typescript
import { validatePreBooking, showValidationError } from '@/lib/bookingValidation';

async function submitBooking() {
  // Build complete booking context
  const context = {
    vendor: await loadVendor(vendorId),
    vendorId,
    pkg: selectedPackage,
    packageId: selectedPackage.id,
    availabilityCheck: await checkAvailability(vendorId, eventDate),
    bookingData: {
      provider_id: vendorId,
      customer_id: userId,
      event_date: eventDate,
      amount: bookingAmount
    }
  };

  // Run comprehensive validation
  const result = validatePreBooking(context);
  if (!result.valid) {
    showValidationError(result, 'Final Booking Check');
    return;
  }

  // All checks passed, insert
  await supabase.from('bookings').insert(context.bookingData);
}
```

---

## Error Handling Pattern

**Recommended pattern for all booking operations**:

```typescript
import {
  validateVendorPackageRelationship,
  showValidationError,
  formatValidationError
} from '@/lib/bookingValidation';

async function bookVendor() {
  try {
    // 1. Validate relationship
    const relationshipCheck = validateVendorPackageRelationship(
      provider.id,
      selectedPackage.id,
      selectedPackage
    );
    if (!relationshipCheck.valid) {
      showValidationError(relationshipCheck);
      return;
    }

    // 2. Check availability
    const availCheck = await checkDateAvailable(provider.id, eventDate);
    if (!availCheck.available) {
      showValidationError({ valid: false, error: availCheck.reason });
      return;
    }

    // 3. Insert booking
    const { error } = await supabase
      .from('bookings')
      .insert({ provider_id: provider.id, ... });

    if (error) throw error;

    toast.success('Booking created successfully!');
  } catch (error) {
    console.error('[Booking Error]', error);
    toast.error('Failed to create booking. Please try again.');
  }
}
```

---

## Testing Validation

### Unit Test Template

```typescript
import { validateVendorPackageRelationship } from '@/lib/bookingValidation';

describe('validateVendorPackageRelationship', () => {
  test('passes when package belongs to vendor', () => {
    const vendorId = '550e8400-e29b-41d4-a716-446655440001';
    const pkg = {
      id: '660e8400-e29b-41d4-a716-446655440010',
      provider_id: vendorId
    };

    const result = validateVendorPackageRelationship(vendorId, pkg.id, pkg);
    expect(result.valid).toBe(true);
  });

  test('fails when package belongs to different vendor', () => {
    const vendorId = '550e8400-e29b-41d4-a716-446655440001';
    const differentVendorId = '550e8400-e29b-41d4-a716-446655440099';
    const pkg = {
      id: '660e8400-e29b-41d4-a716-446655440010',
      provider_id: differentVendorId
    };

    const result = validateVendorPackageRelationship(vendorId, pkg.id, pkg);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not belong');
  });
});
```

---

## Performance Considerations

All validation functions are **synchronous** and **fast**:
- No database queries
- No network calls
- Simple object/string comparisons
- UUID regex validation only (~1ms)

**Safe to run on every user action without performance impact.**

---

## Security Guarantees

✅ **Vendor-Package Validation** prevents:
- Cross-vendor package booking (user books Package A from Vendor B)
- Package mismatches (booking recorded with wrong vendor/package pairing)
- Corrupted cart data (sessionStorage tampering)
- Expired carts (user leaves browser open 24+ hours)

✅ **Database FK Constraints** provide final defense:
- Even if validation bypassed, database rejects invalid relationships
- Three-layer protection: TypeScript + Validation + Database

✅ **UUID Validation** prevents:
- Invalid ID formats in database queries
- Route parameter injection attacks
- Malformed cart data

---

## Monitoring & Debugging

**Enable debug logs** in development:

```typescript
// In bookingValidation.ts, functions already include:
if (process.env.NODE_ENV === 'development') {
  console.error(`[Validation Error${context ? ` - ${context}` : ''}]`, validationResult);
}

// Shows validation errors in browser console for debugging
```

**Track validation failures** for analytics:

```typescript
import { showValidationError } from '@/lib/bookingValidation';

function trackValidationError(result: ValidationResult, context: string) {
  if (!result.valid) {
    // Send to analytics/monitoring
    analytics.track('booking_validation_failed', {
      error: result.error,
      context,
      timestamp: new Date()
    });
  }
}
```

---

## Conclusion

✅ **Booking validation utilities created and documented**

- Comprehensive vendor-package relationship checks
- Catering cart integrity validation
- Pre-booking comprehensive validation
- User-friendly error messages
- Ready for integration into all booking flows

**Next Steps**:
1. Integrate into BookingModal.tsx (handleSubmit)
2. Integrate into CateringBookingModal.tsx (handleSubmit)
3. Integrate into CateringCartPage.tsx (checkout)
4. Apply pattern to all special category modals
5. Add unit tests for validation functions

**Status**: Documentation complete - Ready for FIX 6 (testing)
