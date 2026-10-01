# Vowza — Production Readiness Final Report

**Branch:** `chore/production-readiness-baseline` · **Base:** `main` · **Status:** hardening complete; apply-path migrations + 4 edge functions **DEPLOYED to prod**; GitHub history reconciled & pushed; parked lockdowns still deliberately un-promoted pending deploy-ordered live verification.

This report consolidates the autonomous production-readiness execution (Phases A–P). It is the authoritative summary of what was hardened, what remains deliberately **parked** behind deploy ordering, and the known residual risks. It supplements — it does **not** replace — `PRODUCTION_READINESS_STATUS.md`.

---

## 0. Deployment & reconciliation status update (2026-10-02)

Since the Phase-P consolidation below was written, the gated deployment and GitHub-history work advanced. This section is the current truth; §1–§7 remain the historical A–P record.

**Reconciliation work (DONE, pushed):**
- `main` was merged into this branch (merge `c054491`) to carry the Hindsight planner feature (`planner-memory` edge fn, `eventScope`, `event_scope_identity` migration, 3 test files) that landed on `main` via PR #26. Conflict-free.
- A **duplicate migration version** `20261204000000` (shared by `provider_verification_authority.sql` and `event_scope_identity.sql`) was de-collided in commit `332c1a7`. Push-lineage evidence proved production recorded `20261204000000` = **`provider_verification_authority.sql`** (in every prod-push ancestor), while `event_scope_identity.sql` (main-only, never a push ancestor) was **never applied**. The applied migration keeps its version untouched; the unapplied `event_scope_identity.sql` was re-timestamped to **`20261204000001`** (pure rename, no SQL change) — unique, still ordered after its creator `20261203000000_event_states.sql`. Zero duplicate versions remain in the apply path.
- Four migration-apply robustness fixes (`2e54d2f`, `70efc80`, `0e5be09`, `de58f1d`) that remove a `SET LOCAL ROLE` push-session artifact (spurious `42501` under the `db push` login role) are included; probes now drive `auth.uid()` via `request.jwt.claims`.

**Apply-path migrations (DEPLOYED):** `supabase db push` has been run against prod (ref `vavfeataqwwbpjonknne`); `supabase migration list` confirms remote-applied through `20261251000000` (all of 204..251). This means the Phase B–F server-authoritative RPCs/triggers, the **P0-L** legacy-RPC lockdown (`20261246000000`), the **self-booking RPC-path guard** (`20261247000000`), the `add_artist` price authority (`20261248000000`), the `dancer_bookings`/generic UPDATE policies (`20261249000000`/`20261250000000`), and the executable probes (`20261251000000`) are now **live in production** — their §5 status advances from `PENDING-DEPLOYMENT` to **LIVE**. The executable probes applied clean (no `PROBE_FAIL`), which is the live-DB proof §5 flagged as `REQUIRES-LIVE-VERIFICATION`.

**Edge functions (DEPLOYED):** 4 hardened functions deployed — `create-booking` v5 (410 stub), `verify-document` v9 (auth gate + `advisory:true`), `ai-chat` v18 (rate-limited), `send-service-start-otp` v6. No new secrets required. `delete-account` is invoked by the deployed bundle but **not deployed** → latent 404 (pre-existing `main`-side gap, out of hardening scope).

**Live boundary smoke (GREEN):** non-mutating negative curl probes against the deployed edge functions behaved exactly as designed (create-booking anon+tampered → 410; no-auth → 401; verify-document/ai-chat anon-key-only → 401).

**Still PARKED / NOT done (unchanged — deliberately):** none of the `supabase/migrations-pending/` column/RLS lockdowns (20 PHASE_* files + README) have been promoted. SMS and Sentry/Datadog credentials remain STOP-1. Positive authenticated-session edge paths (verify-document success, ai-chat 50/min 429) still **REQUIRE-LIVE-VERIFICATION** with a real end-user JWT.

**Verification (post-reconciliation):** `npm run typecheck` clean · `npm test` **59 files / 1243 tests green** · `npm run build` clean. New HEAD = `332c1a7`.

---

## 1. Executive summary

The application was audited and hardened against the production-ready definition. The work drives toward these invariants: booking state is not maliciously manipulable; financial values are not browser-controlled; payments cannot be falsely marked successful; refunds/earnings cannot be fabricated; there is no privilege escalation; vendors cannot self-approve; private documents are protected; RLS protects data; Edge Functions enforce authorization; critical writes are atomic/idempotent; critical flows are tested; migrations are additive and reversible.

**These invariants are not all fully enforced yet — this is the honest status, not a READY verdict.** The server-authoritative write paths, state-machine triggers, and settlement/advance RPCs are committed and in the apply path, but the *breaking* companions that actually close the direct-write holes (the RLS/column lockdowns in §4) remain **parked** and have **not** been verified against a live database. Until they are promoted in deploy order, the financial-authority / self-approval / RLS hardening is closed **in code and migration** but is **not yet enforced in production**. The previously-open in-scope P0 — **P0-L** (legacy `PUBLIC EXECUTE` RPCs, §5) — is now **remediated in code on the apply path** (migration `20261246000000`, commit `769329d`): unlike the §4 lockdowns it is *not* parked, because revoking anon EXECUTE and enforcing self/ownership does not break the authenticated bundle. It is **fixed-in-code / pending deployment** — it closes in production on the next `supabase db push` (not yet run).

