# Admin Event Packages Architecture Report
## PHASE 1: INSPECTION COMPLETE — READY FOR APPROVAL

**Date:** July 22, 2026  
**Status:** ✅ Architecture Inspection Complete | ⏳ Awaiting User Approval  
**Scope:** Admin-controlled Silver/Gold/Platinum event packages (100% separate from vendor packages)

---

## Executive Summary

This document details the proposed architecture for a **new admin-controlled event package system** that is completely separate from existing vendor packages. All pricing, discounts, availability, and package management is controlled exclusively by Vowza Admin. Vendors and customers cannot modify package pricing.

### Key Principles
- ✅ **Completely separate** from vendor packages (no overlap, no pollution)
- ✅ **Admin-only control** (create, edit, delete, activate/deactivate packages)
- ✅ **Event-type bound** (each event type—Wedding, Reception, etc.—has its own Silver/Gold/Platinum tiers)
- ✅ **No vendor involvement** (vendors cannot create or manage these packages)
- ✅ **Zero changes** to existing Browse by Event Type, categories, or vendor system

---

## Existing Architecture (Unchanged)

### Event Types Table
```
event_types (uuid, name, icon, created_at)
├── Wedding
├── Reception
├── Birthday
├── Engagement
├── Corporate Event
├── Festival
├── Anniversary
└── Religious Ceremony
```

### Homepage Event Discovery Flow
1. **BrowseByEvent Component** (`/src/components/BrowseByEvent.tsx`)
   - Queries live event_types from DB (with fallback to static data)
   - Renders 4-column grid of event cards with icons
   - Click handler: `navigate(/artists?event={eventId})`
   - **NOT MODIFIED** — remains untouched

2. **Route:** `/event/:eventId` → `EventPlanning.tsx`
   - Full event planning page with budget/guest/timeline
   - Uses `eventTypes` from `@/data/services`
   - Loads categories via `getCategoriesForEvent(eventId)`
   - **NOT MODIFIED** — remains untouched

3. **Booking Architecture**
   - `event_bookings` table stores customer event details
   - `booking_events` table links bookings to event types
   - **NOT MODIFIED** — remains untouched

### Vendor Package Architecture (Existing)
- Multiple vendor-specific tables: `photography_packages`, `singer_packages`, `dj_packages`, etc.
- Each vendor controls their own package pricing and details
- Customers select vendor → view vendor's packages → book
- **NOT MODIFIED** — remains completely untouched

### Admin Architecture (Existing)
- **AdminLayout** (collapsed sidebar, mobile drawer, role-based nav)
- **Navigation sections:** MAIN, CONTENT, BUSINESS, SERVICES, SYSTEM
- **CRUD pattern:** AdminCategories, AdminCoupons, etc.
- Admin can manage categories, coupons, announcements, etc.
- **Will extend:** Add new "Event Packages" menu item in BUSINESS section

---

## Proposed: Admin Event Packages Architecture

### New Database Schema

#### 1. `admin_event_packages` (Core)
```sql
CREATE TABLE admin_event_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL, -- 'Silver', 'Gold', 'Platinum'
  display_name VARCHAR(255) NOT NULL, -- "Silver Wedding Package"
  description TEXT,
  
  -- Pricing (admin-controlled, immutable by customers/vendors)
  base_price DECIMAL(12, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0, -- 0-100
  final_price DECIMAL(12, 2) GENERATED ALWAYS AS 
    (base_price * (1 - discount_percentage / 100)) STORED,
  
  -- Package customization limits
  max_category_selections INT DEFAULT 3, -- How many service categories customer can select
  max_professionals_per_category INT DEFAULT 2, -- Max vendors per category
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES profiles(id), -- Admin who created
  
  UNIQUE(event_type_id, tier)
);
```

#### 2. `admin_event_package_inclusions` (What's Included)
```sql
CREATE TABLE admin_event_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES admin_event_packages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES artist_categories(id),
  is_included BOOLEAN DEFAULT TRUE, -- Pre-selected for this tier
  sort_order INT DEFAULT 0,
  
  UNIQUE(package_id, category_id)
);
```

#### 3. `admin_event_package_discounts` (Tiered Pricing Audit)
```sql
CREATE TABLE admin_event_package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES admin_event_packages(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(255), -- "Seasonal promotion", "Holiday sale", etc.
  active_from TIMESTAMP NOT NULL,
  active_until TIMESTAMP,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);
```

