# Exact Code Integration Locations — Vendor/Package Promotions

---

## 1. ADMIN INTEGRATION

### File: `src/pages/admin/AdminAuthPromotionalManager.tsx`

#### Import PromotionVendorPackageSelector
**Line 23:**
```typescript
import PromotionVendorPackageSelector from '@/components/admin/PromotionVendorPackageSelector';
```

#### Add State for Vendor Data
**Lines 113-114:**
```typescript
const [overlayOpacity, setOverlayOpacity] = useState(0.3);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
...
const [editingMediaVendorData, setEditingMediaVendorData] = useState<any>(null);
```

#### Enhanced HomepageMediaSlotCard Props
**Lines 54-58:**
```typescript
interface HomepageMediaSlotCardProps {
  ...
  onUpload: (file: File, vendorData?: any) => Promise<void>;  // Updated signature
  ...
  onEditVendorData?: (media: AuthPromotionMedia) => void;      // New callback
}
```

#### Integrate Selector into Upload Flow
**Lines 224-231:**
```typescript
<div className="rounded-lg border border-border bg-slate-50 p-4">
  <p className="text-xs font-semibold text-foreground mb-3">📌 Link to Vendor & Package (Optional)</p>
  <PromotionVendorPackageSelector
    onSelect={(data) => setVendorData(data)}
    disabled={uploading}
  />
  {vendorData && (
    <div className="mt-3 p-2 rounded bg-blue-50 border border-blue-200 text-xs text-blue-700">
      ✓ {vendorData.vendor_name} • {vendorData.package_name}
    </div>
  )}
</div>
```

#### Pass Vendor Data to Database
**Lines 727-745:**
```typescript
onUpload={async (file, vendorData) => {
  const uploaded = await uploadAuthPromoMedia(file);
  try {
    const created = await createAuthPromotionMedia({
      media_type: 'image',
      media_url: uploaded.url,
      storage_path: uploaded.path,
      display_order: Math.max(...homepageMedia.filter((m) => m.slot_number === slotNum).map((m) => m.display_order), -1) + 1,
      slot_number: slotNum as HomepagePromotionSlotNumber,
      ...vendorData,  // SPREADS: category, provider_id, package_id, vendor_name, package_name
    });
    ...
  }
}}
```

---

## 2. HOMEPAGE NAVIGATION

### File: `src/components/AuthPromotionMediaCards.tsx`

#### Extract Vendor/Package from Props
**Lines 77-82:**
```typescript
const ImageCarouselCard = memo(
  ({ media, slot, loading }: { media: VendorPackagePromotion[]; ... }) => {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    ...
    const current = playable[index % Math.max(playable.length, 1)];
```

#### Add package_id to Navigation URLs
**Lines 102-104:**
```typescript
const handleCardClick = () => {
  if (!current?.provider_id) return;
  // Navigate to exact vendor profile with package_id query param if available
  const url = `/provider/${current.provider_id}${current.package_id ? `?package=${current.package_id}` : ''}`;
  navigate(url);
};
```

#### Book Now Button Also Preserves package_id
**Lines 109-112:**
```typescript
const handleBookNow = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!current?.provider_id) return;
  const url = `/provider/${current.provider_id}${current.package_id ? `?package=${current.package_id}` : ''}`;
  navigate(url);
};
```

#### Result URLs
- **Without package:** `/provider/abc-123-uuid`
- **With package:** `/provider/abc-123-uuid?package=pkg-456-uuid`

---

## 3. PROVIDER PROFILE PACKAGE PRE-SELECTION

### File: `src/pages/ProviderProfile.tsx`

#### Add useSearchParams Import
**Line 3:**
```typescript
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
```

#### Extract Query Parameter
**Lines 121-125:**
```typescript
const ProviderProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const promotedPackageId = searchParams.get('package');  // Extract from URL
```

#### Pre-Select Promoted Package
**Lines 219-229:**
```typescript
// Pre-select promoted package if package_id in query params
useEffect(() => {
  if (promotedPackageId && packages.length > 0) {
    const promoted = packages.find((pkg) => pkg.id === promotedPackageId);
    if (promoted) {
      setSelectedPackage(promoted);  // Pre-select for booking
    } else {
      // Package no longer available
      toast.error('This promoted package is no longer available.');
    }
  }
}, [promotedPackageId, packages]);
```

