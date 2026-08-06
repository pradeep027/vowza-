-- Water Supplier product commerce
-- Isolated from generic provider packages. All owner writes are enforced by RLS
-- and by category guards so non-water providers cannot create water inventory.

CREATE OR REPLACE FUNCTION public.is_water_supplier(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND profession::text = 'water_supplier'
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_water_supplier(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND user_id = auth.uid()
      AND profession::text = 'water_supplier'
  );
$$;

CREATE TABLE IF NOT EXISTS public.water_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.water_categories (code, name, sort_order) VALUES
  ('ro_water', 'RO Water', 10),
  ('mineral_water', 'Mineral Water', 20),
  ('cool_water', 'Cool Water', 30),
  ('normal_water', 'Normal Water', 40),
  ('water_tanker', 'Water Tankers', 50),
  ('bore_water', 'Bore Water', 60),
  ('drinking_water', 'Drinking Water', 70),
  ('construction_water', 'Construction Water', 80),
  ('other', 'Other', 999)
ON CONFLICT (code) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order;

CREATE TABLE IF NOT EXISTS public.water_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.water_categories(id),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  description text,
  unit_type text NOT NULL CHECK (unit_type IN ('bottle','can','litre','tanker','box','1000l','5000l','10000l','custom')),
  water_quality text[] NOT NULL DEFAULT '{}',
  delivery_options text[] NOT NULL DEFAULT '{}',
  delivery_time_minutes integer NOT NULL DEFAULT 30 CHECK (delivery_time_minutes BETWEEN 1 AND 1440),
  is_active boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_products_provider ON public.water_products(provider_id, is_active, is_visible);
CREATE INDEX IF NOT EXISTS idx_water_products_category ON public.water_products(category_id);

CREATE TABLE IF NOT EXISTS public.water_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.water_products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 80),
  size_value numeric(12,3),
  size_unit text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  sku text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, label)
);

CREATE INDEX IF NOT EXISTS idx_water_variants_product ON public.water_product_variants(product_id, is_available);

CREATE TABLE IF NOT EXISTS public.water_product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.water_products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  alt_text text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_cover_image_per_water_product
  ON public.water_product_images(product_id) WHERE is_cover;

CREATE TABLE IF NOT EXISTS public.water_product_stock (
  variant_id uuid PRIMARY KEY REFERENCES public.water_product_variants(id) ON DELETE CASCADE,
  quantity_available integer NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_delivery_settings (
  provider_id uuid PRIMARY KEY REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  delivery_origin_lat numeric(10,7),
  delivery_origin_lng numeric(10,7),
  max_delivery_radius_km numeric(6,2) NOT NULL DEFAULT 50 CHECK (max_delivery_radius_km > 0),
  free_delivery_radius_km numeric(6,2) NOT NULL DEFAULT 5 CHECK (free_delivery_radius_km >= 0),
  extra_delivery_charge numeric(12,2) NOT NULL DEFAULT 100 CHECK (extra_delivery_charge >= 0),
  same_day_delivery_enabled boolean NOT NULL DEFAULT false,
  emergency_delivery_enabled boolean NOT NULL DEFAULT false,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_areas text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delivery_origin_lat IS NULL OR delivery_origin_lat BETWEEN -90 AND 90),
  CHECK (delivery_origin_lng IS NULL OR delivery_origin_lng BETWEEN -180 AND 180),
  CHECK (free_delivery_radius_km <= max_delivery_radius_km)
);

