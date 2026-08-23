# FIX 6: Complete Vendor Flow Testing Guide

**Status**: ✅ TESTING GUIDE CREATED

This document provides comprehensive testing procedures for validating exact vendor/package preservation across all discovery entry points and booking flows.

---

## Testing Overview

**Goal**: Verify that vendors and packages selected by users are exactly what gets booked (no substitution, switching, or loss).

**Three-Layer Validation**:
1. ✅ **TypeScript** (compile-time): VendorId branded type
2. ✅ **Runtime** (user action): bookingValidation.ts checks
3. ✅ **Database** (final): FK constraints enforce relationships

**Test Scope**: All 5 discovery entry points + booking flows

---

## Test Environment Setup

### Prerequisites
- Development environment running (`npm run dev`)
- Test database with sample vendors/packages
- Browser DevTools (Network tab + Console)
- Sample test data:
  - At least 3 vendors in different categories
  - 2-3 packages per vendor
  - Test user account

### Sample Test Vendors

```sql
-- Test Vendor 1: Photography
INSERT INTO provider_profiles (
  id, full_name, stage_name, profession, city, price_min, price_max, 
  is_published, verification_status
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'John Photography Studio',
  'John',
  'photography',
  'Mumbai',
  50000,
  200000,
  true,
  'verified'
);

-- Test Vendor 2: Catering
INSERT INTO provider_profiles (
  id, full_name, stage_name, profession, city, price_min, price_max,
  is_published, verification_status, is_catering_supplier
) VALUES (
  '550e8400-e29b-41d4-a716-446655440005',
  'Rajesh Premium Catering',
  'Rajesh',
  'catering',
  'Mumbai',
  300,
  1000,
  true,
  'verified',
  true
);

-- Test Vendor 3: Decoration
INSERT INTO provider_profiles (
  id, full_name, stage_name, profession, city, price_min, price_max,
  is_published, verification_status
) VALUES (
  '550e8400-e29b-41d4-a716-446655440099',
  'Elite Decorators',
  'Decorators',
  'decoration',
  'Mumbai',
  75000,
  300000,
  true,
  'verified'
);
```

### Sample Packages

```sql
-- Photography Packages
INSERT INTO pricing_packages (
  id, provider_id, name, description, price, duration, is_published
) VALUES (
  '660e8400-e29b-41d4-a716-446655440010',
  '550e8400-e29b-41d4-a716-446655440001',
  'Wedding Photography - Full Day',
  '8 hours coverage with 2 photographers',
  150000,
  '8 hours',
  true
);

-- Catering Packages
INSERT INTO catering_packages (
  id, provider_id, name, description, price_per_plate, is_published
) VALUES (
  '880e8400-e29b-41d4-a716-446655440030',
  '550e8400-e29b-41d4-a716-446655440005',
  'Premium Vegetarian Menu',
  'Gourmet vegetarian options',
  500,
  true
);
```

---

## Test Case 1: Homepage Discovery → Standard Booking

**Entry Point**: TrendingCategories → CategoryPage → VendorCard → ProviderProfile → BookingModal

### Test Steps

1. **Start at Homepage**
   - Navigate to `/`
   - Verify TrendingCategories component loads

2. **Select Category**
   - Click "Photography" category card
   - Verify navigation to `/category/photography`
   - ✅ **Check**: URL contains correct category slug

3. **Find Vendor**
   - Wait for CategoryPage to load vendor list
   - Filter/search for "John Photography Studio"
   - ✅ **Check**: Vendor card displays with correct name, price, rating

4. **Click Vendor Card**
   - Click on John's vendor card
   - Verify navigation to `/artist/550e8400-e29b-41d4-a716-446655440001`
   - ✅ **Check**: Route param is exactly UUID from database (not name or other ID)

5. **View Profile**
   - Wait for ProviderProfile to load
   - Verify John's profile displays correctly
   - Verify packages list shows only John's packages
   - ✅ **Check**: All data belongs to vendor UUID from route

6. **Select Package**
   - Click "Book Now" on "Wedding Photography - Full Day" package
   - BookingModal opens
   - ✅ **Check**: Modal shows John's name and package price (₹150,000)

