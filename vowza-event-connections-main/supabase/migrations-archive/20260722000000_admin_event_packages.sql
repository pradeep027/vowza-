-- ─── Admin Event Packages Migration ───────────────────────────────────────────
-- Purpose: Create admin-controlled event package system (Silver/Gold/Platinum tiers)
-- Date: July 22, 2026
-- Note: COMPLETELY SEPARATE from vendor packages. Admin-only control.

-- ─── 1. Core Admin Event Packages Table ───────────────────────────────────────
CREATE TABLE public.admin_event_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL, -- 'Silver', 'Gold', 'Platinum'
  display_name VARCHAR(255) NOT NULL, -- e.g., "Silver Wedding Package"
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
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT unique_event_tier UNIQUE(event_type_id, tier),
  CONSTRAINT valid_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_price CHECK (base_price > 0)
);

-- ─── 2. Package Inclusions (What categories are included in each tier) ────────
CREATE TABLE public.admin_event_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.artist_categories(id) ON DELETE CASCADE,
  is_included BOOLEAN DEFAULT TRUE, -- Pre-selected for this tier
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_package_category UNIQUE(package_id, category_id)
);

-- ─── 3. Discount Audit Trail ──────────────────────────────────────────────────
CREATE TABLE public.admin_event_package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(255), -- "Seasonal promotion", "Holiday sale", etc.
  active_from TIMESTAMP NOT NULL,
  active_until TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_discount_audit CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

-- ─── 4. Customer Package Bookings ──────────────────────────────────────────────
CREATE TABLE public.admin_event_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE RESTRICT,
  
  -- Event details
  event_date DATE NOT NULL,
  event_location VARCHAR(500),
  guest_count INT,
  
  -- Pricing snapshot (locked in at purchase time - protects against future price changes)
  package_price DECIMAL(12, 2) NOT NULL,
  discount_applied DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid'))
);

-- ─── Enable Row Level Security ─────────────────────────────────────────────────
ALTER TABLE public.admin_event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_bookings ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: admin_event_packages ────────────────────────────────────────
-- Admin: Full CRUD access
CREATE POLICY "admin_event_packages_admin_all" ON public.admin_event_packages
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View active packages only
CREATE POLICY "admin_event_packages_customer_view" ON public.admin_event_packages
  FOR SELECT USING (is_active = TRUE);

-- ─── RLS Policies: admin_event_package_inclusions ──────────────────────────────
-- Admin: Full CRUD
CREATE POLICY "admin_event_package_inclusions_admin_all" ON public.admin_event_package_inclusions
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View to see package details
CREATE POLICY "admin_event_package_inclusions_customer_view" ON public.admin_event_package_inclusions
  FOR SELECT USING (TRUE);

-- ─── RLS Policies: admin_event_package_discounts ────────────────────────────────
-- Admin: Full CRUD
CREATE POLICY "admin_event_package_discounts_admin_all" ON public.admin_event_package_discounts
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- ─── RLS Policies: admin_event_package_bookings ────────────────────────────────
-- Admin: Full access
CREATE POLICY "admin_event_package_bookings_admin_all" ON public.admin_event_package_bookings
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View own bookings
CREATE POLICY "admin_event_package_bookings_customer_view" ON public.admin_event_package_bookings
  FOR SELECT USING (customer_id = auth.uid());

-- Customers: Insert (create new bookings)
CREATE POLICY "admin_event_package_bookings_customer_insert" ON public.admin_event_package_bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ─── Create Indexes for Performance ────────────────────────────────────────────
CREATE INDEX idx_admin_event_packages_event_type_id 
  ON public.admin_event_packages(event_type_id);

CREATE INDEX idx_admin_event_packages_is_active 
  ON public.admin_event_packages(is_active);

CREATE INDEX idx_admin_event_packages_tier 
  ON public.admin_event_packages(tier);

CREATE INDEX idx_admin_event_package_inclusions_package_id 
  ON public.admin_event_package_inclusions(package_id);

CREATE INDEX idx_admin_event_package_inclusions_category_id 
  ON public.admin_event_package_inclusions(category_id);

CREATE INDEX idx_admin_event_package_discounts_package_id 
  ON public.admin_event_package_discounts(package_id);

CREATE INDEX idx_admin_event_package_bookings_customer_id 
  ON public.admin_event_package_bookings(customer_id);

CREATE INDEX idx_admin_event_package_bookings_package_id 
  ON public.admin_event_package_bookings(package_id);

CREATE INDEX idx_admin_event_package_bookings_status 
  ON public.admin_event_package_bookings(status);

-- ─── Sample Data (Optional - for testing) ─────────────────────────────────────
-- Uncomment to seed sample packages

/*
-- Get a wedding event type ID (adjust as needed)
DO $$
DECLARE
  wedding_id UUID;
  admin_id UUID;
BEGIN
  -- Get wedding event type
  SELECT id INTO wedding_id FROM public.event_types WHERE name = 'Wedding' LIMIT 1;
  
  -- Get an admin user (adjust email as needed)
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  
  IF wedding_id IS NOT NULL AND admin_id IS NOT NULL THEN
    -- Insert sample packages
    INSERT INTO public.admin_event_packages (event_type_id, tier, display_name, description, base_price, discount_percentage, max_category_selections, max_professionals_per_category, created_by)
    VALUES
      (wedding_id, 'Silver', 'Silver Wedding Package', 'Essential services for your wedding', 100000, 0, 3, 2, admin_id),
      (wedding_id, 'Gold', 'Gold Wedding Package', 'Premium services with enhanced options', 150000, 5, 4, 3, admin_id),
      (wedding_id, 'Platinum', 'Platinum Wedding Package', 'All-inclusive luxury wedding experience', 250000, 10, 6, 4, admin_id);
  END IF;
END $$;
*/

-- ─── Migration Complete ────────────────────────────────────────────────────────
-- Run: supabase db push
-- Rollback: Drop tables if needed (see ADMIN_EVENT_PACKAGES_ARCHITECTURE.md)
