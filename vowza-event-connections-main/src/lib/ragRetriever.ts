// ─── RAG Retriever ─────────────────────────────────────────────────────────────
// Retrieves real vendor data from Supabase before every AI response.
// Two-mode operation:
//   1. Vector search  — when vendor_embeddings exist + OpenAI embedding API available
//   2. SQL search     — always works, zero extra cost, uses filters + ranking
//
// The retriever is called BEFORE the LLM receives the user message.
// Retrieved vendor data is injected into the system prompt as grounding context.

import { supabase } from '@/integrations/supabase/client';
import type { DBVendor, MarketplaceCategory, PlannerContext } from './aiPlannerTypes';
import { dedupeVerifiedDBVendors, normalizeVendorSearchMessage, toVerifiedDBVendor, uniqueProviderIds } from './vendorTrust';
import {
  extractPlannerSearchCriteria,
  rankMarketplaceVendors,
  type MarketplaceAvailabilityStatus,
} from './plannerRecommendation';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface RetrievedVendor {
  provider_id:    string;
  profession:     string;
  stage_name?:    string;
  full_name?:     string;
  bio?:           string;
  city?:          string;
  price_min?:     number;
  price_max?:     number;
  average_rating: number;
  total_reviews:  number;
  total_bookings: number;
  is_verified:    boolean;
  is_available:   boolean;
  experience_years?: number | null;
  cover_image_url?:  string | null;
  similarity?:    number;   // set if vector search was used
  avatar_url?:    string;
  availability_status?: MarketplaceAvailabilityStatus;
  availability_reason?: string;
  recommendation_reasons?: string[];
  match_score?: number;
  packages?:      RetrievedPackage[];
  menu_items?:    RetrievedMenuItem[];
  faqs?:          RetrievedFaq[];
}

export interface RetrievedPackage {
  name:        string;
  price:       number;
  description?: string;
  duration?:   string;
  features?:   string[];
}

export interface RetrievedMenuItem {
  dish_name:      string;
  category?:      string;
  price_per_plate: number;
  description?:   string;
}

export interface RetrievedFaq {
  question: string;
  answer:   string;
}

export interface RAGResult {
  vendors:       RetrievedVendor[];
  totalFound:    number;
  searchMode:    'vector' | 'sql' | 'none';
  searchStatus:  'ok' | 'no_results' | 'not_requested' | 'technical_error';
  queryUsed:     string;
  retrievedAt:   string;
}

// ── Intent → profession_type mapping ─────────────────────────────────────────
const INTENT_MAP: Record<string, string> = {
  photographer:       'photographer',
  photography:        'photographer',
  photo:              'photographer',
  videographer:       'videographer',
  video:              'videographer',
  drone:              'drone_operator',
  dj:                 'dj',
  band:               'music_band',
  bands:              'music_band',
  singer:             'singer',
  singers:            'singer',
  dancer:             'dancer',
  dancers:            'dancer',
  choreographer:      'choreographer',
  decorator:          'wedding_decorator',
  decorators:         'wedding_decorator',
  decoration:         'wedding_decorator',
  decor:              'wedding_decorator',
  'event decorator':  'event_decorator',
  'stage decorator':  'stage_decorator',
  'wedding decorator':'wedding_decorator',
  makeup:             'makeup_artist',
  mehendi:            'mehendi_artist',
  henna:              'mehendi_artist',
  magician:           'magician',
  anchor:             'anchor',
  host:               'anchor',
  emcee:              'anchor',
  caterer:            'catering_services',
  catering:           'catering_services',
  food:               'catering_services',
  banquet:            'banquet_hall',
  hall:               'banquet_hall',
  venue:              'banquet_hall',
  pandit:             'pandit',
  priest:             'pandit',
  pooja:              'pandit',
  rental:             'rentals',
  tent:               'rentals',
  water:              'water_supplier',
  lighting:           'lighting_services',
  sound:              'sound_services',
  audio:              'sound_services',
};

interface MarketplaceCategoryRow {
  id: string;
  name: string;
  profession_type: string;
  description: string | null;
  icon: string | null;
}

const normalizeCategoryTerm = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .replace(/(?:ographers?|ography)/g, 'photograph')
  .replace(/(?:ators?|ation)/g, 'decor')
  .replace(/(?:ers?|ing|ies|s)$/g, '');

/**
 * Returns the display-safe, active Vowza taxonomy in administrator-defined
 * order. No category is inferred from legacy keyword maps.
 */