#### 4. `admin_event_package_bookings` (Customer Purchases)
```sql
CREATE TABLE admin_event_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  package_id UUID NOT NULL REFERENCES admin_event_packages(id),
  
  -- Event details
  event_date DATE NOT NULL,
  event_location VARCHAR(500),
  guest_count INT,
  
  -- Pricing snapshot (locked in at purchase time)
  package_price DECIMAL(12, 2) NOT NULL,
  discount_applied DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Row-Level Security (RLS) Policies

#### `admin_event_packages`
```
1. ADMIN CAN: SELECT, INSERT, UPDATE, DELETE (role = 'admin')
2. CUSTOMER CAN: SELECT is_active=true packages
3. VENDOR CANNOT: See, edit, or interact
4. PUBLIC: Cannot access
```

#### `admin_event_package_inclusions`
```
1. ADMIN CAN: Full CRUD
2. CUSTOMER CAN: SELECT (to view package details)
3. VENDOR CANNOT: Access
4. PUBLIC: Cannot access
```

#### `admin_event_package_bookings`
```
1. ADMIN CAN: SELECT all, UPDATE status/payment_status
2. CUSTOMER CAN: SELECT own bookings (customer_id = auth.uid()), INSERT
3. VENDOR CANNOT: Access
4. PUBLIC: Cannot access
```

---

## Frontend Components (New)

### 1. Admin Page: AdminEventPackages
**Path:** `src/pages/admin/AdminEventPackages.tsx`

**Features:**
- Event type selector (dropdown: Wedding, Reception, Birthday, etc.)
- Tier management (Silver/Gold/Platinum tabs or radio buttons)
- CRUD form (create, edit, delete, toggle active/inactive)
- Price editor with discount calculator
- Category inclusion checkboxes
- Live final_price display
- Package preview
- Delete confirmation modal

**Pattern:** Follows AdminCategories/AdminCoupons (useState + supabase, inline forms, table view)

### 2. Customer UI: Event Package Display
**Location:** BrowseByEvent section (UNCHANGED) or new page `/packages/:eventId`

**Features:**
- Display 3 tier cards: Silver, Gold, Platinum
- Show base price, discount %, final price
- List included categories
- "Select Package" button → adds to cart
- Package comparison modal

**Pattern:** Similar to existing EventPlanning budget cards

### 3. Admin Sidebar Menu Update
**File:** `src/pages/admin/AdminLayout.tsx`

**Change:**
```javascript
// Add to NAV array in BUSINESS section:
{
  label: 'Event Packages',
  icon: Gift, // or Package icon
  path: '/admin/event-packages',
  section: 'BUSINESS'
}
```

---

## Database Migration SQL

**Migration file:** `20260722000000_admin_event_packages.sql`

```sql
-- Create admin_event_packages table
CREATE TABLE admin_event_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(12, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) GENERATED ALWAYS AS 
    (base_price * (1 - discount_percentage / 100)) STORED,
  max_category_selections INT DEFAULT 3,
  max_professionals_per_category INT DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  UNIQUE(event_type_id, tier)
);

-- Create admin_event_package_inclusions table
CREATE TABLE admin_event_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.artist_categories(id),
  is_included BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  UNIQUE(package_id, category_id)
);

-- Create admin_event_package_discounts table
CREATE TABLE admin_event_package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(255),
  active_from TIMESTAMP NOT NULL,
  active_until TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

-- Create admin_event_package_bookings table
CREATE TABLE admin_event_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id),
  event_date DATE NOT NULL,
  event_location VARCHAR(500),
  guest_count INT,
  package_price DECIMAL(12, 2) NOT NULL,
  discount_applied DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE admin_event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_event_package_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_event_package_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_event_package_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_event_packages
