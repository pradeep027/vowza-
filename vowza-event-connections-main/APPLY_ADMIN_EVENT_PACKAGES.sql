-- ─── APPLY ADMIN EVENT PACKAGES MIGRATION ─────────────────────────────────────
-- Run this in Supabase SQL Editor to create the admin event packages system
-- Copy entire content and paste in SQL Editor, then click "Run"

-- ─── 1. Core Admin Event Packages Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_event_packages (
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
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT unique_event_tier UNIQUE(event_type_id, tier),
  CONSTRAINT valid_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_price CHECK (base_price > 0)
);

-- ─── 2. Package Inclusions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_event_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.artist_categories(id) ON DELETE CASCADE,
  is_included BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_package_category UNIQUE(package_id, category_id)
);

-- ─── 3. Discount Audit Trail ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_event_package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(255),
  active_from TIMESTAMP NOT NULL,
  active_until TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_discount_audit CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

-- ─── 4. Customer Package Bookings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_event_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE RESTRICT,
  
  event_date DATE NOT NULL,
  event_location VARCHAR(500),
  guest_count INT,
  
  package_price DECIMAL(12, 2) NOT NULL,
  discount_applied DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  
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

-- ─── Drop existing policies (if any) ───────────────────────────────────────────
DROP POLICY IF EXISTS "admin_event_packages_admin_all" ON public.admin_event_packages;
DROP POLICY IF EXISTS "admin_event_packages_customer_view" ON public.admin_event_packages;
DROP POLICY IF EXISTS "admin_event_package_inclusions_admin_all" ON public.admin_event_package_inclusions;
DROP POLICY IF EXISTS "admin_event_package_inclusions_customer_view" ON public.admin_event_package_inclusions;
DROP POLICY IF EXISTS "admin_event_package_discounts_admin_all" ON public.admin_event_package_discounts;
DROP POLICY IF EXISTS "admin_event_package_bookings_admin_all" ON public.admin_event_package_bookings;
DROP POLICY IF EXISTS "admin_event_package_bookings_customer_view" ON public.admin_event_package_bookings;
DROP POLICY IF EXISTS "admin_event_package_bookings_customer_insert" ON public.admin_event_package_bookings;

-- ─── RLS Policies: admin_event_packages ────────────────────────────────────────
CREATE POLICY "admin_event_packages_admin_all" ON public.admin_event_packages
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

CREATE POLICY "admin_event_packages_customer_view" ON public.admin_event_packages
  FOR SELECT USING (is_active = TRUE);

-- ─── RLS Policies: admin_event_package_inclusions ──────────────────────────────
CREATE POLICY "admin_event_package_inclusions_admin_all" ON public.admin_event_package_inclusions
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

CREATE POLICY "admin_event_package_inclusions_customer_view" ON public.admin_event_package_inclusions
  FOR SELECT USING (TRUE);

-- ─── RLS Policies: admin_event_package_discounts ────────────────────────────────
CREATE POLICY "admin_event_package_discounts_admin_all" ON public.admin_event_package_discounts
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- ─── RLS Policies: admin_event_package_bookings ────────────────────────────────
CREATE POLICY "admin_event_package_bookings_admin_all" ON public.admin_event_package_bookings
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

CREATE POLICY "admin_event_package_bookings_customer_view" ON public.admin_event_package_bookings
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "admin_event_package_bookings_customer_insert" ON public.admin_event_package_bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ─── Create Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_event_packages_event_type_id 
  ON public.admin_event_packages(event_type_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_packages_is_active 
  ON public.admin_event_packages(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_event_packages_tier 
  ON public.admin_event_packages(tier);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_inclusions_package_id 
  ON public.admin_event_package_inclusions(package_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_inclusions_category_id 
  ON public.admin_event_package_inclusions(category_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_discounts_package_id 
  ON public.admin_event_package_discounts(package_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_bookings_customer_id 
  ON public.admin_event_package_bookings(customer_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_bookings_package_id 
  ON public.admin_event_package_bookings(package_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_package_bookings_status 
  ON public.admin_event_package_bookings(status);

-- ✅ Done! All tables, policies, and indexes created successfully.
