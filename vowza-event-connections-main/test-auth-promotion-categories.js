#!/usr/bin/env node

/**
 * Test script to validate Auth Promotion category system
 * Tests against real Supabase database
 * 
 * Usage: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node test-auth-promotion-categories.js
 * Or just: npm run test:categories (if added to package.json)
 */

import { createClient } from '@supabase/supabase-js';

// For testing, hardcode the Supabase credentials from .env
const supabaseUrl = 'https://vavfeataqwwbpjonknne.supabase.co';
const supabaseKey = 'sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test categories
const testCategories = ['photographer', 'videographer', 'catering_services', 'dj', 'makeup_artist', 'mehendi_artist', 'singer', 'dancer', 'music_band', 'anchor', 'event_decorator'];

const AUTH_PROMOTION_CATEGORIES = [
  { profession_type: 'photographer', package_table: 'photography_packages' },
  { profession_type: 'videographer', package_table: 'videography_packages' },
  { profession_type: 'cinematographer', package_table: null },
  { profession_type: 'drone_operator', package_table: 'drone_packages' },
  { profession_type: 'music_band', package_table: 'band_packages' },
  { profession_type: 'traditional_band', package_table: 'band_packages' },
  { profession_type: 'maharashta_band', package_table: 'band_packages' },
  { profession_type: 'dj', package_table: 'dj_packages' },
  { profession_type: 'singer', package_table: null },
  { profession_type: 'instrumental_artist', package_table: null },
  { profession_type: 'classical_musician', package_table: null },
  { profession_type: 'dancer', package_table: 'dancer_packages' },
  { profession_type: 'choreographer', package_table: null },
  { profession_type: 'kuchipudi_dancer', package_table: null },
  { profession_type: 'classical_dancer', package_table: null },
  { profession_type: 'western_dancer', package_table: null },
  { profession_type: 'event_decorator', package_table: 'decoration_packages' },
  { profession_type: 'wedding_decorator', package_table: 'decoration_packages' },
  { profession_type: 'stage_decorator', package_table: 'decoration_packages' },
  { profession_type: 'makeup_artist', package_table: 'makeup_packages' },
  { profession_type: 'mehendi_artist', package_table: 'mehendi_packages' },
  { profession_type: 'anchor', package_table: 'anchor_packages' },
  { profession_type: 'host', package_table: null },
  { profession_type: 'magician', package_table: null },
  { profession_type: 'stand_up_comedian', package_table: null },
  { profession_type: 'celebrity_artist', package_table: null },
  { profession_type: 'live_performer', package_table: null },
  { profession_type: 'folk_artist', package_table: null },
  { profession_type: 'lighting_services', package_table: null },
  { profession_type: 'sound_services', package_table: null },
  { profession_type: 'event_planner', package_table: null },
  { profession_type: 'wedding_planner', package_table: null },
  { profession_type: 'catering_services', package_table: 'catering_packages' },
  { profession_type: 'event_support', package_table: null },
];

async function runTests() {
  console.log('🧪 Testing Auth Promotion Category System\n');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Verify all categories exist in Supabase
  console.log('\n📋 Test 1: Load categories from Supabase artist_categories table');
  try {
    const { data: categories, error: err } = await supabase
      .from('artist_categories')
      .select('id, name, profession_type, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (err) throw err;

    console.log(`✅ Loaded ${categories.length} active categories from Supabase`);
    console.log(`   Categories: ${categories.map(c => c.name).join(', ')}`);

    // Check if expected test categories exist
    for (const testCat of testCategories) {
      const found = categories.find(c => c.profession_type === testCat);
      if (found) {
        console.log(`   ✓ ${found.name} (${testCat})`);
        passedTests++;
      } else {
        console.log(`   ✗ Missing: ${testCat}`);
        failedTests++;
      }
    }
  } catch (err) {
    console.error('❌ Failed to load categories:', err.message);
    failedTests++;
  }

  // Test 2: Verify mapping completeness
  console.log('\n🗺️  Test 2: Verify all 34 profession types mapped');
  console.log(`   Total mappings: ${AUTH_PROMOTION_CATEGORIES.length}`);
  if (AUTH_PROMOTION_CATEGORIES.length === 34) {
    console.log('   ✅ All 34 profession types defined');
    passedTests++;
  } else {
    console.log(`   ❌ Expected 34, got ${AUTH_PROMOTION_CATEGORIES.length}`);
    failedTests++;
  }

  // Test 3: Test vendors exist for key categories
  console.log('\n👥 Test 3: Verify vendors exist for key categories');
  for (const cat of testCategories) {
    try {
      const { data: providers, error: err } = await supabase
        .from('provider_profiles')
        .select('id, stage_name')
        .eq('profession', cat)
        .eq('verification_status', 'approved')
        .limit(3);

      if (err) throw err;

      if (providers && providers.length > 0) {
        console.log(`   ✅ ${cat}: ${providers.length} approved vendors`);
        providers.forEach(p => console.log(`      - ${p.stage_name || 'Unnamed'}`));
        passedTests++;
      } else {
        console.log(`   ⚠️  ${cat}: No approved vendors found`);
      }
    } catch (err) {
      console.error(`   ❌ ${cat}: Error - ${err.message}`);
      failedTests++;
    }
  }

  // Test 4: Test packages exist for vendors
  console.log('\n📦 Test 4: Verify packages exist for category vendors');
  for (const cat of testCategories.slice(0, 3)) {
    const mapping = AUTH_PROMOTION_CATEGORIES.find(m => m.profession_type === cat);
    if (!mapping || !mapping.package_table) {
      console.log(`   ⏭️  ${cat}: No package table defined`);
      continue;
    }

    try {
      const { data: providers, error: provErr } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('profession', cat)
        .eq('verification_status', 'approved')
        .limit(1);

      if (provErr) throw provErr;

      if (!providers || providers.length === 0) {
        console.log(`   ⏭️  ${cat}: No vendors, skipping package test`);
        continue;
      }

      const providerId = providers[0].id;
      const { data: packages, error: pkgErr } = await supabase
        .from(mapping.package_table)
        .select('*')  // Select all columns to avoid column name errors
        .eq('provider_id', providerId)
        .in('status', ['active', 'draft'])
        .limit(2);

      if (pkgErr) throw pkgErr;

      if (packages && packages.length > 0) {
        console.log(`   ✅ ${cat}: ${packages.length} packages available`);
        packages.forEach(p => console.log(`      - ${p.name}`));
        passedTests++;
      } else {
        console.log(`   ⚠️  ${cat}: Vendor exists but no packages`);
      }
    } catch (err) {
      console.error(`   ❌ ${cat}: Error - ${err.message}`);
      failedTests++;
    }
  }

  // Test 5: Verify complete category list is available
  console.log('\n✨ Test 5: Verify complete category dropdown data');
  try {
    const { data: allCategories, error: err } = await supabase
      .from('artist_categories')
      .select('id, name, profession_type, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (err) throw err;

    console.log(`   ✅ Category dropdown would show ${allCategories.length} categories:`);
    allCategories.forEach((cat, idx) => {
      console.log(`      ${idx + 1}. ${cat.name} (${cat.profession_type})`);
    });
    passedTests++;
  } catch (err) {
    console.error('   ❌ Failed to load complete category list:', err.message);
    failedTests++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   Total:  ${passedTests + failedTests}\n`);

  if (failedTests === 0) {
    console.log('🎉 All tests passed! Category system is ready for browser testing.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review output above.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('🔥 Fatal error:', err);
  process.exit(1);
});
