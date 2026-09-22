# Vowza — Production Readiness Status

**Phase 0 — Verified Baseline**
**Date:** 2026-09-22
**Branch:** `chore/production-readiness-baseline` (off `chore/lint-cleanup-batch1` @ `b4bc92d`)
**App root:** `vowza-event-connections-main/` (nested inside repo root `vowza/`)

> This document records a *measured* baseline only. It makes **no** production-ready
> claim. It exists so later phases can be checked against verified facts instead of
> stale docs (Rule 9: current code / schema / config are the source of truth).

---

## 1. Verified build & test baseline

All commands run in `vowza-event-connections-main/` on the branch above.

| Gate | Command | Result |
|------|---------|--------|
| Node | `.nvmrc` | `24` (package.json `engines.node >= 24`) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0, no errors |
| Tests | `npm test` (4 curated files) | ✅ 4 files / **38 tests** pass |
| Build | `npm run build` (`tsc --noEmit && vite build`) | ✅ exit 0, built in ~13.7s |
| Lint | `npm run lint` (`eslint .`) | ⚠️ **1543 problems (1451 errors, 92 warnings)** |

> `npm run build` **does** typecheck (`tsc --noEmit` runs first), so the build is a
> real safety net. Vitest is the only place null/strict issues surface at runtime,
> since tsconfig is lenient (`strict:false`, `strictNullChecks:false`, `noImplicitAny:false`).

### Lint breakdown (by rule)

| Count | Rule | Severity |
|-------|------|----------|
| 1418 | `@typescript-eslint/no-explicit-any` | error |
| 69 | `react-hooks/exhaustive-deps` | warning |
| 23 | `react-refresh/only-export-components` | warning |
| 16 | `no-useless-escape` | error |
| 9 | `@typescript-eslint/ban-ts-comment` | error |
| 5 | `no-empty` | error |
| 2 | `no-misleading-character-class` | error |
| 1 | `@typescript-eslint/no-require-imports` | error |

Errors = 1418 + 16 + 9 + 5 + 2 + 1 = **1451**. Warnings = 69 + 23 = **92**.

> Lint reduced from a prior **1869 → 1451 errors** across 5 behavior-preserving
> cast/type batches on `chore/lint-cleanup-batch1` (all validated green). Per the
> master plan, ESLint = 0 is **not** the goal and lint cleanup is de-prioritized
> below security/payment/authz work.

---

## 2. Deployment & CI configuration

### GitHub Actions — `.github/workflows/quality.yml` (repo **root**)
- Triggers: `push` and `pull_request` on `main`.
- `working-directory: vowza-event-connections-main`; Node from `.nvmrc`; `npm ci`.
- **Blocking job** `quality`: typecheck → tests → build.
- **Non-blocking job** `lint-baseline`: `continue-on-error: true` (visibility only).
- Explicit boundary comment: *no deployment, no secrets, no Supabase/Vercel access,
  no production mutation.* Deployment stays a manual, controlled operation. ✅ good posture.

