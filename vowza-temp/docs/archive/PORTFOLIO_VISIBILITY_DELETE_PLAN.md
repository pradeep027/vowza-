# PORTFOLIO VISIBILITY & DELETE FEATURE - IMPLEMENTATION PLAN

## Overview

Add delete and visibility management (public/private) for portfolio items across all vendor categories.

**Status:** Ready to implement  
**Scope:** Unified `portfolio_items` table (used by all categories)  
**Impact:** ALL vendor categories automatically supported  

---

## Architecture

### Database Layer

**Table:** `public.portfolio_items`

**New Field:**
- `is_published` (BOOLEAN, DEFAULT FALSE)
  - `true` = PUBLIC (visible to customers and other vendors)
  - `false` = PRIVATE (only owner can see)

**RLS Policies (Updated):**
```sql
SELECT:
  - Published items: anyone can see
  - Private items: only owner can see

INSERT:
  - Only authenticated owner can insert

UPDATE:
  - Only owner can change visibility or other fields

DELETE:
  - Only owner can delete
```

**Default for New Uploads:**
- `is_published = FALSE` (PRIVATE by default)
- Owner must explicitly click "Make Public"

**Existing Items:**
- Backfilled to `is_published = TRUE` (preserve current public behavior)

### Ownership Chain

```
portfolio_items.provider_id (vendor ID)
        ↓
provider_profiles.id (vendor profile)
        ↓
provider_profiles.user_id (auth.users.id)
```

**Only the owner (authenticated user matching provider_profiles.user_id) can:**
- View private items
- Change visibility
- Delete items

---

## Frontend Implementation

### 1. Update Upload Component (VendorPortfolio.tsx)

**Changes:**
- When inserting new portfolio item, set `is_published = FALSE`
- Show upload success with "PRIVATE" status
- Optionally show "Make Public" button immediately

**Upload Code:**
```typescript
const { error: insErr } = await supabase.from('portfolio_items').insert({
  provider_id: vendorId,
  media_url: pub.publicUrl,
  media_type: file.type.startsWith('video') ? 'video' : 'image',
  title: file.name.replace(/\.[^.]+$/, ''),
  is_published: false,  // ← NEW: DEFAULT PRIVATE
});
```

### 2. Portfolio Item Card Component

**Create:** `src/components/PortfolioItemCard.tsx`

**Features:**
- Display portfolio thumbnail/video
- Show visibility status (PRIVATE / PUBLIC)
- Toggle visibility button (Make Public / Make Private)
- Delete button with confirmation
- Only show controls to owner

**UI Structure:**
```
┌─────────────────────────────────┐
│    [Portfolio Media Preview]    │
├─────────────────────────────────┤
│ Status: PRIVATE / PUBLIC        │
│                                 │
│ [Toggle Visibility] [Delete]    │
└─────────────────────────────────┘
```

### 3. Update Portfolio Gallery Query