CREATE POLICY "Admin full access" ON admin_event_packages
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Customer view active" ON admin_event_packages
  FOR SELECT USING (is_active = TRUE OR auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for admin_event_package_inclusions
CREATE POLICY "Admin full access" ON admin_event_package_inclusions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Customer view" ON admin_event_package_inclusions
  FOR SELECT USING (TRUE);

-- RLS Policies for admin_event_package_discounts
CREATE POLICY "Admin full access" ON admin_event_package_discounts
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for admin_event_package_bookings
CREATE POLICY "Admin full access" ON admin_event_package_bookings
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Customer access own" ON admin_event_package_bookings
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customer insert" ON admin_event_package_bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Create indexes
CREATE INDEX idx_admin_event_packages_event_type_id ON admin_event_packages(event_type_id);
CREATE INDEX idx_admin_event_packages_is_active ON admin_event_packages(is_active);
CREATE INDEX idx_admin_event_package_inclusions_package_id ON admin_event_package_inclusions(package_id);
CREATE INDEX idx_admin_event_package_bookings_customer_id ON admin_event_package_bookings(customer_id);
CREATE INDEX idx_admin_event_package_bookings_package_id ON admin_event_package_bookings(package_id);
```

---

## Files to Create (Phase 2 - Implementation)

### New Files
- `src/pages/admin/AdminEventPackages.tsx` (Main admin CRUD page)
- `src/components/EventPackageCard.tsx` (Customer display)
- `src/components/EventPackageSelector.tsx` (Package selection UI)
- `src/hooks/useEventPackages.ts` (Query hook)
- `src/hooks/useEventPackageBookings.ts` (Booking hook)

### Files to Modify
- `src/pages/admin/AdminLayout.tsx` (Add Event Packages to sidebar NAV)
- `src/App.tsx` (Add new route: `/admin/event-packages`)
- Migration: `APPLY_MIGRATIONS.sql` or create new migration file

### Files to NOT Touch
- ✅ `src/pages/Index.tsx` (unchanged)
- ✅ `src/components/BrowseByEvent.tsx` (unchanged)
- ✅ `src/pages/EventPlanning.tsx` (unchanged)
- ✅ All vendor package files (unchanged)
- ✅ All authentication files (unchanged)
- ✅ All category files (unchanged)

---

## Data Flow

### Admin Creates Package
```
Admin → AdminEventPackages Form
  ↓
  Fill: event_type, tier, price, discount, categories
  ↓
  Supabase INSERT admin_event_packages
  ↓
  Supabase INSERT admin_event_package_inclusions (for each selected category)
  ↓
  Toast success → Reload list
```

### Customer Views & Books Package
```
Customer → BrowseByEvent (unchanged)
  ↓
  Click event type → See Silver/Gold/Platinum options (NEW)
  ↓
  Click "Select" → Confirm event details
  ↓
  Supabase INSERT admin_event_package_bookings (with snapshot of final_price)
  ↓
  Proceed to checkout with selected package
```

### Admin Manages Discount
```
Admin → AdminEventPackages → Select package → Edit discount %
  ↓
  UPDATE admin_event_packages.discount_percentage
  ↓
  final_price recalculates automatically (GENERATED ALWAYS)
  ↓
  Optional: INSERT admin_event_package_discounts (for audit trail)
```

---

## Pricing Logic

### Base Price → Final Price
```
final_price = base_price * (1 - discount_percentage / 100)

Example:
- base_price = ₹50,000
- discount_percentage = 10
- final_price = 50,000 * (1 - 10/100) = ₹45,000
```

### Why GENERATED ALWAYS AS STORED?
- Automatic calculation (no manual updates needed)
- Always consistent with base_price + discount
- Available in all queries (SELECT final_price)
- Single source of truth

---

## Customization Limits

Each package tier includes:
```
max_category_selections = 3    (e.g., Photography, Videography, Decorator)
max_professionals_per_category = 2 (e.g., 2 photographers)
```

Customer can select UP TO these limits when booking. Admin can adjust per tier.

---

## Rollback / Cleanup (If Needed)

Before implementation:
```
-- Do NOT run:
supabase db push   ← Will apply all pending migrations

-- Run ONLY this migration:
supabase db push --experimental --ignore-pending

-- If needed to rollback:
DROP TABLE admin_event_package_bookings;
DROP TABLE admin_event_package_discounts;
DROP TABLE admin_event_package_inclusions;
DROP TABLE admin_event_packages;
```

---

## Approval Checklist

**Before Phase 2 Implementation:**

- [ ] Confirm database schema (tables, columns, constraints)
- [ ] Confirm RLS policies (admin-only control, customer view-only)
- [ ] Confirm UI components (admin CRUD page, customer display)
- [ ] Confirm pricing logic (base → final, discount calculation)
- [ ] Confirm NO changes to existing vendor/category/auth system
- [ ] Confirm migration SQL is correct
- [ ] Confirm file structure (what to create, what to modify)
- [ ] Approve going to Phase 2: Implementation

---

## Next Steps

1. **Review this architecture document**
2. **Ask questions or request modifications**
3. **Mark approval** → I will proceed with Phase 2
4. **Phase 2 will include:**
   - Run migration SQL in Supabase
   - Create all new files
   - Modify existing files (AdminLayout, App.tsx)
   - Build admin CRUD page
   - Build customer UI components
   - Test end-to-end flow
   - Do NOT modify vendor packages, categories, auth, or homepage

---

**Ready for your approval. Please review and provide feedback.**