7. **Fill Booking Form**
   - Select date: June 15, 2025
   - Select time: 09:00
   - Fill venue: "The Grand Ballroom"
   - Set guests: 500
   - Set amount: 150,000 (auto-filled from package)

8. **Submit Booking**
   - Click "Confirm Booking"
   - ✅ **Check**: Success message appears

9. **Verify Database**
   - Check `bookings` table for latest record:
   ```sql
   SELECT * FROM bookings 
   WHERE customer_id = {user_id}
   ORDER BY created_at DESC LIMIT 1;
   ```
   - ✅ **Verify**:
     - `provider_id` = `550e8400-e29b-41d4-a716-446655440001` (John)
     - `package_id` = `660e8400-e29b-41d4-a716-446655440010` (Wedding Photography)
     - `event_date` = `2025-06-15`
     - `amount` = `150000`

### Browser DevTools Verification

**Console Checks**:
```javascript
// In browser console
// After clicking vendor card, before ProviderProfile loads
// Should show vendor UUID (not name)
window.location.pathname  // '/artist/550e8400-e29b-41d4-a716-446655440001'

// After booking created, check sessionStorage
JSON.parse(sessionStorage.getItem('vowza_booking_success'))
// Should contain: { bookingId, artistName: "John Photography Studio", eventDate, ... }
```

**Network Tab Checks**:
- Monitor POST request to `/rest/v1/bookings`
- ✅ **Verify** request payload:
  - `provider_id`: UUID format
  - `customer_id`: Valid user UUID
  - `event_date`: Future date
  - `amount`: Positive integer

---

## Test Case 2: Browse by Event → Vendor Discovery

**Entry Point**: BrowseByEvent → Artists → VendorCard → ProviderProfile → BookingModal

### Test Steps

1. **Homepage → Browse by Event**
   - Click "Browse by Event" or navigate to relevant section
   - Verify event cards display (Wedding, Engagement, Corporate, etc.)

2. **Select Event Type**
   - Click "Wedding" event
   - Verify navigation to `/artists?event=wedding` or similar
   - ✅ **Check**: Query param contains event type

3. **View Filtered Results**
   - Wait for Artists.tsx to load and filter by event
   - Verify artists list filtered to wedding-related vendors
   - ✅ **Check**: Multiple vendors displayed with correct data

4. **Select Specific Vendor**
   - Click on John Photography card (should appear in wedding results)
   - Verify navigation to `/artist/550e8400-e29b-41d4-a716-446655440001`
   - ✅ **Check**: UUID in route matches vendor from list

5. **Complete Booking** (same as Test Case 1, steps 5-9)

### Expected Result

✅ Booking created with correct vendor and event type preference

---

## Test Case 3: Catering Special Category → Cart → Booking

**Entry Point**: ProviderProfile → CateringMenu → CateringBookingModal → sessionStorage → CateringCartPage

### Test Steps

1. **Navigate to Catering Vendor Profile**
   - Navigate directly to `/artist/550e8400-e29b-41d4-a716-446655440005`
   - Wait for ProviderProfile to load
   - ✅ **Check**: Profile displays "Rajesh Premium Catering"

2. **Verify Catering Tab**
   - Profile should detect vendor is catering supplier
   - CateringMenu tab/section should be visible
   - Click on catering section
   - ✅ **Check**: Only Rajesh's catering packages display

3. **Select Catering Package**
   - Click "Book Now" on "Premium Vegetarian Menu"
   - CateringBookingModal opens
   - ✅ **Check**: Modal shows Rajesh's name and package details

4. **Fill Catering Booking Details**
   - Select event date: July 20, 2025
   - Enter guest count: 300
   - Enter venue: "Wedding Garden Palace"
   - Add-ons: Select "Beverages" and "Desserts"
   - Special requirements: "No onions"

5. **Add to Cart (Not Checkout)**
   - Click "Add to Cart" button (stores in sessionStorage)
   - Verify modal closes
   - ✅ **Check**: Success message or cart confirmation

