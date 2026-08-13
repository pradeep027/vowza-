// ─── Embedding Generator ─────────────────────────────────────────────────────
// Generates vector embeddings for vendor profiles via the server-side
// Supabase Edge Function `generate-embedding`.
//
// SECURITY: The OpenAI API key is stored as a Supabase secret and NEVER
// exposed to the browser. All embedding generation happens server-side.
//
// Usage (admin panel):
//   await generateAllEmbeddings((done, total) => setProgress({ done, total }));

import { supabase } from '@/integrations/supabase/client';

// ── Build plain text from a vendor profile (exported for display/testing) ─────
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

// ── Call the server-side Edge Function to generate + store an embedding ────────
async function generateEmbeddingViaEdge(providerId: string): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    return { success: false, error: 'VITE_SUPABASE_URL not configured' };
  }

  // Get the current user's session token for auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated. Please log in as admin.' };
  }

  const functionUrl = `${supabaseUrl}/functions/v1/generate-embedding`;

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ provider_id: providerId }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Network error: ${err?.message || 'unknown'}` };
  }
}

// ── Generate and store embedding for one provider (via Edge Function) ──────────
export async function generateAndStoreEmbedding(providerId: string): Promise<boolean> {
  const result = await generateEmbeddingViaEdge(providerId);
  if (!result.success) {
    console.error(`[Embedding] Failed for ${providerId}:`, result.error);
  }
  return result.success;
}

// ── Batch generate for all approved providers (admin use) ─────────────────────
export async function generateAllEmbeddings(
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const { data: providers, error: queryErr } = await supabase
    .from('provider_profiles')
    .select('id')
    .in('verification_status', ['approved', 'verified']);

  if (queryErr) {
    throw new Error(`Failed to fetch providers: ${queryErr.message}`);
  }
  if (!providers?.length) return { success: 0, failed: 0, errors: ['No approved/verified vendors found'] };

  let success = 0;
  let failed  = 0;
  const errors: string[] = [];

  for (let i = 0; i < providers.length; i++) {
    const result = await generateEmbeddingViaEdge(providers[i].id);

    if (result.success) {
      success++;
    } else {
      failed++;
      const errMsg = `${providers[i].id}: ${result.error}`;
      errors.push(errMsg);
      console.error(`[Embedding] ${errMsg}`);
    }

    onProgress?.(i + 1, providers.length);

    // Respect rate limits — 200ms between calls
    await new Promise(r => setTimeout(r, 200));
  }

  return { success, failed, errors };
}