### Vercel — TWO `vercel.json` files (ambiguity to resolve)
- **Root** `vowza/vercel.json`: `buildCommand: cd vowza-event-connections-main && npm install && npm run build`, `outputDirectory: vowza-event-connections-main/dist`. Headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`. SPA rewrite to `/index.html`.
- **App** `vowza-event-connections-main/vercel.json`: same rewrite + richer headers (adds `Referrer-Policy`, `no-store` on non-asset HTML, `immutable` on `/assets/`).
- ⚠️ For a repo-root Vercel project the **root** file wins; the app-level file (with the better headers) may be ignored. Missing from both: **CSP** and **HSTS (Strict-Transport-Security)**. → Phase 17.
- Deploy note (memory): commits authored by `siddiq-x` on Vercel Hobby **silently never deploy** — an empty commit as repo owner is required to ship. Verify rollout by grepping the *served bundle*, not asset hashes / cached HTML.

---

## 3. Backend surface

- **Migrations:** `supabase/migrations/` = **26 active** SQL files; `supabase/migrations-archive/` = **109 archived**. History has been consolidated. → Phase 3/19: confirm active set reflects production schema.
- **Edge Functions (8):** `admin-user-roles`, `ai-chat`, `create-booking`, `delete-account`, `generate-embedding`, `send-service-start-otp`, `verify-document`, `verify-service-start-otp`. → Phase 8: audit authz + service-role usage per function.
- Edge functions correctly read `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env.get(...)` (server-side only) — **no** service-role key reaches the browser bundle. ✅

---

## 4. Secrets audit (Phase 1 preview — no secret material committed)

- **Tracked `.env` files:** only `vowza-event-connections-main/.env.example` (NAMES ONLY: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` — all public-by-design Vite client vars). ✅
- **Committed secret values:** none found. Scans for JWTs (`eyJ….eyJ`), `sk_live_`, `rzp_live_<key>`, `SUPABASE_SERVICE_ROLE_KEY=<val>`, `RAZORPAY_KEY_SECRET=<val>`, AWS/private keys returned only a UI **placeholder** `rzp_live_xxx` in `src/pages/admin/AdminSettings.tsx:157`. ✅
- `service_role` string appears only in: Edge Functions (`Deno.env.get`), SQL `GRANT` statements (Postgres role name, not a secret), and `apply-planner-migration.js` (reads `process.env.SUPABASE_SERVICE_ROLE_KEY` from a local, git-ignored `.env`). ✅
- ⚠️ **Stale comment:** root `.gitignore` says *".env is currently still tracked"* — but `git ls-files` shows **no** tracked `.env`. The comment is inaccurate and should be corrected (low risk).

## 5. Known production RISKS (to investigate — do NOT guess)

1. **[HIGH · authz/schema] Loose ad-hoc SQL files grant to `anon`.** `RUN_THIS_IN_SUPABASE.sql`, `VENDOR_DASHBOARD_MIGRATION.sql`, `FIX_APPROVAL_NOW.sql` at the app root contain `GRANT ALL … TO … anon` on **sensitive tables** (`bookings`, `payments`, `user_roles`, `profiles`, `provider_profiles`, …). These are **not** in tracked `migrations/`. Whether they were ever applied to the production DB **cannot be verified from this repo** (Rule 9/10). If applied, table-level `anon` GRANTs make RLS the *only* line of defence on financial tables. → Phase 2/3: confirm actual production grants; do not assume.
2. **[MED] Two `vercel.json` files** — resolve which Vercel actually uses; the weaker (root) header set likely wins. Add CSP + HSTS. → Phase 17.
3. **[MED] Bundle size** — `VendorPackages` chunk is **603 kB** (>500 kB warning). → Phase 18 (code-split).
4. **[LOW] Schema drift** — `profile_views`, `inquiries`, `coupons` tables are referenced in code via `from('…' as any)` but are **absent from generated types** (`src/integrations/supabase/types.ts`). → Phase 12: regenerate types / confirm tables exist.

## 6. Known DEFERRED bug (parked, gets its own PR + regression test)

- **`editPackage` gallery `media_type` drop** (vendor package managers): the edit-load path maps gallery rows to `{ id, url, is_cover }`, dropping `media_type`, then filters on `x.media_type === 'image'|'video'` — always false, so image/video thumbnails likely never repopulate when editing an existing package. Business logic bug, **not** a lint issue. → Phase 10: focused fix + regression test. Parked out of all lint batches deliberately.

## 7. Baseline claim

The app **typechecks, tests (38), and builds clean** on this branch. That is a
green *build* baseline — **not** a production-readiness certification. Security,
authorization, payment-integrity, RLS, webhook/idempotency, storage-privacy and
concurrency have **not** yet been audited (Phases 1–9). No production-ready claim
is made at Phase 0.

