# Quick Start: Homepage Promotions with Vendor/Package Links

## What Changed?

Homepage promotional cards now link to **exact vendors and packages** instead of being decorative images.

## For Admins

### Creating a Promotion

1. Go to: `/admin/auth-promotion`
2. Select a slot (1-4)
3. Upload an image
4. **NEW:** Select Category → Vendor → Package
5. Publish

### Result on Homepage

```
┌─────────────────────────────┐
│                             │
│  [Promotion Image]          │
│                             │
│ Sri Lakshmi Catering        │
│ Premium Wedding Catering    │
│                             │
│    [Book Now →]             │
└─────────────────────────────┘
```

## For Customers

1. See promotion card on homepage
2. Click "Book Now" (or anywhere on card)
3. Opens exact vendor profile
4. Browse packages → select → book

## For Developers

### Key Files

**Database:**
- Migration: `supabase/migrations-archive/20260920000000_enhance_promotion_vendor_packages.sql`
- Fields added: `category`, `provider_id`, `package_id`, `vendor_name`, `package_name`, `is_published`

**Frontend:**
- Enhanced: `src/components/AuthPromotionMediaCards.tsx`
- New: `src/components/admin/PromotionVendorPackageSelector.tsx`
- Updated: `src/integrations/supabase/auth-promo.ts`
- Updated: `src/hooks/useAuthPromotionMedia.ts`

### Admin Integration

Add PromotionVendorPackageSelector to AdminAuthPromotionalManager:

```typescript
import PromotionVendorPackageSelector from '@/components/admin/PromotionVendorPackageSelector';

// In component:
<PromotionVendorPackageSelector
  onSelect={(data) => {
    // Store data.category, data.provider_id, data.package_id, etc.
  }}
/>

// When saving:
await createAuthPromotionMedia({
  // ... existing fields
  category: data.category,
  provider_id: data.provider_id,
  package_id: data.package_id,
  package_table: data.package_table,
  vendor_name: data.vendor_name,
  package_name: data.package_name,
  destination_type: 'package',
  is_published: false,
});
```

## How It Works

```
Admin selects vendor/package
        ↓
Stored in database with UUID references
        ↓
Homepage loads and displays vendor name + package name
        ↓
Customer clicks → navigates to /provider/{vendor_uuid}
        ↓
ProviderProfile loads vendor by UUID
        ↓
Customer books → booking includes vendor_id + package_id
```

## Build Status

✓ TypeScript: 0 errors
✓ npm run build: PASS
✓ Ready for deployment

## Testing

```bash
# 1. Create test promotion
Admin → Auth Promotion Manager → Slot 1 → Upload image → Select catering vendor → Select package → Publish

# 2. Verify homepage
Homepage → Slot 1 card → See vendor name + package name + Book Now button

# 3. Test booking
Click Book Now → Vendor profile loads → Select package → Book

# 4. Verify database
Check bookings table:
- booking.provider_id = promotion.provider_id ✓
- booking.package_id = promotion.package_id ✓
```

## Backward Compatibility

Image-only promotions (no vendor_id) still work. Set vendor_id to NULL to use existing behavior.

## Questions?

See: `PROMOTION_SYSTEM_IMPLEMENTATION.md` for detailed architecture and integration guide.
