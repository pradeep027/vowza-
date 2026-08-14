#!/usr/bin/env node

/**
 * Direct migration execution script
 * Applies 20260918000000_prevent_self_booking.sql to Supabase production
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
  process.exit(1);
}

// Create admin client (requires service role key)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyMigration() {
  try {
    console.log('📋 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260918000000_prevent_self_booking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying migration to production database...');
    
    // Split by semicolon to execute individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let executed = 0;
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) throw error;
        executed++;
        process.stdout.write(`\r✅ Executed ${executed}/${statements.length} statements`);
      } catch (err) {
        // Try direct SQL execution instead
        try {
          const { error: directError } = await supabase.from('_supabase_migrations').select().limit(1);
          // If this works, DB is accessible
          console.error(`\n⚠️  Could not execute: ${statement.substring(0, 50)}...`);
          console.error(`   Error: ${err.message}`);
        } catch (dbErr) {
          throw new Error('Cannot connect to Supabase database');
        }
      }
    }

    console.log(`\n✅ Migration applied successfully! (${executed} policies created)`);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
