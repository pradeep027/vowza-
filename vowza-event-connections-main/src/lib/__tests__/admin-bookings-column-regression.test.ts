/**
 * Phase O — ADMIN DASHBOARD "zeroed stats" regression.
 *
 * THE BUG: three admin surfaces queried the GENERIC `bookings` table for a
 * `total_amount` column that does not exist there (the generic table's money
 * column is `amount`; only the per-category *_bookings tables have
 * `total_amount`). PostgREST rejects the unknown column, so each query failed:
 *   - useAdminStats.ts  → safeSelect swallows the error and returns [], so the
 *     six booking counters (total/today/pending/confirmed/completed/cancelled)
 *     were ALWAYS 0.
 *   - AdminAnalytics.tsx → `bookings` undefined → monthly bookings AND the
 *     booking-revenue reduce (`b.total_amount`) both 0 for every month.
 *   - AdminDashboardHome.tsx → `bookings` [] → the monthly bookings bars 0.
 * Revenue sourced from `payments.amount` was unaffected; the breakage was the
 * silently-empty booking stats.
 *
 * WHAT IS LOCKED: every generic-`bookings` select on these three admin files
 * uses `amount`, never `total_amount`. STATIC regression (no network / DB).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const ADMIN_STATS = repoFile('src/hooks/useAdminStats.ts');
const ADMIN_ANALYTICS = repoFile('src/pages/admin/AdminAnalytics.tsx');
const ADMIN_HOME = repoFile('src/pages/admin/AdminDashboardHome.tsx');

describe('admin dashboards — generic bookings use `amount`, not `total_amount`', () => {
  it('useAdminStats selects the real column so the booking counters populate', () => {
    expect(ADMIN_STATS).toMatch(/safeSelect\(\s*['"]bookings['"]\s*,\s*['"][^'"]*\bamount\b[^'"]*['"]/);
    expect(ADMIN_STATS).not.toMatch(/total_amount/);
  });

  it('AdminAnalytics selects and reduces `amount` for monthly booking revenue', () => {
    expect(ADMIN_ANALYTICS).toMatch(/from\(['"]bookings['"]\)\.select\(['"][^'"]*\bamount\b[^'"]*['"]\)/);
    expect(ADMIN_ANALYTICS).toMatch(/b\.amount/);
    expect(ADMIN_ANALYTICS).not.toMatch(/total_amount/);
  });

  it('AdminDashboardHome selects the real column so the monthly bars populate', () => {
    expect(ADMIN_HOME).toMatch(/from\(['"]bookings['"]\)\.select\(['"][^'"]*\bamount\b[^'"]*['"]\)/);
    expect(ADMIN_HOME).not.toMatch(/total_amount/);
  });
});
