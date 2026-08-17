#!/usr/bin/env node

/**
 * Apply planner vendor-search migration to Supabase
 * Migration: 20260917000000_harden_planner_vendor_search.sql
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('   Set it in .env before running this script');
  console.error('\n   If you don\'t have a service role key:');
  console.error('   1. Go to https://app.supabase.com');
  console.error('   2. Select your project: vavfeataqwwbpjonknne');
  console.error('   3. Go to Settings → API');
  console.error('   4. Copy the "service_role" key');
  console.error('   5. Add to .env: SUPABASE_SERVICE_ROLE_KEY=<key>');
  process.exit(1);
}

// Create admin client (requires service role key)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    console.log('📋 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260917000000_harden_planner_vendor_search.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('✅ Migration file loaded');
    console.log('📊 Migration: 20260917000000_harden_planner_vendor_search.sql');
    console.log(`📝 Size: ${migrationSQL.length} bytes`);

    console.log('\n🚀 Applying migration to Supabase database...');
    console.log(`   URL: ${supabaseUrl}`);
    
    // Split by semicolon to execute individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`\n📋 Found ${statements.length} SQL statements\n`);

    // Execute statements one by one with proper error handling
    let executed = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const stmtNum = i + 1;
      const preview = statement.substring(0, 60).replace(/\n/g, ' ') + (statement.length > 60 ? '...' : '');
      
      try {
        console.log(`[${stmtNum}/${statements.length}] ${preview}`);
        
        // Execute raw SQL via RPC or direct query
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Fallback: try without RPC (for functions that don't have exec_sql)
          // This is a limitation - we need the service role key approach
          throw error;
        }
        
        executed++;
        console.log(`           ✅ Success\n`);
        
      } catch (err) {
        console.log(`           ❌ Error: ${err.message}\n`);
        errors.push({
          statement: statement.substring(0, 100),
          error: err.message,
          index: stmtNum
        });
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Execution Summary:`);
    console.log(`  ✅ Successful: ${executed}/${statements.length}`);
    console.log(`  ❌ Failed: ${errors.length}/${statements.length}`);
    console.log(`${'='.repeat(60)}\n`);

    if (errors.length > 0) {
      console.log('❌ Errors encountered:\n');
      errors.forEach((err, idx) => {
        console.log(`  Error ${idx + 1} [Statement ${err.index}]:`);
        console.log(`    SQL: ${err.statement}`);
        console.log(`    Message: ${err.error}\n`);
      });
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Verify search_vendors_sql exists in Supabase');
    console.log('   2. Check function signature includes p_area parameter');
    console.log('   3. Run manual tests against the Planner');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify SUPABASE_SERVICE_ROLE_KEY is set in .env');
    console.error('  2. Verify Supabase project is accessible');
    console.error('  3. Check migration file syntax');
    process.exit(1);
  }
}

// Run with proper async handling
applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