6. **Verify sessionStorage**
   - Open browser DevTools → Application → sessionStorage
   - Check `vowza_catering_cart` entry:
   ```javascript
   JSON.parse(sessionStorage.getItem('vowza_catering_cart'))
   // Should show:
   // {
   //   provider: { id: "550e8400-e29b-41d4-a716-446655440005", ... },
   //   pkg: { 
   //     id: "880e8400-e29b-41d4-a716-446655440030",
   //     provider_id: "550e8400-e29b-41d4-a716-446655440005",
   //     ...
   //   },
   //   eventDate: "2025-07-20",
   //   guestCount: 300,
   //   timestamp: <number>,
   //   cart_expires: <number>
   // }
   ```
   - ✅ **Verify**: `provider.id` === `pkg.provider_id` (vendor-package relationship)

7. **Navigate Away and Back**
   - Navigate to home: `/`
   - Then navigate to checkout: `/checkout` (or wherever cart page is)
   - CateringCartPage should load and retrieve cart from sessionStorage
   - ✅ **Check**: Cart displays with correct vendor and package

8. **Confirm Checkout**
   - Click "Confirm Booking"
   - Verify success message

9. **Verify Database**
   - Check `catering_bookings` table:
   ```sql
   SELECT * FROM catering_bookings 
   WHERE customer_id = {user_id}
   ORDER BY created_at DESC LIMIT 1;
   ```
   - ✅ **Verify**:
     - `provider_id` = `550e8400-e29b-41d4-a716-446655440005` (Rajesh)
     - `package_id` = `880e8400-e29b-41d4-a716-446655440030` (Premium Veg)
     - `event_date` = `2025-07-20`
     - `guest_count` = `300`

### Edge Case: Cart Expiration

