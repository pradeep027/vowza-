/**
 * DIAGNOSTIC TEST - Vendor Retrieval Debug
 * 
 * This file tests the complete vendor retrieval pipeline:
 * 1. Check if vendors exist in provider_profiles table
 * 2. Test the search_vendors_sql RPC
 * 3. Verify frontend can call retrieveVendors()
 * 4. Check if results render correctly
 * 
 * Run in browser console after loading the Planner:
 * import { testVendorRetrieval } from './lib/testVendorRetrieval';
 * await testVendorRetrieval();
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase config in .env');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function testVendorRetrieval() {
  console.log('🔍 VENDOR RETRIEVAL DIAGNOSTIC TEST');
  console.log('=====================================\n');

  try {
    // Step 1: Check if vendors exist
    console.log('Step 1: Checking if published vendors exist...');
    const { data: allVendors, error: allError } = await supabase
      .from('provider_profiles')
      .select('id, profession, stage_name, is_published, is_verified, verification_status, average_rating')
      .eq('is_published', true)
      .eq('is_verified', true)
      .in('verification_status', ['approved', 'verified'])
      .limit(5);

    if (allError) {
      console.error('❌ Error querying provider_profiles:', allError);
      return;
    }

    console.log(`✅ Found ${allVendors?.length ?? 0} published vendors in database`);
    if (allVendors && allVendors.length > 0) {
      console.log('Sample vendors:', allVendors.slice(0, 3));
    } else {
      console.warn('⚠️  No published vendors found. Check if is_published and is_verified are set correctly.');
    }

    // Step 2: Test the RPC directly
    console.log('\nStep 2: Testing search_vendors_sql RPC...');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_vendors_sql' as any, {
      p_profession: null,
      p_city: null,
      p_price_max: null,
      p_min_rating: 0,
      p_limit: 10,
    });

    if (rpcError) {
      console.error('❌ RPC call failed:', rpcError.message);
      console.log('   This means the search_vendors_sql function may not be deployed.');
      console.log('   You may need to apply migration: 20260917000000_harden_planner_vendor_search.sql');
    } else if (!rpcResult || rpcResult.length === 0) {
      console.warn('⚠️  RPC returned no results. Either no vendors match, or data is misfiltered.');
    } else {
      console.log(`✅ RPC returned ${rpcResult.length} vendors`);
      console.log('Sample RPC result:', rpcResult[0]);
    }

    // Step 3: Test frontend retrieval
    console.log('\nStep 3: Testing frontend retrieveVendors()...');
    try {
      const { retrieveVendors } = await import('./ragRetriever');
      const result = await retrieveVendors('Show me photographers', {}, 10);
      
      console.log(`Frontend retrieval: ${result.vendors.length} vendors, status: ${result.searchStatus}`);
      if (result.vendors.length > 0) {
        console.log('✅ Frontend can retrieve vendors');
        console.log('Sample vendor:', result.vendors[0]);
      } else {
        console.warn('⚠️  Frontend retrieval returned no vendors');
        console.log('   Raw result:', result);
      }
    } catch (err: any) {
      console.error('❌ Frontend retrieval failed:', err.message);
    }

    // Step 4: Test with specific profession
    console.log('\nStep 4: Testing vendor search by profession (photographer)...');
    const { data: photographers, error: photError } = await supabase.rpc('search_vendors_sql' as any, {
      p_profession: 'photographer',
      p_city: null,
      p_price_max: null,
      p_min_rating: 0,
      p_limit: 10,
    });

    if (photError) {
      console.error('❌ Photographer search failed:', photError.message);
    } else if (!photographers || photographers.length === 0) {
      console.warn('⚠️  No photographers found');
    } else {
      console.log(`✅ Found ${photographers.length} photographers`);
      console.log('Sample photographer:', photographers[0]);
    }

    console.log('\n✅ DIAGNOSTIC COMPLETE\n');
    console.log('NEXT STEPS:');
    if (!allVendors || allVendors.length === 0) {
      console.log('1. Add test vendors to provider_profiles with is_published=true and is_verified=true');
    }
    if (rpcError) {
      console.log('2. Apply migration: 20260917000000_harden_planner_vendor_search.sql');
    }
    if (!rpcResult || rpcResult.length === 0) {
      console.log('3. Check vendor_profiles table - may need to update filter columns');
    }

  } catch (err: any) {
    console.error('❌ UNEXPECTED ERROR:', err.message);
    console.error(err);
  }
}

// Auto-run if imported
if (typeof window !== 'undefined') {
  (window as any).__testVendorRetrieval = testVendorRetrieval;
  console.log('📋 Vendor diagnostic available. Run: await __testVendorRetrieval()');
}
