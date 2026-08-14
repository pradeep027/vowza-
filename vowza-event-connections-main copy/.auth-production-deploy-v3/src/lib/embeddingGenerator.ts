// ─── Embedding Generator ─────────────────────────────────────────────────────
// Converts vendor profile text into vector embeddings and stores them in
// public.vendor_embeddings for pgvector semantic search.
//
// Usage (run once per vendor after approval, or in admin panel):
//   await generateAndStoreEmbedding(providerId);
//
// Requires: VITE_OPENAI_KEY or calls via Edge Function proxy.

import { supabase } from '@/integrations/supabase/client';

// ── Build plain text from a vendor profile (what gets embedded) ──────────────
export function buildVendorText(provider: any, profile: any): string {
  const parts: string[] = [];

  const name  = provider.stage_name || profile?.full_name || '';
  const city  = provider.service_city || profile?.city || '';
  const prof  = (provider.profession ?? '').replace(/_/g, ' ');

  if (name)  parts.push(`Name: ${name}`);
  if (prof)  parts.push(`Category: ${prof}`);
  if (city)  parts.push(`City: ${city}`);
  if (provider.bio) parts.push(`About: ${provider.bio.slice(0, 300)}`);

  if (Array.isArray(provider.specialties) && provider.specialties.length)
    parts.push(`Specialties: ${provider.specialties.join(', ')}`);

  if (Array.isArray(provider.languages) && provider.languages.length)
    parts.push(`Languages: ${provider.languages.join(', ')}`);

  if (provider.price_min) {
    const p = provider.price_min >= 100000
      ? `₹${(provider.price_min / 100000).toFixed(1)} lakh`
      : `₹${(provider.price_min / 1000).toFixed(0)}K`;
    parts.push(`Starting price: ${p}`);
  }

  if (provider.experience_years)
    parts.push(`Experience: ${provider.experience_years} years`);

  const details = provider.vendor_details || provider.category_details || {};
  for (const [k, v] of Object.entries(details)) {
    if (v && typeof v !== 'object') parts.push(`${k}: ${v}`);
  }

  return parts.join('. ');
}

// ── Call OpenAI embeddings API (text-embedding-3-small, 1536 dims) ────────────
async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY as string | undefined;
  if (!apiKey || !apiKey.startsWith('sk-')) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // token safety limit
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Generate and store embedding for one provider ─────────────────────────────
export async function generateAndStoreEmbedding(providerId: string): Promise<boolean> {
  try {
    // Fetch provider data
    const { data: p, error: pErr } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('id', providerId)
      .single();
    if (pErr || !p) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, city, area')
      .eq('id', p.user_id)
      .maybeSingle();

    const text = buildVendorText(p, profile);
    if (!text.trim()) return false;

    const embedding = await getEmbedding(text);

    // Upsert into vendor_embeddings
    const { error: upsertErr } = await supabase
      .from('vendor_embeddings' as any)
      .upsert({
        provider_id:  providerId,
        content:      text,
        embedding:    embedding ? JSON.stringify(embedding) : null,
        content_type: 'profile',
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'provider_id' });

    return !upsertErr;
  } catch {
    return false;
  }
}

// ── Batch generate for all approved providers (admin use) ─────────────────────
export async function generateAllEmbeddings(
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const { data: providers } = await supabase
    .from('provider_profiles')
    .select('id')
    .in('verification_status', ['approved', 'verified']);

  if (!providers?.length) return { success: 0, failed: 0 };

  let success = 0;
  let failed  = 0;

  for (let i = 0; i < providers.length; i++) {
    const ok = await generateAndStoreEmbedding(providers[i].id);
    ok ? success++ : failed++;
    onProgress?.(i + 1, providers.length);
    // Small delay to respect OpenAI rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  return { success, failed };
}
