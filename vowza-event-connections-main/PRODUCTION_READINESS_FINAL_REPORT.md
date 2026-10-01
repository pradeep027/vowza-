# Vowza — Production Readiness Final Report

**Branch:** `chore/production-readiness-baseline` · **Base:** `main` · **Status:** hardening complete, pending deploy-ordered promotion of parked lockdowns.

This report consolidates the autonomous production-readiness execution (Phases A–P). It is the authoritative summary of what was hardened, what remains deliberately **parked** behind deploy ordering, and the known residual risks. It supplements — it does **not** replace — `PRODUCTION_READINESS_STATUS.md`.

---

## 1. Executive summary

The application was audited and hardened against the production-ready definition: booking state is not maliciously manipulable; financial values are not browser-controlled; payments cannot be falsely marked successful; refunds/earnings cannot be fabricated; there is no privilege escalation; vendors cannot self-approve; private documents are protected; RLS protects data; Edge Functions enforce authorization; critical writes are atomic/idempotent; critical flows are tested; migrations are additive and reversible.

All fixes follow an **additive-hardening** philosophy: close the hole now with a change that does not break the running frontend; the breaking companion (RLS/column lockdown, storage backfill, edge redeploy, SaaS wiring) stays **parked** until deploy ordering is satisfied. **No parked lockdown has been promoted automatically.**

