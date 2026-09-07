/**
 * Explicit column allowlists for anonymous (not-logged-in) reads.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `provider_profiles` has 69 columns and `profiles` has 27, and until
 * migration 20261201000006 the `anon` role held `GRANT ALL` on both. Anyone
 * could read every column of every row using only the `sb_publishable_` key,
 * which is public by design and ships inside this bundle. That exposed all six
 * `bank_*` columns for every vendor, the `aadhaar_*` / `pan_*` / `govt_id_*`
 * verification fields, and on `profiles` the `phone`, `email`, `address` and
 * `date_of_birth` of every registered user.
 *
 * That cannot be fixed with an RLS policy. RLS has no column dimension, and
 * restricting rows does not help: the vendors whose bank details leaked are
 * precisely the approved ones who must stay publicly listed. The only fix is a
 * column-level GRANT, and a column-level GRANT is incompatible with
 * `select('*')` -- `SELECT *` requires the SELECT privilege on every column of
 * the table, so it starts returning 42501 the moment any column is withheld.
 *
 * Hence: the three anonymous-reachable queries name their columns, and the
 * names live here so there is exactly one list to keep in step with the
 * database grant.
 *
 * KEEPING THIS IN SYNC
 * --------------------
 * These two arrays mirror the GRANT statements in
 * `supabase/migrations/20261201000006_restrict_anon_column_access.sql`.
 * Adding a column here without also granting it there produces a 42501 and a
 * blank page for anonymous visitors. Granting a column there without adding it
 * here is harmless.
 *
 * DO NOT add any of these 23 `provider_profiles` columns -- they are withheld
 * from `anon` deliberately:
 *   aadhaar_status, aadhaar_verified_at, bank_account_holder,
 *   bank_account_number, bank_ifsc, bank_name, branch_name,
 *   doc_verification_notes, govt_id_status, govt_id_verified_at, gst_number,
 *   is_bank_verified, liveness_attempts, liveness_provider,
 *   liveness_session_id, liveness_verified, liveness_verified_at,
 *   onboarding_completed, pan_status, pan_verified_at, rejection_reason,
 *   verified_at, verified_by
 *
 * Authenticated vendor pages that legitimately need those columns for their
 * OWN row (`useVendorData.ts`, `VendorWallet.tsx`, `VendorEditProfile.tsx`,
 * `ProviderDashboard.tsx`) are unaffected: the revoke is scoped to the `anon`
 * role only and does not touch `authenticated`.
 *
 * A NOTE ON COLUMNS THAT DO NOT EXIST
 * -----------------------------------
 * Several components read provider fields that are not columns of
 * `provider_profiles` at all -- `city`, `service_city`, `service_state`,
 * `service_area`, `business_name`, `contact_person`. Under `select('*')` those
 * silently arrived as `undefined` and fell through to a value from `profiles`
 * or to a literal. They are deliberately absent below, because naming a
 * non-existent column in an explicit select is a hard 42703 error rather than
 * a silent `undefined`. Do not "fix" their absence by adding them here.
 */

/**
 * The 46 `provider_profiles` columns readable by `anon`.
 * Includes columns used only in `.eq()` / `.in()` / `.order()` clauses --
 * PostgREST still requires the SELECT privilege to filter or sort on them.
 * Includes `service_areas`, which no component renders but
 * `public.search_vendors_sql` reads; that function is SECURITY INVOKER and
 * granted to `anon`, so it runs under the caller's column privileges.
 */
export const PUBLIC_PROVIDER_COLUMNS = [
  'average_rating',
  'available_dates',
  'available_days',
  'band_category',
  'bio',
  'business_hours',
  'category_details',
  'cover_banner_url',
  'cover_image_url',
  'created_at',
  'experience_years',
  'extra_charges',
  'facebook',
  'faqs',
  'featured_until',
  'gallery_urls',
  'id',
  'instagram',
  'instant_booking',
  'is_available',
  'is_featured',
  'is_published',
  'is_verified',
  'languages',
  'performance_type',
  'price_max',
  'price_min',
  'pricing_type',
  'profession',
  'service_areas',
  'service_radius',
  'social_links',
  'specialties',
  'stage_name',
  'subcategory',
  'total_bookings',
  'total_reviews',
  'travel_charges',
  'updated_at',
  'user_id',
  'vendor_details',
  'verification_status',
  'video_urls',
  'website',
  'whatsapp',
  'youtube',
] as const;

/**
 * The 7 `profiles` columns readable by `anon`.
 *
 * `phone` and `email` are NOT here. They were previously selected by
 * `ProviderProfile.tsx` and handed to every anonymous visitor, but that file
 * never rendered either one -- the select was the only occurrence of either
 * identifier in it. Vendor contact details belong behind authentication in a
 * marketplace regardless; if a "show phone to logged-in users" feature is ever
 * wanted, add a separate authenticated query rather than widening this list.
 */
export const PUBLIC_PROFILE_COLUMNS = [
  'area',
  'avatar_url',
  'city',
  'district',
  'full_name',
  'id',
  'state',
] as const;

/** Comma-separated form for `.select()`. */
export const PUBLIC_PROVIDER_SELECT = PUBLIC_PROVIDER_COLUMNS.join(',');

/** Comma-separated form for `.select()`. */
export const PUBLIC_PROFILE_SELECT = PUBLIC_PROFILE_COLUMNS.join(',');
