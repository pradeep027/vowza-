#!/usr/bin/env node

/**
 * Verify if migration 20260918000000_prevent_self_booking was applied to production
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually
function loadEnv() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkMigration() {
  console.log('🔍 Checking Supabase connection...\n');

  try {
    const { data, error } = await supabase
      .from('catering_bookings')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Error:', error.message);
    } else {
      console.log('✅ Connected to Supabase');
    }

    console.log('\n' + '='.repeat(70));
    console.log('TO VERIFY MIGRATION STATUS:');
    console.log('='.repeat(70));
    console.log('\nRun this SQL in your Supabase dashboard SQL Editor:');
    console.log('https://app.supabase.com/project/vavfeataqwwbpjonknne/sql/new\n');
    console.log('─'.repeat(70));
    console.log(`SELECT 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('catering_bookings', 'photography_package_bookings')
  AND policyname LIKE '%insert%'
ORDER BY tablename;`);
    console.log('─'.repeat(70));
    
    console.log('\n✅ MIGRATION APPLIED if qual contains:');
    console.log('   NOT EXISTS (SELECT 1 FROM provider_profiles WHERE id = provider_id AND user_id = auth.uid())');
    
    console.log('\n❌ MIGRATION NOT APPLIED if qual shows only:');
    console.log('   customer_id = auth.uid()');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkMigration();
