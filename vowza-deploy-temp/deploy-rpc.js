#!/usr/bin/env node

/**
 * Deploys the new random promotion video RPC to Supabase
 * This is a hotfix for the random video selection issue
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://vavfeataqwwbpjonknne.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI';

const sql = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/20260927000000_add_random_promotion_video_rpc.sql'),
  'utf-8'
);

console.log('[Deploy] Reading SQL migration...');
console.log('[Deploy] SQL length:', sql.length, 'characters');
console.log('[Deploy] Supabase Project:', SUPABASE_URL);

// Split SQL by semicolon-terminated statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log('[Deploy] Found', statements.length, 'SQL statements');

statements.forEach((stmt, i) => {
  console.log(`\n[Statement ${i + 1}/${statements.length}]`);
  console.log(stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''));
});

console.log('\n[Deploy] NOTE: To execute this migration manually:');
console.log('[Deploy] 1. Log into Supabase dashboard');
console.log('[Deploy] 2. Go to SQL Editor');
console.log('[Deploy] 3. Run the SQL from: supabase/migrations/20260927000000_add_random_promotion_video_rpc.sql');
console.log('[Deploy] 4. Verify with: SELECT * FROM auth_promotion_videos;');
