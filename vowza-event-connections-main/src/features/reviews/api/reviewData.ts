// ─── Reviews feature API ─────────────────────────────────────────────────────
// Single Supabase boundary for reviews-table operations (Phase 2D-B).
//
// Behavior is preserved VERBATIM from the pre-migration implementations in:
// - src/features/reviews/hooks/useReviews.ts (customer "My Reviews" read)
// - src/pages/ProviderProfile.tsx (public 15-review read + submitReview insert)
// - src/pages/ProviderDashboard.tsx (recent 10-review read)
// - src/hooks/useVendorData.ts (KPI rating read + useVendorReviews aggregation)
// - src/features/reviews/pages/VendorReviews.tsx (vendor reply update)
// - src/pages/admin/AdminReviews.tsx (paginated read + delete)
//
// Error semantics are intentionally NOT normalized: queries that previously
// returned unchecked { error } objects still do; silent DB-error behavior is
// preserved exactly. Do NOT "fix" error handling here.

import { supabase } from '@/integrations/supabase/client';

/** Customer "My Reviews" raw read (joins remain in the hook). Throws surface via {error}. */
export async function getMyReviews(userId: string) {
  return await supabase
    .from('reviews')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
}

/** Public provider reviews (limit 15) with customer names joined — ProviderProfile shape. */
export async function getProviderReviewsWithCustomerNames(providerId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id,rating,review_text,created_at,customer_id")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error || !data) return { data: null };

  const ids = data.map((r: any) => r.customer_id);
  const { data: cust } = await supabase.from("profiles").select("id,full_name").in("id", ids);
  const cm = new Map((cust ?? []).map((c: any) => [c.id, c.full_name]));
  return {
    data: data.map((r: any) => ({ ...r, customer_name: cm.get(r.customer_id) || "Anonymous" })),
  };
}

/** Review submit INSERT (ProviderProfile). Returns {error} with .code for 23505 handling. */
export async function submitReview(input: {
  bookingId: string;
  customerId: string;
  providerId: string;
  rating: number;
  reviewText: string | null;
}) {
  return await supabase
    .from("reviews")
    .insert({
      booking_id: input.bookingId,
      customer_id: input.customerId,
      provider_id: input.providerId,
      rating: input.rating,
      review_text: input.reviewText,
    });
}

/** Provider dashboard recent reviews (limit 10). Profile-name join remains in the page. */
export async function getProviderDashboardReviews(providerId: string) {
  return await supabase
    .from('reviews')
    .select('id, rating, review_text, created_at, customer_id')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(10);
}

/** KPI rating read (useVendorData). Returns the raw result for Promise.all destructure. */
export async function getProviderReviewRatings(providerId: string) {
  return await supabase
    .from('reviews' as any)
    .select('id, rating')
    .eq('provider_id', providerId);
}

/** Vendor reviews + rating breakdown with customer join (useVendorReviews body). */
export async function getVendorReviewsWithCustomers(vendorId: string) {
  const empty = { reviews: [] as any[], average: 0, total: 0, breakdown: [5,4,3,2,1].map(s => ({ stars: s, count: 0, percent: 0 })) };

  const { data } = await supabase.from('reviews' as any)
    .select('*')
    .eq('provider_id', vendorId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as any[];
  if (rows.length === 0) return empty;

  // Join customer names
  const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))];
  const map = new Map<string, any>();
  if (custIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', custIds);
    (profiles ?? []).forEach((p: any) => map.set(p.id, p));
  }

  const reviews = rows.map(r => ({ ...r, customer: map.get(r.customer_id) ?? null }));
  const total = reviews.length;
  const average = Math.round((reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / total) * 10) / 10;
  const breakdown = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => Number(r.rating) === stars).length;
    // pct() semantics preserved verbatim from useVendorData.ts L71-74
    const percent = total ? Math.round((count / total) * 1000) / 10 : 0;
    return { stars, count, percent };
  });

  return { reviews, average, total, breakdown };
}

/** Vendor reply UPDATE (VendorReviews). Returns {error} for existing toast semantics. */
export async function updateVendorReply(reviewId: string, reply: string) {
  return await supabase
    .from('reviews' as any)
    .update({ reply, replied_at: new Date().toISOString() })
    .eq('id', reviewId);
}

/** Admin paginated read with exact count (AdminReviews). */
export async function getAdminReviewsPage(page: number, pageSize: number) {
  return await supabase.from('reviews').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
}

/** Admin DELETE (AdminReviews). Result discarded exactly as before (silent). */
export async function deleteReview(id: string) {
  await supabase.from('reviews').delete().eq('id', id);
}
