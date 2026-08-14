# Phase 2: Frontend Implementation Plan

## Overview
Build admin event packages management UI and customer-facing package display. Completely separate from vendor packages.

---

## Phase 2A: Files to Modify/Create

### FILES TO MODIFY (3 files)

1. **src/pages/admin/AdminLayout.tsx**
   - Add "Event Packages" menu item to NAV array
   - Add to BUSINESS section
   - Use Gift/Package icon
   - Path: `/admin/event-packages`

2. **src/App.tsx**
   - Add lazy import: `const AdminEventPackages = lazy(() => import("./pages/admin/AdminEventPackages"))`
   - Add route inside `/admin` outlet: `<Route path="event-packages" element={<AdminEventPackages />} />`

3. **src/pages/EventPlanning.tsx**
   - Add section to display Admin Event Packages before artist selection
   - Show Silver/Gold/Platinum packages for the event
   - Add "Select Package" button/flow

### FILES TO CREATE (5 new files)

1. **src/pages/admin/AdminEventPackages.tsx** (Main admin CRUD page)
   - List all packages with filters
   - Create/edit/delete forms
   - Publish/unpublish toggles
   - Search & filter by event/tier
   - Package inclusions management

2. **src/components/AdminEventPackageForm.tsx** (Form component)
   - Event type selector
   - Tier selector (Silver/Gold/Platinum - radio buttons)
   - Price input (base_price, discount_percentage)
   - Display name & description
   - Max category selections
   - Max professionals per category
   - Status toggle (draft/published)
   - Inclusions selector (checkboxes - mandatory vs optional)

3. **src/components/EventPackageCard.tsx** (Customer display card)
   - Package name + tier badge
   - Description
   - Pricing display (original, discount, final)
   - Savings amount
   - Included services list
   - Optional services list
   - "Book/Select" button

4. **src/components/EventPackageSelector.tsx** (Customer selection UI)
   - Display 3 tier cards for an event
   - Show all packages for selected event
   - Handle package selection
   - Inclusions customization modal

5. **src/hooks/useEventPackages.ts** (Query hook)
   - Fetch packages by event_type_id
   - Fetch by tier
   - Fetch all (admin)
   - Create/update/delete mutations
   - Inclusion management

---

## Phase 2B: Component Architecture

### AdminEventPackages.tsx Structure
```
┌─ Admin Event Packages Page
├─ Header + Add New button
├─ Filters (Event selector, Tier selector, Status toggle, Search)
├─ Table/Grid of packages
│  └─ Each row: name, event, tier, price, discount, status, actions
├─ Edit Modal (reuse form)
├─ Delete confirmation dialog
└─ Inclusion management modal
```

### EventPackageSelector.tsx Structure (Customer)
```
┌─ Event Packages Section
├─ Three tier cards (Silver, Gold, Platinum)
│  ├─ Package name + badge
│  ├─ Description
│  ├─ Pricing
│  ├─ Included services
│  └─ "Select" button
└─ Package detail modal on selection
   ├─ Show all inclusions (mandatory + optional)
   ├─ Allow removing max 2 optional
   ├─ Live price calculation
   └─ "Book" button
```

---

## Phase 2C: Data Flow

### Admin Create Package
```
Form Submit
  → POST to admin_event_packages
  → Auto-insert inclusions (admin_event_package_inclusions)
  → Toast success
  → Refresh list
```

### Customer Select Package
```
Click package
  → Show modal with inclusions
  → Checkboxes to remove optional (max 2)
  → Price updates live
  → Click "Book"
  → Insert to admin_event_package_bookings
  → Save pricing snapshot
  → Save removed inclusions
  → Redirect to checkout/confirmation
```

---

## Phase 2D: Exact Implementation Steps

### Step 1: Update AdminLayout.tsx
- Import Package icon (from lucide-react)
- Add nav item with Gift/Package icon to BUSINESS section
- Position after "Coupons" or "Reports"

### Step 2: Update App.tsx
- Import AdminEventPackages
- Add route

### Step 3: Create useEventPackages.ts hook
- getPackagesByEventType(eventTypeId)
- getPackagesByTier(eventTypeId, tier)
- getAllPackages() - admin
- createPackage(data) - admin
- updatePackage(id, data) - admin
- deletePackage(id) - admin
- createInclusion(packageId, categoryId, isIncluded)
- getInclusions(packageId)

### Step 4: Create AdminEventPackageForm.tsx
- Controlled form component
- Event type selector (dropdown)
- Tier radio buttons (Silver/Gold/Platinum only)
- Price inputs
- Display name & description
- Category inclusions checkboxes (with mandatory/optional toggle)
- Submit button

### Step 5: Create AdminEventPackages.tsx
- Use form component for create/edit
- Table view of all packages
- Filters: event, tier, status, search
- Actions: edit, delete, toggle publish
- Delete confirmation modal
- Loading states

### Step 6: Create EventPackageCard.tsx
- Receive package data as prop
- Display tier badge (color-coded)
- Show pricing with discount
- List included/optional services
- Button to book/select

### Step 7: Create EventPackageSelector.tsx
- Fetch packages for selected event
- Display 3 cards (one per tier)
- On card click: show detail modal
- Modal: show inclusions, allow removing max 2 optional
- Live price calculation
- Book button → create booking → redirect

### Step 8: Integrate into EventPlanning.tsx
- Add EventPackageSelector section
- Position at top (before artist selection)
- Pass eventId to component
- Handle booking flow

---

## Phase 2E: Security Checks

✅ RLS policies already created (admin-only)
✅ Booking price snapshot prevents frontend manipulation
✅ Database constraints on discount (0-100%)
✅ Database constraints on price (> 0)
✅ Optional inclusion removal limit enforced in UI + validation

---

## Phase 2F: Testing Checklist

- [ ] Admin can create Silver/Gold/Platinum for Wedding
- [ ] Admin can set price, discount, inclusions
- [ ] Admin can publish/unpublish
- [ ] Admin can edit existing package
- [ ] Admin can delete package
- [ ] Customer sees published Wedding packages on Browse by Event Type → Wedding
- [ ] Customer can select package
- [ ] Customer can remove max 2 optional inclusions
- [ ] Price updates correctly when removing inclusions
- [ ] Booking is created with correct pricing snapshot
- [ ] Existing vendor packages unaffected
- [ ] Browse Artists category section unchanged
- [ ] RLS prevents vendors from editing admin packages

---

## Phase 2G: Build & Deploy

```bash
npm run build
# Fix any errors
npm run lint
npm run test (if applicable)
```

---

## Files Modified/Created Summary

| File | Type | Change |
|------|------|--------|
| src/pages/admin/AdminLayout.tsx | Modify | Add nav item |
| src/App.tsx | Modify | Add import + route |
| src/pages/EventPlanning.tsx | Modify | Add package selector |
| src/pages/admin/AdminEventPackages.tsx | Create | Admin CRUD page |
| src/components/AdminEventPackageForm.tsx | Create | Reusable form |
| src/components/EventPackageCard.tsx | Create | Package display |
| src/components/EventPackageSelector.tsx | Create | Customer selector |
| src/hooks/useEventPackages.ts | Create | Query hooks |

**Total: 3 modify + 5 create = 8 files**

---

## Status

✅ Plan Complete - Ready for Phase 2B implementation
