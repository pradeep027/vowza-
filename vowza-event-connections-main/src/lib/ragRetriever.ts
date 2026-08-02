// ─── RAG Retriever ─────────────────────────────────────────────────────────────
// Retrieves real vendor data from Supabase before every AI response.
// Two-mode operation:
//   1. Vector search  — when vendor_embeddings exist + OpenAI embedding API available
//   2. SQL search     — always works, zero extra cost, uses filters + ranking
//
// The retriever is called BEFORE the LLM receives the user message.
// Retrieved vendor data is injected into the system prompt as grounding context.

import { supabase } from '@/integrations/supabase/client';
import type { PlannerContext } from './aiPlannerTypes';

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
  similarity?:    number;   // set if vector search was used
  avatar_url?:    string;
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
  decoration:         'wedding_decorator',
  decor:              'wedding_decorator',
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

// ── Parse intent from user message ─────────────────────────────────────────────
export function extractVendorIntent(message: string, ctx: PlannerContext): {
  professions: string[];
  city?: string;
  priceMax?: number;
  minRating?: number;
  guestCount?: number;
} {
  const l = message.toLowerCase();
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
  const { data, error } = await supabase.rpc('search_vendors_sql' as any, {
    p_profession: profession ?? null,
    p_city:       city ?? null,
    p_price_max:  priceMax ?? null,
    p_min_rating: minRating,
    p_limit:      limit,
  });

  if (error) {
    // Fallback: direct table query if RPC doesn't exist yet
    let q = supabase
      .from('provider_profiles')
      .select('id, profession, stage_name, bio, price_min, price_max, average_rating, total_reviews, total_bookings, is_verified, is_available, user_id')
      .in('verification_status', ['approved', 'verified'])
      .order('average_rating', { ascending: false })
      .limit(limit);

    if (profession) q = q.eq('profession', profession as any);
    if (priceMax)   q = q.lte('price_min', priceMax);
    if (minRating)  q = q.gte('average_rating', minRating);

    const { data: fallback } = await q;
    if (!fallback) return [];

    // Get profile data for city/name
    const userIds = fallback.map((v: any) => v.user_id).filter(Boolean);
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, city, avatar_url').in('id', userIds);
    const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return fallback
      .filter((v: any) => !city || pm.get(v.user_id)?.city?.toLowerCase().includes(city.toLowerCase()))
      .map((v: any): RetrievedVendor => {
        const p = pm.get(v.user_id) ?? {};
        return {
          provider_id:    v.id,
          profession:     v.profession,
          stage_name:     v.stage_name,
          full_name:      (p as any).full_name,
          bio:            v.bio,
          city:           (p as any).city,
          price_min:      v.price_min,
          price_max:      v.price_max,
          average_rating: v.average_rating ?? 0,
          total_reviews:  v.total_reviews  ?? 0,
          total_bookings: v.total_bookings ?? 0,
          is_verified:    v.is_verified    ?? false,
          is_available:   v.is_available   ?? true,
          avatar_url:     (p as any).avatar_url,
        };
      });
  }

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
    avatar_url:     v.avatar_url,
  }));
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

// ── Main retriever ─────────────────────────────────────────────────────────────
export async function retrieveVendors(
  message: string,
  ctx: PlannerContext,
  maxVendors = 8
): Promise<RAGResult> {
  const intent = extractVendorIntent(message, ctx);

  // Nothing to retrieve if no vendor intent detected and no context
  if (!intent.professions.length && !ctx.city && !ctx.budget) {
    return { vendors: [], totalFound: 0, searchMode: 'none', queryUsed: message, retrievedAt: new Date().toISOString() };
  }

  try {
    // If multiple professions detected, retrieve for each (capped at 3 each)
    let allVendors: RetrievedVendor[] = [];

    if (intent.professions.length > 0) {
      const results = await Promise.all(
        intent.professions.slice(0, 3).map(prof =>
          sqlSearch(prof, intent.city, intent.priceMax, intent.minRating, Math.ceil(maxVendors / intent.professions.length))
        )
      );
      allVendors = results.flat();
    } else {
      // No profession specified — general search by city/budget
      allVendors = await sqlSearch(undefined, intent.city, intent.priceMax, intent.minRating, maxVendors);
    }

    // Enrich top vendors with packages, menus, FAQs
    const enriched = await enrichVendors(allVendors.slice(0, maxVendors));

    return {
      vendors:     enriched,
      totalFound:  allVendors.length,
      searchMode:  'sql',
      queryUsed:   message,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[RAG] retrieval error:', err);
    return { vendors: [], totalFound: 0, searchMode: 'none', queryUsed: message, retrievedAt: new Date().toISOString() };
  }
}

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
    const price   = fmtPrice(v.price_min);
    const rating  = v.average_rating > 0 ? `${v.average_rating.toFixed(1)}⭐ (${v.total_reviews} reviews)` : 'New vendor';
    const events  = v.total_bookings > 0 ? `${v.total_bookings} events done` : '';
    const badges  = [v.is_verified ? '✅ Verified' : '', v.is_available ? '🟢 Available' : '🔴 Busy'].filter(Boolean).join(' ');
    const link    = `/artist/${v.provider_id}`;

    lines.push(`\n### ${name} — ${prof} (${v.city ?? 'India'})`);
    lines.push(`- **Price:** ${price}  |  **Rating:** ${rating}  ${events ? `| ${events}` : ''}`);
    lines.push(`- ${badges}  |  **Profile:** ${link}`);
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

  lines.push('\n---\n**IMPORTANT:** Use ONLY these real vendors when recommending. Always include profile links. Never invent vendor names or prices.\n');
  return lines.join('\n');
}