**Verification posture (current):**
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npm test` (`vitest run`, full glob discovery) — **49 files / 1152 tests green**.
- `npm run build` (`tsc --noEmit && vite build`) — clean (benign chunk-size warning on VendorPackages/charts only).
- `npm run lint` — ~1590 findings, overwhelmingly `@typescript-eslint/no-explicit-any` in UI/chart/test code; tracked as non-blocking CI debt. Lint=0 was explicitly **not** the goal.

---

## 2. Methodology & invariants

- **Never trust browser-supplied authoritative values:** amounts, fees, commission, refund/advance/remaining amounts, payment_status, booking state, ownership IDs, role/approval fields. These are recomputed or enforced server-side.
- **Never expose service-role keys, payment secrets, or credentials** to the client.
- **Never weaken RLS** to make tests or the app pass.
- **Migration policy:** historical migrations are never edited; all changes are new, additive migrations with rollback. Breaking migrations are parked.
- **Commit policy:** small, reviewable commits — one unit per commit.
- **Change classification:** every change is labelled SECURITY FIX / BUG FIX / BEHAVIOR PRESERVATION / BUSINESS-RULE CHANGE.

---

## 3. Phase-by-phase outcomes

### A — Baseline & security audit
`084cea5` verified baseline status · `821b954` recorded audit findings · `0f9ebca` defined the remediation plan. Established the squash-baseline migration model (`supabase/migrations-archive/` + `CONSOLIDATED_MIGRATION.sql` = applied baseline; active `supabase/migrations/` are incremental).

### B — Booking financial authority (COMPLETE)
Server-authoritative booking creation across **all 15 category tables + generic `bookings` + admin event-package**, so prices/fees/totals are computed server-side rather than accepted from the browser. Both browser INSERT paths (menu modal **and** Checkout cart) were rewired per category.

Commits: band `f4a0596`, catering `fe18f72` (+ per-plate Book-Now routing fix `f69dcd1`), anchor `5e7978c`, decorator `e3ba0d8`, dancer `2e738da`, dj `085d235`, drone `6213470`, makeup `c0c7ca7`, mehendi `459428c`, priest `45dce2c`, rental `83e4a34`, singer `cc849ef`, videography `77e0578`, water `f649c9d`, banquet `5921975`; admin event-package `285a7aa`; generic bookings `0430ec5`. (Provider self-approval prevention seeded at `054793e`.)

### C — Booking status state machine (COMPLETE)
DB `BEFORE UPDATE` triggers enforce a legal status DAG and bind each transition to its authorized actor, across all booking tables. Commits: generic `0ae46ac`, category `96739b1`, photography `c87589a`, actor binding `69b39af`, photographer_id resolution `0cfae82`.

### D — Payment integrity (COMPLETE)
`ce1e8dc` — server-authoritative `complete_booking_service` RPC (completion + settlement). `vendor_settlements` RLS lockdown **PARKED**.

### E — Pay-advance / lifecycle (COMPLETE)
`ae3b5d3` — server-authoritative `pay_booking_advance` RPC (persists `advance_amount`, customer-bound, idempotent). Lifecycle-column lockdown **PARKED** (needs cancel/decline RPCs first).

### F — Document verification (COMPLETE)
`1000eb9` — additive `BEFORE UPDATE` trigger blocks direct provider self-verification/self-approval (42501) with NULL-uid/admin/owner-resubmit carve-outs. Column lockdown **PARKED**.

### G — Storage / KYC privacy (COMPLETE)
`666779b` — private `provider-kyc` bucket + owner/admin storage RLS; uploads store `*_path` + signed-URL review (legacy `*_url` fallback). Historical public-object backfill **PARKED**.

### H — Edge Function authorization (COMPLETE)
`8f1d267` — 6 edge functions verified sound; the dead, browser-trusting `create-booking` function neutralized to a 410 stub (no DB client / service-role / amount reads). `verify-document` is advisory (not a hole). Redeploy/undeploy **PARKED**.

### I — OTP / app-level verification (COMPLETE)
`86b8492` — service-start OTP confirmed already server-authoritative (bcrypt/CSPRNG/expiry/attempt-limit, service_role-only RPCs, JWT-derived vendor id); locked by an 11-test regression. Phone-registration OTP is cosmetic; real SMS wiring **PARKED** (credentials = STOP 1).

### J — Testing (COMPLETE)
`ce8dbf4` — `npm test` switched from a hand-maintained explicit file list (silently excluded 12 files / 482 tests) to `vitest run` full glob discovery. New `*.test.ts` files now run automatically.

### K — CI/CD quality gate (COMPLETE)
`6bd85ef` — `.github/workflows/quality.yml`: typecheck + full `npm test` + build are blocking; lint is non-blocking; no deploy/secrets in CI. PR trigger broadened to all base branches; `.nvmrc` = 24.

### L — Observability (COMPLETE)
`c9fcfc0` — `src/lib/observability.ts`: single `reportError` sink + global `error`/`unhandledrejection` handlers (installed in `main.tsx`), `ErrorBoundary` rewired. No network/secrets; real Sentry/Datadog transport via `setErrorSink` **PARKED** (DSN = STOP 1).

### M — Rate limiting (COMPLETE)
`38988de` — wired the baseline-but-unused distributed limiter (`rate_limits` + atomic `increment_rate_limit` RPC) into the un-throttled `ai-chat` Groq function via new `_shared/rateLimit.ts` (server-side key only; fail-open on infra error, closed on breach; 50/min authenticated; 429 + `Retry-After`). `generate-embedding` (admin-gated) and OTP functions (self-bound) deliberately left unthrottled.

### N — Type / ESLint debt at the trust boundary (COMPLETE)
`d91ec9f` — removed all 4 `any` under `supabase/functions/` (types-only, no runtime change). The ~1450 remaining `no-explicit-any` + 69 react-hooks-deps + 9 `@ts-ignore` in UI/chart/test code are tracked CI debt; a blind burn-down was judged risky churn with no security value. Edge functions are `tsc`-excluded (eslint-only).

### O — Perf/UX data-correctness fix (COMPLETE)
`befc0bb` — three admin surfaces queried the generic `bookings` table for a non-existent `total_amount` column (that table's money column is `amount`; only per-category `*_bookings` have `total_amount`). PostgREST rejected the column, so each query failed and admin booking counts/charts silently read **zero**. Fixed `useAdminStats`, `AdminAnalytics`, `AdminDashboardHome` to `amount` + static regression test. `useVendorData` was already correct.

### P — Documentation (this report)
Final consolidation of the above.

---

## 4. Parked items (require deploy ordering — do NOT promote out of order)

Each item below closes an attack surface at a layer that is **not yet live**. Promoting it before the trusted backend and the deployed frontend agree would break the running product. **Promotion ordering is fixed and must never be reversed:** 1) trusted backend live → 2) frontend deployed → 3) verify the served production bundle → 4) verify runtime → 5) promote the lockdown → 6) verify again.

1. **Edge function (re)deploy** — `supabase functions deploy` for `ai-chat` (rate limiting), `create-booking` (410 stub), and any other edge-fn redeploys. The code is committed; the deploy is parked.
2. **`vendor_settlements` RLS lockdown** (Phase D).
3. **Lifecycle-column lockdown** (Phase E) — blocked on cancel/decline RPCs existing first.
4. **Provider verification column lockdown** (Phase F).
5. **KYC storage** (Phase G) — historical public-object backfill + stripping the legacy `*_url` fallback once all consumers read `*_path`.
6. **Phase B financial/RLS lockdowns** — the breaking companions to the server-authoritative INSERT paths, un-promoted.
7. **Real SMS wiring** for phone-registration OTP (STOP 1 — credential approval).
8. **Real Sentry/Datadog transport** via `setErrorSink` (STOP 1 — DSN credential).
9. **Rate-limiting `generate-embedding` / OTP functions** — low value (already admin-gated / self-bound); parked by choice.
10. **~1450 `no-explicit-any` + react-hooks-deps + `@ts-ignore`** — documented, CI-tracked debt; lint=0 is not the goal.

## 5. Residual / known risks (noted, not yet actioned)

- `dancer_bookings` has no customer `UPDATE` RLS policy.
- The generic `bookings` `UPDATE` policy lacks a `WITH CHECK` and applies to `PUBLIC` — flagged; must **not** be weakened, needs a tightening migration.
- Self-booking prevention is not enforced on the live per-category RPC path.
- `verify-document` is advisory / fail-open by design (not a hole, but noted).

## 6. STOP conditions encountered

Work paused only where the mandate requires human/credential input: real SMS provider credentials (Phase I) and the observability DSN (Phase L). All other safe work continued autonomously.

## 7. Pre-production deployment checklist

1. Deploy the trusted backend (RPCs + triggers already in migrations) and run the migrations.
2. Deploy the frontend; verify the **served** production bundle by its marker (asset hashes and cached HTML can lie — grep the served bundle).
3. Verify runtime behaviour of booking creation, payment, advance, completion, and admin dashboards.
4. Deploy edge functions (`ai-chat`, `create-booking` stub).
5. Promote parked lockdowns **one at a time**, in the fixed order, re-verifying after each.
6. Wire real SMS + observability transport once credentials are approved.

---

*Generated as Phase P of the autonomous production-readiness execution. See `MEMORY.md` phase pointers and the per-phase regression tests under `src/lib/__tests__/` for the authoritative detail behind each line above.*