**VendorPortfolio.tsx (Owner's Dashboard):**
- Query: ALL portfolio items (both public and private)
- Filter: `provider_id = vendorId`
- Show all with visibility controls

```typescript
// Owner sees all their items
const { data: items } = await supabase
  .from('portfolio_items')
  .select('*')
  .eq('provider_id', vendorId)
  .order('created_at', { ascending: false });
```

**ProviderProfile.tsx (Public Profile):**
- Query: Only published items
- Filter: `provider_id = vendorId AND is_published = true`

```typescript
// Public sees only published items
const { data: items } = await supabase
  .from('portfolio_items')
  .select('*')
  .eq('provider_id', vendorId)
  .eq('is_published', true)  // ← NEW
  .order('created_at', { ascending: false });
```

### 4. Visibility Toggle Function

**New Hook:** `src/hooks/usePortfolioVisibility.ts`

```typescript
export function usePortfolioVisibility() {
  const toggleVisibility = async (itemId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .update({ is_published: !currentStatus })
        .eq('id', itemId);
      
      if (error) throw error;
      return !currentStatus;
    } catch (error) {
      console.error('Failed to update visibility:', error);
      throw error;
    }
  };
  
  return { toggleVisibility };
}
```

### 5. Delete Function

**New Hook:** `src/hooks/usePortfolioDelete.ts`

```typescript
export function usePortfolioDelete() {
  const deletePortfolioItem = async (itemId: string, mediaUrl: string) => {
    try {
      // 1. Delete database record
      const { error: dbError } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', itemId);
      
      if (dbError) throw dbError;
      
      // 2. Delete storage file (if applicable)
      // Extract path from mediaUrl and delete from provider-media bucket
      const path = extractStoragePath(mediaUrl);
      if (path) {
        await supabase.storage.from('provider-media').remove([path]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete portfolio item:', error);
      throw error;
    }
  };
  
  return { deletePortfolioItem };
}
```

### 6. Update All Public Portfolio Display

**Locations to update:**
- `src/pages/ProviderProfile.tsx` - Vendor profile page
- `src/pages/vendor/VendorDetail.tsx` - Marketplace vendor detail
- `src/components/VendorCard.tsx` - Vendor cards in search results
- `src/pages/AIPlanner.tsx` - Planner vendor results
- Any other place showing vendor portfolio

**Pattern:**
```typescript
// BEFORE: Show all portfolio items
const portfolio = await supabase
  .from('portfolio_items')
  .select('*')
  .eq('provider_id', vendorId);

// AFTER: Show only published items
const portfolio = await supabase
  .from('portfolio_items')
  .select('*')
  .eq('provider_id', vendorId)
  .eq('is_published', true);  // ← ADD THIS
```

---

## Files to Create

### New Files
- `src/components/PortfolioItemCard.tsx` - Portfolio item card with controls
- `src/hooks/usePortfolioVisibility.ts` - Visibility toggle hook
- `src/hooks/usePortfolioDelete.ts` - Delete functionality hook
- `supabase/migrations/20260922000000_portfolio_visibility_delete.sql` - Migration

### Files to Modify
- `src/pages/vendor/VendorPortfolio.tsx` - Upload defaults & portfolio display
- `src/pages/ProviderProfile.tsx` - Filter by is_published
- `src/pages/vendor/VendorDetail.tsx` - Filter by is_published (if applicable)
- `src/components/VendorCard.tsx` - Filter by is_published (if applicable)
- `src/pages/AIPlanner.tsx` - Filter by is_published (if applicable)
- Any other file displaying public portfolio

---

## Security Checklist

### Database-Level Security ✓
- [x] RLS policies enforce ownership
- [x] Private items filtered by SELECT policy
- [x] DELETE allowed only for owner
- [x] UPDATE allowed only for owner

### Frontend Security ✓
- [ ] Delete button only shown to owner
- [ ] Visibility toggle only shown to owner
- [ ] Confirmation dialog on delete
- [ ] Error handling for failed operations

### Storage Security ✓
- [ ] Storage file deleted when portfolio item deleted
- [ ] Storage path extracted correctly
- [ ] No orphaned files left in bucket

---

## Testing Matrix

| Test | Expected Result | Status |
|------|-----------------|--------|
| Vendor A uploads image | Image is PRIVATE by default | ⏳ To implement |
| Vendor A views own portfolio | Shows all items (public + private) | ⏳ To implement |
| Vendor B views Vendor A profile | Only sees PUBLIC items | ⏳ To implement |
| Customer views Vendor A profile | Only sees PUBLIC items | ⏳ To implement |
| Vendor A clicks "Make Public" | Item becomes PUBLIC, visible to customers | ⏳ To implement |
| Vendor A clicks "Make Private" | Item becomes PRIVATE, hidden from public | ⏳ To implement |
| Vendor A deletes own item | Item removed from DB and storage | ⏳ To implement |
| Vendor B attempts direct delete | RLS blocks with permission error | ⏳ To implement |
| Customer attempts direct delete | RLS blocks with permission error | ⏳ To implement |
| Video portfolio item | Same visibility/delete logic applies | ⏳ To implement |
| Multiple categories | All categories use same portfolio_items table | ✅ Already unified |
| Direct API attempts | RLS policies enforce authorization | ✅ Database-enforced |

---

## Rollout Plan

### Phase 1: Database Migration
1. Run migration to add `is_published` field
2. Backfill existing items to `is_published = TRUE`
3. Update RLS policies
4. Verify policies work

### Phase 2: Frontend Implementation
1. Create PortfolioItemCard component
2. Create usePortfolioVisibility hook
3. Create usePortfolioDelete hook
4. Update VendorPortfolio.tsx upload logic
5. Update ProviderProfile.tsx query
6. Update other portfolio display locations

### Phase 3: Testing
1. Test with multiple vendor accounts
2. Test visibility controls
3. Test delete functionality
4. Test across categories
5. Verify private items not accessible

### Phase 4: Deployment
1. Deploy database migration
2. Deploy frontend code
3. Monitor for errors
4. Verify in production

---

## Deployment Instructions

### Step 1: Apply Migration
```bash
supabase db push  # Or manually apply via SQL editor
```

### Step 2: Verify Migration
```sql
-- Check is_published field exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name='portfolio_items' AND column_name='is_published';

-- Check RLS policies
SELECT policy_name, cmd FROM pg_policies 
WHERE tablename='portfolio_items' ORDER BY policy_name;
```

### Step 3: Deploy Frontend Code
```bash
npm run build
# Deploy to Vercel
```

### Step 4: Test in Production
- Upload new portfolio item → should be PRIVATE
- Make it PUBLIC → should be visible to customers
- Make it PRIVATE → should be hidden from customers
- Delete item → should remove from DB and storage
- Other vendor cannot delete → RLS blocks

---

## What's NOT Changing

✓ Package galleries (photography_package_images, etc.)  
✓ Authentication system  
✓ Package creation/booking  
✓ Payment system  
✓ Vendor registration  
✓ Marketplace UI (except portfolio filtering)  
✓ All other features  

**ONLY** portfolio_items visibility/delete is being added.

---

## Success Criteria

✅ New uploads are PRIVATE by default  
✅ Owner can toggle visibility  
✅ Owner can delete items  
✅ Private items not visible to others  
✅ Public items visible to customers  
✅ Works for all vendor categories  
✅ Works for images and videos  
✅ RLS enforces ownership  
✅ No storage orphans  
✅ All tests pass  