export async function retrieveActiveMarketplaceCategories(): Promise<MarketplaceCategory[]> {
  const { data, error } = await supabase
    .from('artist_categories')
    .select('id, name, profession_type, description, icon, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`Active marketplace category query failed: ${error.message}`);

  return ((data ?? []) as MarketplaceCategoryRow[])
    .filter((category) => Boolean(category.id && category.name && category.profession_type))
    .map((category) => ({
      id: category.id,
      name: category.name,
      profession_type: category.profession_type,
      description: category.description,
      icon: category.icon,
    }));
}

/**
 * Resolves category filters from active Vowza category rows. The small legacy
 * map above remains only as a fallback for older deployments or synonym forms;
 * the marketplace itself determines which profession values are queryable.
 */
async function resolveMarketplaceProfessions(message: string, fallback: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('artist_categories')
    .select('name, profession_type')
    .eq('is_active', true);

  if (error || !data?.length) return [...new Set(fallback)];

  const messageTerms = normalizeVendorSearchMessage(message)
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeCategoryTerm)
    .filter((term) => term.length >= 4);
  const resolved = (data as MarketplaceCategoryRow[])
    .filter((category) => {
      const categoryTerms = `${category.name} ${category.profession_type.replace(/_/g, ' ')}`
        .split(/[^a-zA-Z0-9]+/)
        .map(normalizeCategoryTerm)
        .filter((term) => term.length >= 4);
      return messageTerms.some((requested) => categoryTerms.some((available) =>
        requested === available || requested.startsWith(available) || available.startsWith(requested)
      ));
    })
    .map((category) => category.profession_type);

  return [...new Set([...resolved, ...fallback])];
}

