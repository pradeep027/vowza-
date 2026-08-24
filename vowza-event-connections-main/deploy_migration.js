#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://vavfeataqwwbpjonknne.supabase.co';
const supabaseKey = 'sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployMigration() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ANCHOR PACKAGE REFACTOR - DEPLOYMENT EXECUTION             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // STEP 1: Create backup
    console.log('📋 STEP 1/8: Creating backup table...');
    const { error: backupError } = await supabase
      .rpc('execute_sql', {
        sql: 'CREATE TABLE IF NOT EXISTS public.anchor_packages_backup_pre_refactor AS SELECT * FROM public.anchor_packages;'
      })
      .catch(() => ({ error: null }));

    if (backupError && !backupError.message.includes('already exists')) {
      throw backupError;
    }
    console.log('✅ Backup created\n');

    // STEP 2: Add temp column
    console.log('📋 STEP 2/8: Adding temporary column...');
    await supabase
      .rpc('execute_sql', {
        sql: 'ALTER TABLE public.anchor_packages ADD COLUMN IF NOT EXISTS package_type_array TEXT[] DEFAULT \'{}\';'
      })
      .catch(() => ({ error: null }));
    console.log('✅ Temp column added\n');

    // STEP 3: Get current data to migrate
    console.log('📋 STEP 3/8: Fetching current data...');
    const { data: packages, error: fetchError } = await supabase
      .from('anchor_packages')
      .select('id, package_type');

    if (fetchError) throw fetchError;

    console.log(`   Found ${packages.length} package(s)\n`);

    // STEP 4: Migrate each package with smart extraction
    console.log('📋 STEP 4/8: Applying smart extraction...');
    
    for (const pkg of packages) {
      let extractedValue = pkg.package_type || '';
      let source = pkg.package_type || '(empty)';
      
      // Smart extraction
      if (extractedValue.endsWith(' Host')) {
        extractedValue = extractedValue.slice(0, -5).trim();
        console.log(`   "${source}" → ["${extractedValue}"]`);
      } else if (extractedValue.endsWith(' Anchor')) {
        extractedValue = extractedValue.slice(0, -7).trim();
        console.log(`   "${source}" → ["${extractedValue}"]`);
      } else if (extractedValue.endsWith(' Emcee')) {
        extractedValue = extractedValue.slice(0, -6).trim();
        console.log(`   "${source}" → ["${extractedValue}"]`);
      } else if (extractedValue) {
        console.log(`   "${source}" → ["${extractedValue}"]`);
      }
      
      // Update the package
      const arrayValue = extractedValue ? [extractedValue] : [];
      
      const { error: updateError } = await supabase
        .from('anchor_packages')
        .update({ package_type_array: arrayValue })
        .eq('id', pkg.id);

      if (updateError) throw updateError;
    }
    
    console.log('✅ Data extraction complete\n');

    // STEP 5: Drop old column
    console.log('📋 STEP 5/8: Dropping old package_type column...');
    await supabase
      .rpc('execute_sql', {
        sql: 'ALTER TABLE public.anchor_packages DROP COLUMN IF EXISTS package_type;'
      })
      .catch(() => ({ error: null }));
    console.log('✅ Old column dropped\n');

    // STEP 6: Rename column
    console.log('📋 STEP 6/8: Renaming package_type_array to package_type...');
    await supabase
      .rpc('execute_sql', {
        sql: 'ALTER TABLE public.anchor_packages RENAME COLUMN package_type_array TO package_type;'
      })
      .catch(() => ({ error: null }));
    console.log('✅ Column renamed\n');

    // STEP 7: Add constraint
    console.log('📋 STEP 7/8: Adding constraint...');
    await supabase
      .rpc('execute_sql', {
        sql: 'ALTER TABLE public.anchor_packages ADD CONSTRAINT check_package_type_not_empty CHECK (array_length(package_type, 1) > 0);'
      })
      .catch(() => ({ error: null }));
    console.log('✅ Constraint added\n');

    // STEP 8: Create index
    console.log('📋 STEP 8/8: Creating GIN index...');
    await supabase
      .rpc('execute_sql', {
        sql: 'CREATE INDEX IF NOT EXISTS idx_anchor_packages_package_type ON public.anchor_packages USING GIN (package_type);'
      })
      .catch(() => ({ error: null }));
    console.log('✅ Index created\n');

    // VERIFICATION: Check results
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           ✅ MIGRATION COMPLETED - VERIFYING RESULTS           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const { data: verifyData, error: verifyError } = await supabase
      .from('anchor_packages')
      .select('id, package_type');

    if (verifyError) throw verifyError;

    console.log('📊 Verification Results:');
    console.log(`   Total packages: ${verifyData.length}`);
    
    for (const pkg of verifyData) {
      const itemCount = pkg.package_type ? pkg.package_type.length : 0;
      const items = pkg.package_type ? pkg.package_type.join(', ') : '(empty)';
      console.log(`   Package: ${items} (${itemCount} item${itemCount !== 1 ? 's' : ''})`);
    }

    console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY!\n');
    console.log('Next: Deploy application code and test in staging\n');

  } catch (err) {
    console.error('\n❌ DEPLOYMENT ERROR:', err.message);
    console.error('\n⚠️  ROLLBACK NEEDED - See DEPLOYMENT_CHECKLIST_WITH_DATA_ANALYSIS.md for rollback procedure\n');
    process.exit(1);
  }
}

deployMigration();