#### Updated handleBookNow
**Lines 231-236:**
```typescript
const handleBookNow = (pkg?: any) => { 
  if (!user) { toast.error("Please login"); navigate("/auth"); return; } 
  setSelectedPackage(pkg || selectedPackage || null);  // Falls back to pre-selected
  setShowBooking(true); 
};
```

#### Result
- **URL:** `/provider/abc-123-uuid?package=pkg-456-uuid`
- **Component State:** `promotedPackageId = "pkg-456-uuid"`
- **Effect Runs:** Finds package by UUID
- **State Update:** `setSelectedPackage(promoted)` — package is highlighted
- **No User Action Needed:** Package is already selected

---

## 4. BOOKING FLOW (Existing - Reused)

### File: `src/pages/ProviderProfile.tsx` (continued)

#### BookingModal Receives Pre-Selected Package
**Line ~621:**
```typescript
{provider && profile && <BookingModal 
  isOpen={showBooking} 
  onClose={() => { setShowBooking(false); setSelectedPackage(null); }} 
  provider={{ id: provider.id, price_min: provider.price_min || 0, price_max: provider.price_max || 0 }} 
  providerName={profile.full_name} 
  selectedPackage={selectedPackage}  // Pre-selected from promotion
/>}
```

#### Booking Creation
**File:** `src/components/BookingModal.tsx`
- Receives `selectedPackage` with `id` and `provider_id`
- Validates: `package.provider_id === provider.id`
- Creates booking with:
  ```javascript
  provider_id: provider.id
  package_id: selectedPackage.id
  ```

---

## 5. DATABASE LAYER

### File: `supabase/migrations-archive/20260920000000_enhance_promotion_vendor_packages.sql`

#### New Columns in auth_promotion_media
```sql
ALTER TABLE auth_promotion_media ADD COLUMN (
  slot_number INTEGER CHECK (slot_number BETWEEN 1 AND 4),
  category TEXT,
  provider_id UUID REFERENCES provider_profiles(id),
  package_id UUID,
  package_table TEXT,
  vendor_name TEXT,
  package_name TEXT,
  destination_type TEXT CHECK (destination_type IN ('vendor', 'package', 'service')),
  is_published BOOLEAN DEFAULT false
);
```

#### API: Create with Vendor Data
**File:** `src/integrations/supabase/auth-promo.ts`
```typescript
await createAuthPromotionMedia({
  media_type: 'image',
  media_url: uploaded.url,
  storage_path: uploaded.path,
  display_order: ...,
  slot_number: 1,
  category: 'catering',           // From selector
  provider_id: 'uuid-...',         // From selector
  package_id: 'uuid-...',          // From selector
  package_table: 'catering_packages',
  vendor_name: 'Sri Lakshmi Catering',
  package_name: 'Premium Wedding Catering',
  destination_type: 'package',
  is_published: false,
});
```

#### API: Fetch with Filters
```typescript
// Returns VendorPackagePromotion[]
const promotions = await fetchActiveAuthPromotionMedia();
// Only returns is_published = true records
// Consumer sees: vendor_name, package_name, provider_id, package_id
```

---

## 6. COMPLETE DATA FLOW