// ── Parse intent from user message ─────────────────────────────────────────────
export function extractVendorIntent(message: string, ctx: PlannerContext): {
  professions: string[];
  city?: string;
  priceMax?: number;
  minRating?: number;
  guestCount?: number;
} {
  const l = normalizeVendorSearchMessage(message).toLowerCase();
  const professions: string[] = [];

  // Detect profession mentions
  for (const [kw, prof] of Object.entries(INTENT_MAP)) {
    if (l.includes(kw) && !professions.includes(prof)) {
      professions.push(prof);
    }
  }

  // Extract city from message or context
  const cityMatch = message.match(/\bin\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
  const city = cityMatch?.[1] || ctx.city;

  // Extract price from message or context
  const budgetPatterns = [
    { re: /under\s+₹?\s*(\d+(?:\.\d+)?)\s*lakh/i,   mul: 100000 },
    { re: /below\s+₹?\s*(\d+(?:\.\d+)?)\s*lakh/i,   mul: 100000 },
    { re: /₹?\s*(\d+(?:\.\d+)?)\s*lakh/i,            mul: 100000 },
    { re: /under\s+₹?\s*(\d+(?:\.\d+)?)\s*k\b/i,    mul: 1000   },
    { re: /₹\s*(\d[\d,]+)/i,                          mul: 1      },
  ];
  let priceMax: number | undefined;
  for (const { re, mul } of budgetPatterns) {
    const m = l.match(re);
    if (m) { priceMax = parseFloat(m[1].replace(/,/g, '')) * mul; break; }
  }
  if (!priceMax && ctx.budget) priceMax = ctx.budget;

  // Minimum rating threshold
  const minRating = /highly.rated|top.rated|best|5.star|4.star/i.test(l) ? 4.0 : 0;

  return { professions, city, priceMax, minRating, guestCount: ctx.guestCount };
}

// ── Format price for display ───────────────────────────────────────────────────
function fmtPrice(n?: number): string {
  if (!n || n <= 0) return 'On Request';
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(0)}K`;
  return `₹${n}`;
}

// ── SQL-based vendor retrieval (always available) ─────────────────────────────
async function sqlSearch(
  profession?: string,
  city?: string,
  priceMax?: number,
  minRating = 0,
  limit = 8
): Promise<RetrievedVendor[]> {
  // First try RPC
  const { data, error } = await supabase.rpc('search_vendors_sql' as any, {
    p_profession: profession ?? null,
    p_city:       city ?? null,
    p_price_max:  priceMax ?? null,
    p_min_rating: minRating,
    p_limit:      limit,
  });

  // If RPC works, use it
  if (!error && data && data.length > 0) {
    return ((data as any[]) ?? []).map((v: any): RetrievedVendor => ({
      provider_id:    v.provider_id,
      profession:     v.profession,
      stage_name:     v.stage_name,
      full_name:      v.full_name,
      bio:            v.bio,
      city:           v.city,
      price_min:      v.price_min,
      price_max:      v.price_max,
      average_rating: v.average_rating ?? 0,
      total_reviews:  v.total_reviews  ?? 0,
      total_bookings: v.total_bookings ?? 0,
      is_verified:    v.is_verified    ?? false,
      is_available:   v.is_available   ?? true,
      experience_years: v.experience_years ?? null,
      cover_image_url:  v.cover_image_url  ?? null,
      avatar_url:     v.avatar_url,
    }));
  }

  // FALLBACK: Direct table query if RPC fails or returns empty
  console.warn('[RAG] RPC search_vendors_sql returned empty or failed, using direct query:', error?.message);
  
  let q = supabase
    .from('provider_profiles')
    .select('id, profession, stage_name, bio, price_min, price_max, average_rating, total_reviews, total_bookings, is_verified, is_available, experience_years, cover_image_url, user_id')
    .eq('is_published', true)
    .eq('is_verified', true)
    .order('average_rating', { ascending: false })
    .limit(limit);

  // CRITICAL: Do NOT require verification_status check here—just query published+verified
  if (profession) {
    q = q.ilike('profession', `%${profession}%`); // case-insensitive partial match
  }
  if (priceMax)   q = q.lte('price_min', priceMax);
  if (minRating)  q = q.gte('average_rating', minRating);

  const { data: fallback, error: fallbackError } = await q;
  
  if (fallbackError) {
    console.error('[RAG] Direct fallback query failed:', fallbackError.message);
    throw new Error(`Vendor fallback query failed: ${fallbackError.message}`);
  }
  
  if (!fallback || fallback.length === 0) {
    console.log('[RAG] No vendors found via direct query');
    return [];
  }

  // Fetch user profiles for city and name
  const userIds = fallback.map((v: any) => v.user_id).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, city, avatar_url')
    .in('id', userIds);

  if (profileError) {
    console.error('[RAG] Failed to fetch user profiles:', profileError.message);
    return [];
  }

  const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Filter by city if specified (case-insensitive)
  return fallback
    .filter((v: any) => {
      if (!city) return true;
      const vendorCity = pm.get(v.user_id)?.city ?? '';
      return vendorCity.toLowerCase().includes(city.toLowerCase());
    })
    .map((v: any): RetrievedVendor => {
      const p = pm.get(v.user_id) ?? {};
      return {
        provider_id:    v.id,
        profession:     v.profession,
        stage_name:     v.stage_name,
        full_name:      (p as any).full_name || v.stage_name,
        bio:            v.bio,
        city:           (p as any).city,
        price_min:      v.price_min,
        price_max:      v.price_max,
        average_rating: v.average_rating ?? 0,
        total_reviews:  v.total_reviews  ?? 0,
        total_bookings: v.total_bookings ?? 0,
        is_verified:    v.is_verified    ?? false,
        is_available:   v.is_available   ?? true,
        experience_years: v.experience_years ?? null,
        cover_image_url:  v.cover_image_url  ?? null,
        avatar_url:     (p as any).avatar_url,
      };
    });
}

function canonicalizeRetrievedVendors(vendors: RetrievedVendor[]): RetrievedVendor[] {
  const trusted = dedupeVerifiedDBVendors(vendors);
  const sourceById = new Map(vendors.map((vendor) => [vendor.provider_id, vendor]));
  return trusted.map((vendor) => ({
    ...sourceById.get(vendor.provider_id),
    ...vendor,
  }));
}

/**
 * RPC output remains untrusted until it is checked against the live public
 * profile rules. This keeps unpublished providers out even before an older
 * deployed `search_vendors_sql` function is upgraded by its migration.
 */
async function retainPublishedVerifiedVendors(vendors: RetrievedVendor[]): Promise<RetrievedVendor[]> {
  const ids = vendors.map((vendor) => vendor.provider_id).filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('provider_profiles')
    .select('id')
    .in('id', ids)
    .in('verification_status', ['approved', 'verified'])
    .eq('is_verified', true)
    .eq('is_published', true);
  if (error) throw new Error(`Planner vendor eligibility validation failed: ${error.message}`);

  const allowedIds = new Set((data ?? []).map((provider) => provider.id));
  return vendors.filter((vendor) => allowedIds.has(vendor.provider_id));
}

interface RevalidatedProviderRow {
  id: string;
  user_id: string | null;
  profession: string;
  stage_name: string | null;
  bio: string | null;
  price_min: number | null;
  price_max: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  total_bookings: number | null;
  is_available: boolean | null;
  experience_years: number | null;
  cover_image_url: string | null;
}

interface RevalidatedProfileRow {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
}

/**
 * Saved AI responses are user-owned JSONB, so their vendor snapshots are never
 * trusted on replay. Re-fetch the requested UUIDs from the live marketplace and
 * fail closed (no cards) if RLS, a revoked profile, or a query error prevents
 * verification.
 */
export async function rehydrateVerifiedDBVendors(values: readonly unknown[]): Promise<DBVendor[]> {
  const ids = uniqueProviderIds(values);
  if (!ids.length) return [];

  const { data: providers, error } = await supabase
    .from('provider_profiles')
    .select('id, user_id, profession, stage_name, bio, price_min, price_max, average_rating, total_reviews, total_bookings, is_verified, is_available, experience_years, cover_image_url')
    .in('id', ids)
    .in('verification_status', ['approved', 'verified'])
    .eq('is_verified', true)
    .eq('is_published', true);

  if (error || !providers?.length) {
    if (error) console.warn('[RAG] saved vendor revalidation failed:', error.message);
    return [];
  }

  const providerRows = providers as unknown as RevalidatedProviderRow[];
  const userIds = providerRows.map((provider) => provider.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, city, avatar_url').in('id', userIds)
    : { data: [], error: null };
  if (profilesError) {
    console.warn('[RAG] saved vendor profile revalidation failed:', profilesError.message);
    return [];
  }

  const profileRows = (profiles ?? []) as unknown as RevalidatedProfileRow[];
  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const rowsById = new Map(providerRows.map((provider) => {
    const profile = profilesById.get(provider.user_id);
    return [provider.id, {
      provider_id: provider.id,
      profession: provider.profession,
      stage_name: provider.stage_name,
      full_name: profile?.full_name,
      bio: provider.bio,
      city: profile?.city,
      price_min: provider.price_min,
      price_max: provider.price_max,
      average_rating: provider.average_rating ?? 0,
      total_reviews: provider.total_reviews ?? 0,
      total_bookings: provider.total_bookings ?? 0,
      is_verified: true,
      is_available: provider.is_available ?? true,
      experience_years: provider.experience_years ?? null,
      cover_image_url: provider.cover_image_url ?? null,
      avatar_url: profile?.avatar_url,
      availability_status: 'not_checked',
    }];
  }));

  // Preserve the original ranked order, but only for providers that still pass
  // the current database verification query.
  return dedupeVerifiedDBVendors(ids.map((id) => rowsById.get(id)));
}

// ── Enrich vendors with packages, menu items, and FAQs ────────────────────────
async function enrichVendors(vendors: RetrievedVendor[]): Promise<RetrievedVendor[]> {
  if (!vendors.length) return vendors;
  const ids = vendors.map(v => v.provider_id);

  const [pkgRes, menuRes, faqRes] = await Promise.allSettled([
    supabase.from('pricing_packages' as any).select('provider_id, name, price, description, duration, features').in('provider_id', ids).eq('is_active', true).order('sort_order').limit(ids.length * 4),
    supabase.from('menu_items' as any).select('provider_id, dish_name, category, price_per_plate, description').in('provider_id', ids).eq('is_available', true).order('sort_order').limit(ids.length * 8),
    supabase.from('provider_faqs' as any).select('provider_id, question, answer').in('provider_id', ids).order('sort_order').limit(ids.length * 4),
  ]);

  const pkgMap   = new Map<string, RetrievedPackage[]>();
  const menuMap  = new Map<string, RetrievedMenuItem[]>();
  const faqMap   = new Map<string, RetrievedFaq[]>();

  if (pkgRes.status  === 'fulfilled' && pkgRes.value.data) {
    for (const p of pkgRes.value.data as any[]) {
      if (!pkgMap.has(p.provider_id)) pkgMap.set(p.provider_id, []);
      pkgMap.get(p.provider_id)!.push({ name: p.name, price: p.price, description: p.description, duration: p.duration, features: p.features ?? [] });
    }
  }
  if (menuRes.status === 'fulfilled' && menuRes.value.data) {
    for (const m of menuRes.value.data as any[]) {
      if (!menuMap.has(m.provider_id)) menuMap.set(m.provider_id, []);
      menuMap.get(m.provider_id)!.push({ dish_name: m.dish_name, category: m.category, price_per_plate: m.price_per_plate, description: m.description });
    }
  }
  if (faqRes.status  === 'fulfilled' && faqRes.value.data) {
    for (const f of faqRes.value.data as any[]) {
      if (!faqMap.has(f.provider_id)) faqMap.set(f.provider_id, []);
      faqMap.get(f.provider_id)!.push({ question: f.question, answer: f.answer });
    }
  }

  return vendors.map(v => ({
    ...v,
    packages:   pkgMap.get(v.provider_id)?.slice(0, 3),
    menu_items: menuMap.get(v.provider_id)?.slice(0, 6),
    faqs:       faqMap.get(v.provider_id)?.slice(0, 3),
  }));
}

/**
 * The planner only reports a date as unavailable when Vowza data proves it.
 * A free date is never called "available" here because category-specific
 * bookings are not yet normalized into one calendar; it needs confirmation.
 */
async function annotateAvailability(
  vendors: RetrievedVendor[],
  eventDate?: string,
): Promise<RetrievedVendor[]> {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return vendors.map((vendor) => ({
      ...vendor,
      availability_status: vendor.is_available ? 'not_checked' : 'unavailable',
      availability_reason: vendor.is_available ? undefined : 'Provider is currently marked unavailable',
    }));
  }

  const providerIds = vendors.map((vendor) => vendor.provider_id);
  const { data, error } = await supabase
    .from('provider_availability')
    .select('provider_id, reason, slot_type')
    .in('provider_id', providerIds)
    .eq('unavailable_date', eventDate)
    .eq('slot_type', 'unavailable');

  // RLS, missing availability data, or a query error must not become a false
  // availability promise. The UI explicitly labels these as needing confirmation.
  if (error) {
    return vendors.map((vendor) => ({
      ...vendor,
      availability_status: vendor.is_available ? 'needs_confirmation' : 'unavailable',
      availability_reason: vendor.is_available ? undefined : 'Provider is currently marked unavailable',
    }));
  }

  const blockedByProvider = new Map((data ?? []).map((row: any) => [row.provider_id, row.reason]));
  return vendors.map((vendor) => {
    const blockedReason = blockedByProvider.get(vendor.provider_id);
    if (!vendor.is_available || blockedReason !== undefined) {
      return {
        ...vendor,
        availability_status: 'unavailable' as const,
        availability_reason: blockedReason || 'Provider is currently marked unavailable',
      };
    }
    return { ...vendor, availability_status: 'needs_confirmation' as const };
  });
}

// ── Main retriever ─────────────────────────────────────────────────────────────
export async function retrieveVendors(
  message: string,
  ctx: PlannerContext,
  maxVendors = 8,
  hints?: { professions?: string[]; city?: string | null; priceMax?: number | null; minRating?: number }
): Promise<RAGResult> {
  const normalizedMessage = normalizeVendorSearchMessage(message);
  const intent = extractVendorIntent(normalizedMessage, ctx);
  const fallbackProfessions = [
    ...(hints?.professions ?? []),
    ...intent.professions,
  ];
  const resolvedProfessions = await resolveMarketplaceProfessions(normalizedMessage, fallbackProfessions);
  const criteria = extractPlannerSearchCriteria(normalizedMessage, ctx, {
    professions: resolvedProfessions,
    city: hints?.city ?? intent.city,
    serviceBudget: hints?.priceMax ?? intent.priceMax,
    minimumRating: hints?.minRating ?? intent.minRating,
  });
  const professions = criteria.professions;
  const city = criteria.city;
  const priceMax = criteria.serviceBudget;
  const minRating = criteria.minimumRating ?? 0;

  // Expand generic decorator to all decorator subtypes
  const DECORATOR_EXPANSION: Record<string, string[]> = {
    wedding_decorator: ['wedding_decorator', 'event_decorator', 'stage_decorator'],
  };
  const expandedProfessions = professions.flatMap(p => DECORATOR_EXPANSION[p] ?? [p]);
  const uniqueProfessions = [...new Set(expandedProfessions)];

  if (!uniqueProfessions.length && !city && !priceMax) {
    return { vendors: [], totalFound: 0, searchMode: 'none', searchStatus: 'not_requested', queryUsed: normalizedMessage, retrievedAt: new Date().toISOString() };
  }

  try {
    let allVendors: RetrievedVendor[] = [];

    if (uniqueProfessions.length > 0) {
      const results = await Promise.all(
        uniqueProfessions.slice(0, 5).map((profession) =>
          sqlSearch(profession, city, priceMax, minRating, Math.ceil(maxVendors / Math.max(uniqueProfessions.length, 1)))
        )
      );
      allVendors = results.flat();
    } else {
      allVendors = await sqlSearch(undefined, city, priceMax, minRating, maxVendors);
    }

    const verifiedUnique = canonicalizeRetrievedVendors(await retainPublishedVerifiedVendors(allVendors));
    const enriched = await enrichVendors(verifiedUnique.slice(0, maxVendors * 2));
    const withAvailability = await annotateAvailability(enriched, criteria.eventDate);
    const ranked = rankMarketplaceVendors(withAvailability, criteria)
      .filter((vendor) => vendor.availability_status !== 'unavailable')
      .slice(0, maxVendors);

    return {
      vendors: ranked,
      totalFound: verifiedUnique.length,
      searchMode: 'sql',
      searchStatus: verifiedUnique.length ? 'ok' : 'no_results',
      queryUsed: normalizedMessage,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[RAG] retrieval error:', err);
    return { vendors: [], totalFound: 0, searchMode: 'none', searchStatus: 'technical_error', queryUsed: normalizedMessage, retrievedAt: new Date().toISOString() };
  }
}

// ── Exact required empty-state copy (verbatim — never alter) ─────────────────
export const NO_VENDORS_FOUND_MESSAGE =
`We couldn't find any verified vendors matching your requirements yet.

Our marketplace is growing, and we're continuously onboarding trusted professionals.

Meanwhile, I can still help you with:

• Budget estimation
• Event planning
• Vendor requirement guidance
• Cost breakdowns
• Event timelines
• Checklists
• Planning tips`;

// ── Build grounding context string for LLM ────────────────────────────────────
export function buildRAGContext(result: RAGResult): string {
  if (!result.vendors.length) return '';

  const lines: string[] = [
    `\n\n---\n## 📊 LIVE VOWZA DATABASE — Retrieved ${result.vendors.length} verified vendors\n`,
    `_Search mode: ${result.searchMode} | Retrieved: ${new Date(result.retrievedAt).toLocaleTimeString()}_\n`,
  ];

  for (const v of result.vendors) {
    const name    = v.stage_name || v.full_name || 'Vendor';
    const prof    = v.profession.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const price   = v.price_min ? fmtPrice(v.price_min) : 'Contact for quotation';
    const rating  = v.average_rating > 0 ? `${v.average_rating.toFixed(1)}⭐ (${v.total_reviews} reviews)` : 'New Vendor';
    const exp     = v.experience_years != null ? `${v.experience_years} yrs experience` : 'Experience not provided';
    const events  = v.total_bookings > 0 ? `${v.total_bookings} events done` : '';
    const availability = v.availability_status === 'unavailable'
      ? '🔴 Unavailable for requested date'
      : v.availability_status === 'needs_confirmation'
        ? '🟡 Availability needs confirmation'
        : '⚪ Availability not checked';
    const badges  = [v.is_verified ? '✅ Verified' : '', availability].filter(Boolean).join(' ');
    const reasons = v.recommendation_reasons?.length
      ? `- **Why recommended:** ${v.recommendation_reasons.join(' · ')}`
      : '';
    const link = `/artist/${v.provider_id}`;

    lines.push(`\n### ${name} — ${prof} (${v.city ?? 'India'})`);
    lines.push(`- **Price:** ${price}  |  **Rating:** ${rating}  |  **Experience:** ${exp}  ${events ? `| ${events}` : ''}`);
    lines.push(`- ${badges}  |  **Profile:** ${link}`);
    if (reasons) lines.push(reasons);
    if (v.bio) lines.push(`- ${v.bio.slice(0, 120)}…`);

    if (v.packages?.length) {
      lines.push('- **Packages:**');
      for (const pkg of v.packages.slice(0, 3)) {
        lines.push(`  - ${pkg.name}: ${fmtPrice(pkg.price)}${pkg.duration ? ` (${pkg.duration})` : ''}`);
      }
    }
    if (v.menu_items?.length) {
      lines.push('- **Menu highlights:**');
      for (const item of v.menu_items.slice(0, 4)) {
        lines.push(`  - ${item.dish_name}: ${fmtPrice(item.price_per_plate)}/plate`);
      }
    }
  }

  lines.push('\n---\n**IMPORTANT:** Use ONLY these real vendors when recommending. Never display contact details until a booking is confirmed. Always include profile links. Never invent vendor names, ratings, prices, or experience.\n');
  return lines.join('\n');
}