All fixes follow an **additive-hardening** philosophy: close the hole now with a change that does not break the running frontend; the breaking companion (RLS/column lockdown, storage backfill, edge redeploy, SaaS wiring) stays **parked** until deploy ordering is satisfied. **No parked lockdown has been promoted automatically.**

**Verification posture (current):**
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npm test` (`vitest run`, full glob discovery) — **59 files / 1243 tests green** (was 51/1175 at Phase-P write time; the merge from `main` added the Hindsight test files — see §0).
- `npm run build` (`tsc --noEmit && vite build`) — clean (benign chunk-size warning on VendorPackages/charts only).
- `npm run lint` — ~1590 findings, overwhelmingly `@typescript-eslint/no-explicit-any` in UI/chart/test code; tracked as non-blocking CI debt. Lint=0 was explicitly **not** the goal.

> **Note:** §0 (top) records deployment/reconciliation progress made *after* this Phase-P posture was written — apply-path migrations and 4 edge functions are now live in prod, and several §5 items have advanced from `PENDING-DEPLOYMENT` to `LIVE`.

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
`8f1d267` — 6 edge functions verified sound; the dead, browser-trusting `create-booking` function neutralized to a 410 stub (no DB client / service-role / amount reads). `verify-document` is advisory (not a hole); subsequently hardened in the PR #26 pass (`c114986`) to require an authenticated user + fail closed — see §5a. Redeploy/undeploy **PARKED**.

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

## 5. Residual / known risks — with exact status

**Status labels used below:** `FIXED-IN-CODE` (change committed to this branch, proven by regression tests) · `PENDING-DEPLOYMENT` (fixed-in-code but only takes effect in production after a gated `supabase db push` / edge deploy / frontend ship — not yet run) · `REQUIRES-LIVE-VERIFICATION` (correctness can only be confirmed against a populated live DB; empty CI/shadow DBs skip) · `OPEN` (not remediable with the current architecture / deliberately not actioned).

### 5a. PR #26 final-review P1 findings (this hardening pass)

- **`add_artist_to_event.p_price` browser-supplied price — `FIXED-IN-CODE` / `PENDING-DEPLOYMENT`.** The legacy `add_artist_to_event` RPC trusted a browser-supplied `p_price`. Migration `supabase/migrations/20261248000000` (commit `ed20289`) recreates it to derive the authoritative line price from the trusted package/`provider_profiles` data server-side and ignore the client value; an apply-time probe proves a tampered price is overridden. Locked by a tampering regression test. Closes in production on the next `supabase db push`.
- **`verify-document` authentication + fail-closed — edge: `FIXED-IN-CODE` / `PENDING-DEPLOYMENT`; client: `FIXED-IN-CODE`; strong KYC: `OPEN` (architectural).** Edge (commit `c114986`) now requires an authenticated end-user (`auth.getUser()` on the forwarded JWT → `401`; the anon key alone no longer qualifies), rejects a body `userId` that is not the caller (`403`), and stamps every result `advisory: true`. The client fails CLOSED — a server error/empty result returns `error`, never `verified`. The edge change is `PENDING-DEPLOYMENT` (edge deploy is parked under Phase H); the client change ships with the frontend. **Strong KYC remains `OPEN` by architecture:** the function never receives the document bytes (local-OCR summary only), so it cannot confirm authenticity — the status is advisory, and real trust is enforced downstream by admin approval + the Phase F self-approval trigger. Documented inline; a fabricated `verified` grants no capability. Locked by a 10-test regression.
- **Generic `bookings` `UPDATE` policy (`PUBLIC`, no `WITH CHECK`) — `FIXED-IN-CODE` / `PENDING-DEPLOYMENT`.** Not an active hole (anon is revoked at the table grant and Postgres reuses `USING` as the new-row check), so this was defense-in-depth. Migration `supabase/migrations/20261250000000` (commit `1f9aba2`) recreates the same-named policy with the same ownership predicate but scoped `TO authenticated` and with an explicit `WITH CHECK` = `USING`; an anon-denied probe + a `pg_policies` catalog assertion prove the shape at apply time. No financial-column lockdown (that is the parked Phase B companion). Closes on the next `supabase db push`.
- **`dancer_bookings` missing customer `UPDATE` policy — `FIXED-IN-CODE` / `PENDING-DEPLOYMENT`.** Determined to be a real authorization-parity gap (every other category grants the booking customer a scoped UPDATE), not an intentional omission. Migration `supabase/migrations/20261249000000` (commit `85686fe`) adds a customer `UPDATE` policy bound to `auth.uid() = customer_id` in both `USING` and `WITH CHECK` — not a permissive catch-all; the status-DAG trigger still constrains which transitions are legal. Closes on the next `supabase db push`.
- **Executable negative security probes — `FIXED-IN-CODE` / `PENDING-DEPLOYMENT`; proof itself `REQUIRES-LIVE-VERIFICATION`.** Migration `supabase/migrations/20261251000000` (commit `be40105`) adds a schema-neutral apply-time gate driving three negatives through the real RPC/trigger path on `dancer_bookings`: self-booking rejected `42501`, stored `total_amount` equal to the authoritative package price, and an illegal `pending → completed` jump rejected `23514`. Each probe skips cleanly on an empty CI/shadow DB and discards any seeded row via a `ROLLBACK_PROBE` sentinel. Because the probes only exercise against real fixtures, the executable proof is `REQUIRES-LIVE-VERIFICATION`; its shape is locked by a 9-test static regression. A failed invariant aborts the `db push`.

### 5b. Earlier residuals

- **P0-L (REMEDIATED IN CODE — apply path, pending deployment):** the legacy `SECURITY DEFINER` RPCs `create_event_booking`, `add_artist_to_event`, and `update_artist_booking_status` were created with the default **`PUBLIC EXECUTE`** and no internal auth check (per `PRODUCTION_SECURITY_REMEDIATION_PLAN.md` §6, flagged REPO/LIVE-VERIFIED), so any `anon` caller could create/modify artist & event bookings unauthenticated. `src/pages/EventPlanning.tsx` is a **live caller** of the first two (lines 154, 169), so the functions are not dead code. Migration `supabase/migrations/20261246000000_revoke_legacy_booking_rpc_public_execute.sql` (commit `769329d`) now `CREATE OR REPLACE`s all three with a fail-closed `auth.uid()`/ownership/actor guard (`42501`), `REVOKE`s EXECUTE from `PUBLIC`/`anon`, `GRANT`s only `authenticated`/`service_role`, and proves it at apply time with role probes (anon → denied, foreign-customer → denied, non-owner → denied, non-actor → denied, legitimate self → succeeds-and-rolls-back). It is placed on the **apply path (not parked)** because it does not break the authenticated `EventPlanning` flow — only the unauthenticated/foreign path is closed. **Status: fixed-in-code; closes in production on the next `supabase db push` (not yet run).** Locked by a 14-test static contract regression. Residual noted: `add_artist_to_event`'s `p_price` was still browser-supplied on this legacy path (a value-authority gap out of P0-L authz scope) — now remediated separately, see §5a (`20261248000000`).
- **Self-booking on the RPC path (REMEDIATED IN CODE — apply path, pending deployment):** the universal "a vendor cannot book their own package" rule lived in production only as per-table INSERT RLS policies (`migrations-archive/20260918000000_prevent_self_booking.sql`). Phase B moved booking creation onto per-category `create_<cat>_booking()` functions, which are `SECURITY DEFINER` and bypass RLS — silently re-opening self-booking on the live path (verified in `create_dancer_booking` / `create_catering_booking`: they force `customer_id = auth.uid()` but never check provider ownership). Migration `supabase/migrations/20261247000000_prevent_self_booking_on_rpc_path.sql` (commit `f04f919`) installs one shared `SECURITY DEFINER` `enforce_booking_no_self_booking()` + a `BEFORE INSERT` row trigger on each of the 15 category tables that received a Phase B RPC and carried the archived policy; triggers are not bypassed by `SECURITY DEFINER`, so the rule now holds on the RPC path and any residual direct INSERT. It blocks only a proven self-booking (caller owns the booked `provider_profile`) with `42501`; a NULL `auth.uid()` (service_role) and every legitimate customer pass unchanged — hence **apply path, not parked**. Out of scope (documented): `photography_package_bookings` (still a direct INSERT, archived RLS still fires), generic `bookings` and `admin_event_package_bookings` (never had a self-booking rule). **Status: fixed-in-code; closes in production on the next `supabase db push` (not yet run).** Locked by a 9-test static contract regression.
- `dancer_bookings` customer `UPDATE` policy, generic `bookings` `UPDATE` scope, and `verify-document` auth/fail-open — **all three were listed here previously and are now remediated this pass; see §5a for their exact status.**

## 6. STOP conditions encountered

Work paused only where the mandate requires human/credential input: real SMS provider credentials (Phase I) and the observability DSN (Phase L). All other safe work continued autonomously.

## 7. Pre-production deployment checklist

1. Deploy the trusted backend (RPCs + triggers already in migrations) and run the migrations. This `db push` also applies the P0-L lockdown (`20261246000000`), which closes the legacy `PUBLIC EXECUTE` hole; its embedded probes abort the apply if any unauthorized call is not rejected.
2. Deploy the frontend; verify the **served** production bundle by its marker (asset hashes and cached HTML can lie — grep the served bundle).
3. Verify runtime behaviour of booking creation, payment, advance, completion, and admin dashboards.
4. Deploy edge functions (`ai-chat`, `create-booking` stub, and the hardened `verify-document` — now auth-gated per §5a).
5. Promote parked lockdowns **one at a time**, in the fixed order, re-verifying after each.
6. Wire real SMS + observability transport once credentials are approved.

---

*Generated as Phase P of the autonomous production-readiness execution. See `MEMORY.md` phase pointers and the per-phase regression tests under `src/lib/__tests__/` for the authoritative detail behind each line above.*