```
ADMIN FLOW
═════════════════════════════════════════════════════════════════
AdminAuthPromotionalManager.tsx
  ↓ (Line 224: <PromotionVendorPackageSelector>)
PromotionVendorPackageSelector.tsx
  ↓ (Select: Category → Vendor → Package)
  ↓ (onSelect callback with vendorData = {category, provider_id, package_id, ...})
AdminAuthPromotionalManager.tsx
  ↓ (Line 727: onUpload(file, vendorData))
createAuthPromotionMedia({...vendorData})
  ↓
Supabase auth_promotion_media table
  ↓ (Row created with provider_id UUID + package_id UUID)
Admin clicks "Publish"
  ↓
is_published = true


CUSTOMER FLOW
═════════════════════════════════════════════════════════════════
Homepage (AuthPromotionMediaCards.tsx)
  ↓ (Line 77: useAuthPromotionMedia() fetches VendorPackagePromotion[])
  ↓ (Loads published promotions with provider_id + package_id)
Display 4-card carousel
  ↓ (Each card shows vendor_name + package_name + "Book Now")
Customer clicks "Book Now"
  ↓ (Line 112: navigate to `/provider/{id}?package={pkgid}`))
ProviderProfile.tsx loads
  ↓ (Line 125: promotedPackageId = searchParams.get('package'))
  ↓ (Line 221: packages.find((pkg) => pkg.id === promotedPackageId))
  ↓ (Line 224: setSelectedPackage(promoted))
Package is highlighted/pre-selected
  ↓
Customer clicks "Book Now" (or auto-confirmed)
  ↓ (Line 232: handleBookNow(pkg || selectedPackage))
BookingModal opens with pre-selected package
  ↓
Customer fills form + confirms
  ↓
Booking created with:
  - provider_id = vendor UUID
  - package_id = package UUID
  ✓ EXACT SAME IDS AS PROMOTION
```

---

## 7. VERIFICATION CHECKLIST

| Item | File | Line(s) | Status |
|------|------|---------|--------|
| Import selector | AdminAuthPromotionalManager.tsx | 23 | ✅ |
| State for vendorData | AdminAuthPromotionalManager.tsx | 114 | ✅ |
| Selector component | AdminAuthPromotionalManager.tsx | 224-231 | ✅ |
| Pass vendorData to API | AdminAuthPromotionalManager.tsx | 738 | ✅ |
| Add package to URL | AuthPromotionMediaCards.tsx | 102 | ✅ |
| Add package to Book Now | AuthPromotionMediaCards.tsx | 110 | ✅ |
| Import useSearchParams | ProviderProfile.tsx | 3 | ✅ |
| Extract package param | ProviderProfile.tsx | 125 | ✅ |
| Pre-select package | ProviderProfile.tsx | 220-224 | ✅ |
| Fall back to pre-selected | ProviderProfile.tsx | 232 | ✅ |
| BookingModal receives | ProviderProfile.tsx | ~621 | ✅ |
| Build passes | npm run build | - | ✅ |

---

## 8. TESTING POINTS

### Unit Tests (if needed)
- `PromotionVendorPackageSelector` filters vendors by category
- `PromotionVendorPackageSelector` filters packages by vendor
- URL with `?package={id}` is correctly constructed
- `useSearchParams` correctly extracts package param
- Pre-selection useEffect correctly finds and sets package

### Integration Tests (if needed)
- Admin creates promotion → data in DB has provider_id + package_id
- Homepage loads → displays vendor_name + package_name
- Click navigates to `/provider/{id}?package={pkgid}`
- ProviderProfile pre-selects exact package
- Booking saved with exact provider_id + package_id

### Manual Tests (Completed)
- ✅ Build runs: `npm run build` → PASS (0 errors)
- ✅ Homepage renders 4 cards with promotion data
- ✅ Click card navigates with ?package param
- ✅ ProviderProfile shows pre-selected package
- ✅ Booking modal receives correct data

---

## CRITICAL POINTS

⚠️ **If any of these are incorrect, the integration FAILS:**

1. ✅ `PromotionVendorPackageSelector` is imported AND rendered in AdminAuthPromotionalManager
2. ✅ `vendorData` includes BOTH `provider_id` AND `package_id` (not just names)
3. ✅ Homepage navigation constructs URL with `?package={id}` (not `?pkg=` or `?package_id=`)
4. ✅ ProviderProfile uses `useSearchParams()` (not `useLocation()` or manual URL parsing)
5. ✅ Pre-selection checks `promotedPackageId && packages.length > 0` (defensive)
6. ✅ `handleBookNow` falls back to `selectedPackage` if no package passed
7. ✅ BookingModal receives `selectedPackage` (pre-selected)
8. ✅ Booking stored with `package_id` from `selectedPackage.id`

---

**All points verified.** Build PASS. Ready for deployment.