CREATE TABLE IF NOT EXISTS public.product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  delivery_address text NOT NULL,
  delivery_lat numeric(10,7) NOT NULL,
  delivery_lng numeric(10,7) NOT NULL,
  delivery_date date NOT NULL,
  delivery_time_slot text,
  special_instructions text,
  estimated_delivery_minutes integer,
  distance_km numeric(8,2) NOT NULL CHECK (distance_km >= 0),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  delivery_charge numeric(12,2) NOT NULL CHECK (delivery_charge >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_provider ON public.product_orders(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_orders_customer ON public.product_orders(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.water_products(id),
  variant_id uuid NOT NULL REFERENCES public.water_product_variants(id),
  product_name text NOT NULL,
  variant_label text NOT NULL,
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.product_orders(id) ON DELETE CASCADE,
  free_radius_km numeric(6,2) NOT NULL,
  distance_km numeric(8,2) NOT NULL,
  charge numeric(12,2) NOT NULL,
  is_free_delivery boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.water_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.water_products(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.product_order_items(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_water_supplier_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_water_supplier(NEW.provider_id) THEN
    RAISE EXCEPTION 'Water Supplier product data is restricted to water_supplier providers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS water_product_provider_guard ON public.water_products;
CREATE TRIGGER water_product_provider_guard BEFORE INSERT OR UPDATE OF provider_id ON public.water_products
FOR EACH ROW EXECUTE FUNCTION public.enforce_water_supplier_owner();

DROP TRIGGER IF EXISTS delivery_settings_provider_guard ON public.supplier_delivery_settings;
CREATE TRIGGER delivery_settings_provider_guard BEFORE INSERT OR UPDATE OF provider_id ON public.supplier_delivery_settings
FOR EACH ROW EXECUTE FUNCTION public.enforce_water_supplier_owner();

CREATE OR REPLACE FUNCTION public.set_water_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS water_products_updated_at ON public.water_products;
CREATE TRIGGER water_products_updated_at BEFORE UPDATE ON public.water_products FOR EACH ROW EXECUTE FUNCTION public.set_water_updated_at();
DROP TRIGGER IF EXISTS water_variants_updated_at ON public.water_product_variants;
CREATE TRIGGER water_variants_updated_at BEFORE UPDATE ON public.water_product_variants FOR EACH ROW EXECUTE FUNCTION public.set_water_updated_at();
DROP TRIGGER IF EXISTS water_stock_updated_at ON public.water_product_stock;
CREATE TRIGGER water_stock_updated_at BEFORE UPDATE ON public.water_product_stock FOR EACH ROW EXECUTE FUNCTION public.set_water_updated_at();
DROP TRIGGER IF EXISTS supplier_delivery_updated_at ON public.supplier_delivery_settings;
CREATE TRIGGER supplier_delivery_updated_at BEFORE UPDATE ON public.supplier_delivery_settings FOR EACH ROW EXECUTE FUNCTION public.set_water_updated_at();
DROP TRIGGER IF EXISTS product_orders_updated_at ON public.product_orders;
CREATE TRIGGER product_orders_updated_at BEFORE UPDATE ON public.product_orders FOR EACH ROW EXECUTE FUNCTION public.set_water_updated_at();

-- Supplier-configured Haversine quote. Coordinates must come from an approved map/geocoder integration.
CREATE OR REPLACE FUNCTION public.quote_water_delivery(
  p_provider_id uuid,
  p_delivery_lat numeric,
  p_delivery_lng numeric
)
RETURNS TABLE(distance_km numeric, delivery_charge numeric, is_free_delivery boolean, estimated_delivery_minutes integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings public.supplier_delivery_settings%ROWTYPE;
  calculated_distance numeric;
BEGIN
  SELECT * INTO settings FROM public.supplier_delivery_settings WHERE provider_id = p_provider_id;
  IF NOT FOUND OR settings.delivery_origin_lat IS NULL OR settings.delivery_origin_lng IS NULL THEN
    RAISE EXCEPTION 'Supplier delivery origin has not been configured';
  END IF;

  calculated_distance := 6371 * acos(least(1, greatest(-1,
    cos(radians(settings.delivery_origin_lat)) * cos(radians(p_delivery_lat)) *
    cos(radians(p_delivery_lng) - radians(settings.delivery_origin_lng)) +
    sin(radians(settings.delivery_origin_lat)) * sin(radians(p_delivery_lat))
  )));

  IF calculated_distance > settings.max_delivery_radius_km THEN
    RAISE EXCEPTION 'Delivery address is outside this supplier''s delivery radius';
  END IF;

  RETURN QUERY SELECT
    round(calculated_distance, 2),
    CASE WHEN calculated_distance <= settings.free_delivery_radius_km THEN 0 ELSE settings.extra_delivery_charge END,
    calculated_distance <= settings.free_delivery_radius_km,
    CASE WHEN calculated_distance <= settings.free_delivery_radius_km THEN 30 ELSE 45 END;
END;
$$;

ALTER TABLE public.water_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS water_categories_read ON public.water_categories;
CREATE POLICY water_categories_read ON public.water_categories FOR SELECT USING (is_active OR auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS water_products_read ON public.water_products;
CREATE POLICY water_products_read ON public.water_products FOR SELECT USING ((is_active AND is_visible AND NOT is_archived) OR public.owns_water_supplier(provider_id));
DROP POLICY IF EXISTS water_products_owner_write ON public.water_products;
CREATE POLICY water_products_owner_write ON public.water_products FOR ALL USING (public.owns_water_supplier(provider_id)) WITH CHECK (public.owns_water_supplier(provider_id));

DROP POLICY IF EXISTS water_variants_read ON public.water_product_variants;
CREATE POLICY water_variants_read ON public.water_product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND ((p.is_active AND p.is_visible AND NOT p.is_archived) OR public.owns_water_supplier(p.provider_id))));
DROP POLICY IF EXISTS water_variants_owner_write ON public.water_product_variants;
CREATE POLICY water_variants_owner_write ON public.water_product_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND public.owns_water_supplier(p.provider_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND public.owns_water_supplier(p.provider_id)));

DROP POLICY IF EXISTS water_images_read ON public.water_product_images;
CREATE POLICY water_images_read ON public.water_product_images FOR SELECT USING (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND ((p.is_active AND p.is_visible AND NOT p.is_archived) OR public.owns_water_supplier(p.provider_id))));
DROP POLICY IF EXISTS water_images_owner_write ON public.water_product_images;
CREATE POLICY water_images_owner_write ON public.water_product_images FOR ALL USING (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND public.owns_water_supplier(p.provider_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.water_products p WHERE p.id = product_id AND public.owns_water_supplier(p.provider_id)));

DROP POLICY IF EXISTS water_stock_owner_read ON public.water_product_stock;
CREATE POLICY water_stock_owner_read ON public.water_product_stock FOR SELECT USING (EXISTS (SELECT 1 FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id WHERE v.id = variant_id AND public.owns_water_supplier(p.provider_id)));
DROP POLICY IF EXISTS water_stock_owner_write ON public.water_product_stock;
CREATE POLICY water_stock_owner_write ON public.water_product_stock FOR ALL USING (EXISTS (SELECT 1 FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id WHERE v.id = variant_id AND public.owns_water_supplier(p.provider_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id AND public.owns_water_supplier(p.provider_id)));

DROP POLICY IF EXISTS delivery_settings_read ON public.supplier_delivery_settings;
CREATE POLICY delivery_settings_read ON public.supplier_delivery_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS delivery_settings_owner_write ON public.supplier_delivery_settings;
CREATE POLICY delivery_settings_owner_write ON public.supplier_delivery_settings FOR ALL USING (public.owns_water_supplier(provider_id)) WITH CHECK (public.owns_water_supplier(provider_id));

DROP POLICY IF EXISTS product_orders_participant_read ON public.product_orders;
CREATE POLICY product_orders_participant_read ON public.product_orders FOR SELECT USING (customer_id = auth.uid() OR public.owns_water_supplier(provider_id));
DROP POLICY IF EXISTS product_order_items_participant_read ON public.product_order_items;
CREATE POLICY product_order_items_participant_read ON public.product_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.product_orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR public.owns_water_supplier(o.provider_id))));
DROP POLICY IF EXISTS delivery_charges_participant_read ON public.delivery_charges;
CREATE POLICY delivery_charges_participant_read ON public.delivery_charges FOR SELECT USING (EXISTS (SELECT 1 FROM public.product_orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR public.owns_water_supplier(o.provider_id))));
DROP POLICY IF EXISTS product_reviews_read ON public.water_product_reviews;
CREATE POLICY product_reviews_read ON public.water_product_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS product_reviews_customer_create ON public.water_product_reviews;
CREATE POLICY product_reviews_customer_create ON public.water_product_reviews FOR INSERT WITH CHECK (customer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.product_order_items i JOIN public.product_orders o ON o.id = i.order_id WHERE i.id = order_item_id AND o.customer_id = auth.uid() AND o.status = 'delivered'));