1. **Manually set cart timestamp to old value**:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('vowza_catering_cart'));
   cart.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
   sessionStorage.setItem('vowza_catering_cart', JSON.stringify(cart));
   ```

2. **Reload CateringCartPage**
   - Page should detect expired cart
   - ✅ **Check**: Error message "Cart expired after 24 hours"
   - ✅ **Check**: Redirected to home or cleared cart

---

## Test Case 4: Vowza Planner → AI Recommendations → Real Vendors

**Entry Point**: AIPlanner → DBVendorResultsCard → ProviderProfile → Booking

### Test Steps

1. **Open Vowza Planner**
   - Navigate to `/planner` (or Vowza Planner page)
   - Fill in event details:
     - Event type: Wedding
     - Date: June 2025
     - Budget: ₹500,000
     - City: Mumbai
     - Guests: 500

2. **Submit Request**
   - Click "Get Recommendations"
   - Wait for AI to generate results
   - ✅ **Check**: Two types of cards appear:
     - VendorCard (AI recommendations/guidance) with "Find on Vowza" links
     - DBVendorResultsCard (real vendors from database)

3. **Verify AI Recommendations Lead to Filters**
   - Click "Find on Vowza" on an AI recommendation card
   - ✅ **Check**: Navigates to `/artists?category=photography&city=Mumbai`
   - ✅ **Check**: Results show real vendors matching filter

4. **Verify Real Vendor Results Have UUIDs**
   - In DBVendorResultsCard section, find John Photography
   - Right-click on "View Profile" link
   - ✅ **Check**: Link target is `/artist/550e8400-e29b-41d4-a716-446655440001`
   - ✅ **Check**: UUID (not name) in URL

5. **Click Profile from AI Results**
   - Click "View Profile" on John's card
   - Verify navigation to `/artist/550e8400-e29b-41d4-a716-446655440001`
   - Complete booking (same as Test Case 1, steps 5-9)
   - ✅ **Check**: Booking created with correct vendor from AI results

---

## Test Case 5: Cross-Vendor Package Prevention

**Goal**: Verify system prevents booking Package A from Vendor B

### Test Steps

1. **Create Two Vendors with Different Packages**
   - Vendor A (Photography): Package A
   - Vendor B (Photography): Package B

2. **Simulate Vendor Switching Attack**
   - Open browser console
   - Navigate to Vendor A's profile
   - Select Package A in BookingModal
   - In console, attempt to manually modify DOM or state to switch to Package B:
   ```javascript
   // Simulated attack - manually changing package
   // This should fail at validation layer
   ```

3. **Attempt Database Insert with Mismatched IDs**
   - Use API testing tool (Postman/Insomnia)
   - Try to insert booking with:
     - `provider_id`: Vendor A UUID
     - `package_id`: Package B UUID (which belongs to Vendor B)
   - ✅ **Verify**: Database INSERT fails with FK constraint error

4. **Validate Runtime Check**
   - If runtime validation implemented in BookingModal:
   ```typescript
   const result = validateVendorPackageRelationship(
     vendorA_id,
     packageB_id,
     packageB_data
   );
   // Should return: { valid: false, error: "Package does not belong..." }
   ```

---

## Test Case 6: Concurrent Booking Prevention

**Goal**: Verify two users cannot book same vendor's same date simultaneously

### Test Steps

1. **Open Two Browser Windows**
   - Window A: User A
   - Window B: User B
   - Both logged in as different users

2. **Both Start Booking Same Vendor, Same Date**
   - Navigate to John Photography profile in both windows
   - Both select "Wedding Photography - Full Day" package
   - Both select date: June 15, 2025
   - Both select time: 09:00

3. **User A Completes Booking First**
   - User A clicks "Confirm Booking"
   - ✅ **Check**: Booking created successfully
   - Verify in database:
   ```sql
   SELECT * FROM bookings WHERE provider_id = '550e8400-e29b-41d4-a716-446655440001' 
   AND event_date = '2025-06-15' AND event_time = '09:00';
   -- Should show 1 booking
   ```

4. **User B Attempts to Book Same Slot**
   - User B clicks "Confirm Booking"
   - ✅ **Check**: Error message appears
   - Error message: "This slot was just booked. Please choose another date."
   - ✅ **Verify**: No second booking created in database

---

## Test Case 7: Invalid Vendor ID Handling

**Goal**: Verify system gracefully handles invalid vendor UUIDs

### Test Steps

1. **Navigate with Invalid UUID**
   - Try: `/artist/invalid-uuid`
   - ✅ **Check**: 404 or "Vendor not found" message

2. **Navigate with Valid UUID Format but Non-Existent**
   - Try: `/artist/550e8400-e29b-41d4-a716-446655440999` (non-existent)
   - ✅ **Check**: 404 or "Vendor not found" message

3. **SQL Injection Attempt**
   - Try: `/artist/550e8400-e29b-41d4-a716-446655440001'; DROP TABLE--`
   - ✅ **Check**: Treated as single query param, not executed
   - ✅ **Check**: "Vendor not found" message (query returns no results)

---

## Automated Testing (Optional)

### Unit Tests for Validation Functions

```typescript
// src/__tests__/bookingValidation.test.ts
import { validateVendorPackageRelationship, validateCateringCartData } from '@/lib/bookingValidation';

describe('Booking Validation', () => {
  describe('validateVendorPackageRelationship', () => {
    test('passes when vendor-package match', () => {
      const vendorId = '550e8400-e29b-41d4-a716-446655440001';
      const pkg = {
        id: '660e8400-e29b-41d4-a716-446655440010',
        provider_id: vendorId
      };

      const result = validateVendorPackageRelationship(vendorId, pkg.id, pkg);
      expect(result.valid).toBe(true);
    });

    test('fails when vendor-package mismatch', () => {
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

  describe('validateCateringCartData', () => {
    test('passes valid cart', () => {
      const cart = {
        provider: { id: '550e8400-e29b-41d4-a716-446655440005' },
        pkg: {
          id: '880e8400-e29b-41d4-a716-446655440030',
          provider_id: '550e8400-e29b-41d4-a716-446655440005'
        },
        timestamp: Date.now(),
        eventDate: '2025-07-20'
      };

      const result = validateCateringCartData(cart);
      expect(result.valid).toBe(true);
    });

    test('fails expired cart', () => {
      const cart = {
        provider: { id: '550e8400-e29b-41d4-a716-446655440005' },
        pkg: { id: '880e8400-e29b-41d4-a716-446655440030' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        eventDate: '2025-07-20'
      };

      const result = validateCateringCartData(cart);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });
  });
});
```

