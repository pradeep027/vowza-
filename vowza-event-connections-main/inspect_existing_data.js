#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vavfeataqwwbpjonknne.supabase.co';
const supabaseKey = 'sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAnchorPackages() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ANCHOR_PACKAGES.PACKAGE_TYPE - EXISTING DATA INSPECTION      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get all packages with their package_type values
    const { data, error } = await supabase
      .from('anchor_packages')
      .select('id, package_type, status');

    if (error) {
      console.error('❌ Database Error:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('✅ No packages found in anchor_packages table');
      process.exit(0);
    }

    // Count distinct values
    const valueMap = {};
    data.forEach(row => {
      const value = row.package_type;
      valueMap[value] = (valueMap[value] || 0) + 1;
    });

    const distinctValues = Object.entries(valueMap).sort((a, b) => b[1] - a[1]);

    console.log(`📊 FOUND ${distinctValues.length} DISTINCT PACKAGE_TYPE VALUE(S)\n`);

    console.log('┌─────────────────────────────────────────────────────┬────────┐');
    console.log('│ Current package_type Value                          │ Count  │');
    console.log('├─────────────────────────────────────────────────────┼────────┤');

    distinctValues.forEach(([value, count]) => {
      const displayValue = value || '(NULL)';
      console.log(`│ ${displayValue.padEnd(49)} │ ${String(count).padStart(6)} │`);
    });

    console.log('├─────────────────────────────────────────────────────┼────────┤');
    console.log(`│ TOTAL PACKAGES:                                     │ ${String(data.length).padStart(6)} │`);
    console.log('└─────────────────────────────────────────────────────┴────────┘\n');

    // Show all packages for detailed inspection
    console.log('📋 DETAILED PACKAGE LIST:\n');
    console.log('┌───────────┬─────────────────────────────────────────┬──────────────────────────┐');
    console.log('│ Package # │ Package_Type                            │ Status                   │');
    console.log('├───────────┼─────────────────────────────────────────┼──────────────────────────┤');

    for (let i = 0; i < data.length; i++) {
      const pkg = data[i];
      const pkgType = pkg.package_type || '(NULL)';
      const status = pkg.status || '(unknown)';
      console.log(`│ ${String(i + 1).padStart(9)} │ ${pkgType.padEnd(39)} │ ${String(status).padEnd(24)} │`);
    }

    console.log('└───────────┴─────────────────────────────────────────┴──────────────────────────┘\n');

    // Mapping analysis
    console.log('🔍 MAPPING ANALYSIS:\n');
    console.log('Available 17 New Package Classifications:');
    const newClassifications = [
      'Wedding',
      'Reception',
      'Baraat',
      'Engagement',
      'Sangeet',
      'Haldi',
      'Mehendi',
      'Birthday',
      'Anniversary',
      'Corporate Event',
      'College Fest',
      'Cultural Event',
      'Private Party',
      'Public Event',
      'Religious Event',
      'Award Function',
      'Custom Event'
    ];

    newClassifications.forEach((cls, idx) => {
      console.log(`  ${String(idx + 1).padStart(2)}. ${cls}`);
    });

    console.log('\n📝 MAPPING RECOMMENDATIONS:\n');
    
    const mappingGuide = {
      'Wedding Anchor': ['Wedding'],
      'Wedding Host': ['Wedding'],
      'Reception Anchor': ['Reception'],
      'Reception Host': ['Reception'],
      'Baraat Anchor': ['Baraat'],
      'Baraat Host': ['Baraat'],
      'Engagement Anchor': ['Engagement'],
      'Engagement Host': ['Engagement'],
      'Sangeet Anchor': ['Sangeet'],
      'Sangeet Host': ['Sangeet'],
      'Haldi Anchor': ['Haldi'],
      'Haldi Host': ['Haldi'],
      'Mehendi Anchor': ['Mehendi'],
      'Mehendi Host': ['Mehendi'],
      'Birthday Anchor': ['Birthday'],
      'Birthday Host': ['Birthday'],
      'Anniversary Anchor': ['Anniversary'],
      'Anniversary Host': ['Anniversary'],
      'Corporate Event Anchor': ['Corporate Event'],
      'Corporate Event Host': ['Corporate Event'],
      'College Fest Anchor': ['College Fest'],
      'College Fest Host': ['College Fest'],
      'Cultural Event Anchor': ['Cultural Event'],
      'Cultural Event Host': ['Cultural Event'],
      'Private Party Anchor': ['Private Party'],
      'Private Party Host': ['Private Party'],
      'Public Event Anchor': ['Public Event'],
      'Public Event Host': ['Public Event'],
      'Religious Event Anchor': ['Religious Event'],
      'Religious Event Host': ['Religious Event'],
      'Award Function Anchor': ['Award Function'],
      'Award Function Host': ['Award Function'],
      'Custom Event Anchor': ['Custom Event'],
      'Custom Event Host': ['Custom Event'],
    };

    console.log('Suggested Mappings (OLD → NEW):');
    Object.entries(mappingGuide).forEach(([old, newArray]) => {
      console.log(`  "${old}" → ${JSON.stringify(newArray)}`);
    });

    console.log('\n✅ Data inspection complete. No data was modified.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

inspectAnchorPackages();