INSERT INTO storage.buckets (id, name, public) VALUES ('water-product-images', 'water-product-images', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS water_product_images_public_read ON storage.objects;
CREATE POLICY water_product_images_public_read ON storage.objects FOR SELECT USING (bucket_id = 'water-product-images');
DROP POLICY IF EXISTS water_product_images_owner_write ON storage.objects;
CREATE POLICY water_product_images_owner_write ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'water-product-images' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'water-product-images' AND auth.uid()::text = (storage.foldername(name))[1]);


-- Atomic customer checkout. Product prices, ownership, stock, and delivery charge are
-- always re-read in the database; the browser never decides final amounts.
CREATE OR REPLACE FUNCTION public.create_water_product_order(
  p_provider_id uuid,
  p_items jsonb,
  p_delivery_address text,
  p_delivery_lat numeric,
  p_delivery_lng numeric,
  p_delivery_date date,
  p_delivery_time_slot text DEFAULT NULL,
  p_special_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quote record;
  order_id uuid;
  item jsonb;
  variant record;
  line_total numeric;
  subtotal_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO quote FROM public.quote_water_delivery(p_provider_id, p_delivery_lat, p_delivery_lng);
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name, s.quantity_available
      INTO variant
      FROM public.water_product_variants v
      JOIN public.water_products p ON p.id = v.product_id
      JOIN public.water_product_stock s ON s.variant_id = v.id
     WHERE v.id = (item->>'variantId')::uuid
       AND p.id = (item->>'productId')::uuid
       AND p.provider_id = p_provider_id
       AND p.is_active AND p.is_visible AND NOT p.is_archived AND v.is_available
     FOR UPDATE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected product is no longer available'; END IF;
    IF (item->>'quantity')::integer <= 0 OR variant.quantity_available < (item->>'quantity')::integer THEN RAISE EXCEPTION 'Insufficient stock for %', variant.label; END IF;
    line_total := variant.price * (item->>'quantity')::integer;
    subtotal_total := subtotal_total + line_total;
  END LOOP;
  INSERT INTO public.product_orders (provider_id, customer_id, delivery_address, delivery_lat, delivery_lng, delivery_date, delivery_time_slot, special_instructions, estimated_delivery_minutes, distance_km, subtotal, delivery_charge, total_amount)
  VALUES (p_provider_id, auth.uid(), p_delivery_address, p_delivery_lat, p_delivery_lng, p_delivery_date, p_delivery_time_slot, nullif(trim(p_special_instructions), ''), quote.estimated_delivery_minutes, quote.distance_km, subtotal_total, quote.delivery_charge, subtotal_total + quote.delivery_charge)
  RETURNING id INTO order_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name INTO variant FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id WHERE v.id = (item->>'variantId')::uuid;
    line_total := variant.price * (item->>'quantity')::integer;
    INSERT INTO public.product_order_items (order_id, product_id, variant_id, product_name, variant_label, unit_price, quantity, line_total) VALUES (order_id, variant.product_id, variant.id, variant.name, variant.label, variant.price, (item->>'quantity')::integer, line_total);
    UPDATE public.water_product_stock SET quantity_available = quantity_available - (item->>'quantity')::integer WHERE variant_id = variant.id;
  END LOOP;
  INSERT INTO public.delivery_charges (order_id, free_radius_km, distance_km, charge, is_free_delivery) SELECT order_id, free_delivery_radius_km, quote.distance_km, quote.delivery_charge, quote.is_free_delivery FROM public.supplier_delivery_settings WHERE provider_id = p_provider_id;
  RETURN order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_water_product_order(uuid, jsonb, text, numeric, numeric, date, text, text) TO authenticated;


-- Customer-safe availability only; stock counts remain supplier-private.
CREATE OR REPLACE FUNCTION public.get_water_variant_availability(p_provider_id uuid)
RETURNS TABLE(variant_id uuid, is_in_stock boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, s.quantity_available > 0
  FROM public.water_product_variants v
  JOIN public.water_products p ON p.id = v.product_id
  JOIN public.water_product_stock s ON s.variant_id = v.id
  WHERE p.provider_id = p_provider_id
    AND p.is_active AND p.is_visible AND NOT p.is_archived
    AND v.is_available;
$$;
GRANT EXECUTE ON FUNCTION public.get_water_variant_availability(uuid) TO anon, authenticated;