### E2E Tests with Playwright

```typescript
// e2e/vendor-booking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Vendor Booking Flow', () => {
  test('should book exact vendor selected', async ({ page, browser }) => {
    // Navigate to homepage
    await page.goto('/');

    // Select photography category
    await page.click('text=Photography');
    await page.waitForURL('/category/photography');

    // Find John Photography
    await page.fill('input[placeholder*="search"]', 'John');
    await page.click('text=John Photography Studio');

    // Verify URL contains UUID (not name)
    expect(page.url()).toContain('550e8400-e29b-41d4-a716-446655440001');

    // Book package
    await page.click('button:has-text("Book Now")');
    await page.fill('input[type="date"]', '2025-06-15');
    await page.click('button:has-text("Confirm Booking")');

    // Verify success
    await expect(page).toHaveURL('/booking-success');
  });
});
```

---

## Test Results Summary

### Passing Criteria

- ✅ All 7 test cases pass without errors
- ✅ Database bookings contain correct provider_id FKs
- ✅ No vendor switching or package mismatches
- ✅ Concurrent booking attempts fail gracefully
- ✅ Invalid UUIDs handled without SQL injection
- ✅ sessionStorage carts expire correctly
- ✅ AI recommendations link to real vendors with UUIDs

### Performance Metrics

- ✅ Route navigation < 500ms
- ✅ Vendor profile load < 1000ms
- ✅ Booking submit < 1500ms
- ✅ Validation checks < 10ms (synchronous)

---

## Known Limitations & Future Tests

1. **Not Tested** (out of scope for this phase):
   - Multi-language vendor names
   - Image upload/display flow
   - Review/rating system
   - Refund/cancellation flow

2. **Future Enhancements**:
   - Performance benchmarking
   - Load testing (concurrent users)
   - Mobile device testing
   - Accessibility (WCAG) compliance
   - Cross-browser compatibility

---

## Debugging Checklist

If tests fail, check:

1. **Database connectivity**
   ```sql
   SELECT COUNT(*) FROM provider_profiles;
   SELECT COUNT(*) FROM pricing_packages;
   ```

2. **Route parameters**
   - Check browser URL matches UUID format
   - Verify route param passed to component props

3. **Vendor data loading**
   - Check network tab for `/rest/v1/provider_profiles` requests
   - Verify response contains correct `id` field

4. **BookingModal submission**
   - Check network tab for POST `/rest/v1/bookings`
   - Verify payload contains `provider_id` and `package_id`

5. **sessionStorage persistence**
   - Check DevTools → Application → sessionStorage
   - Verify keys and values present after navigation

6. **Validation errors**
   - Check browser console for validation error logs
   - Verify error messages displayed to user

---

## Conclusion

✅ **Comprehensive testing guide created for all vendor flows**

- 7 detailed test cases covering all discovery entry points
- Step-by-step verification procedures
- Browser DevTools checks
- Database verification queries
- Edge cases (expiration, concurrency, injection)
- Optional automated tests (unit + E2E)
- Debugging checklist for troubleshooting

**Status**: Ready for execution - move to FIX 7 (comprehensive test matrix)

---

## Test Execution Checklist

- [ ] Test Case 1: Homepage → Standard Booking (passed/failed)
- [ ] Test Case 2: Browse by Event → Booking (passed/failed)
- [ ] Test Case 3: Catering → Cart → Booking (passed/failed)
- [ ] Test Case 4: AI Planner → Real Vendors (passed/failed)
- [ ] Test Case 5: Cross-Vendor Prevention (passed/failed)
- [ ] Test Case 6: Concurrent Booking Prevention (passed/failed)
- [ ] Test Case 7: Invalid UUID Handling (passed/failed)
- [ ] Unit tests executed (if running automated tests)
- [ ] E2E tests executed (if running automated tests)
- [ ] All database verification queries passed
- [ ] No SQL injection vulnerabilities found
- [ ] Performance metrics acceptable

**Date Tested**: _______________
**Tested By**: _______________
**Overall Status**: ✅ PASS / ❌ FAIL

---

**Last Updated**: This session - FIX 6 Complete
