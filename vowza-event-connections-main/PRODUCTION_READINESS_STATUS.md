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

---

# 8. Phase 2–3 Security Audit (READ-ONLY — repo evidence, no changes)

**Date:** 2026-09-22 · **Method:** static analysis of the 26 active migrations,
109 archived migrations (principally `CONSOLIDATED_MIGRATION.sql`), the 3 loose
root SQL files, the 8 Edge Functions, and frontend write call-sites. **No
application code, RLS, or DB state was modified.** Financial/security invariants
that cannot be resolved from the repo are listed as UNKNOWN (Rule 9/10), not guessed.

## 8.0 The one architectural fact that governs everything

The active migration folder is a **corrective security sweep** (`20261201000002`–
`20261203000000`) layered over a baseline defined in the **archive**
(`CONSOLIDATED_MIGRATION.sql`) and mutated by **three loose SQL files** run by hand
in the Supabase SQL editor. The repo is **not self-contained**: the true production
state is `baseline + loose files + sweep`, applied in an order the repo cannot prove.
The `20261201000002` migration header **quotes the production schema dump verbatim**
(`GRANT ALL ON user_roles TO anon`, `make_admin(uuid)` granted to anon) — proving the
dangerous grants from the loose files **were live in production at dump time**. The
sweep is designed to undo them, and its migrations carry in-transaction probes that
`RAISE EXCEPTION` (abort) if the escalation is still open — so **if the sweep ran, the
role escalation is provably closed. Whether the sweep is applied to live prod is the
central UNKNOWN.**

## 8.1 CRITICAL findings (survive the sweep; repo-confirmed)

### P0-1 — Booking financial + status fields are client-authoritative (write AND update)

Two independent paths let a malicious authenticated browser own a booking's money:

- **At creation:** `src/hooks/useBookings.ts:654-681` inserts into `bookings` directly
  from the client with a **client-supplied `amount`** and `platform_fee: 0` hardcoded.
  The `create-booking` Edge Function is worse — it writes `base_amount`/`addons_amount`/
  `total_amount` **verbatim from the request body** (`create-booking/index.ts:162-165`)
  and fetches the package **without its price column** (`:106-110`). No server-side
  recompute from a trusted price record exists on either path. A user can book a
  ₹500,000 package for ₹1.
- **After creation:** baseline policy `"Booking parties can update"`
  (`CONSOLIDATED_MIGRATION.sql:669`) is `FOR UPDATE USING (customer_id=auth.uid() OR
  provider-owns) ` with **NO `WITH CHECK` and NO column guard**. It is **never dropped
  or replaced in the active sweep**, and there is **no financial-column trigger** on
  `bookings` anywhere (active grep = empty). `authenticated` retains `GRANT ALL`.
  → An owner can `UPDATE` their booking's `status`, `total_amount`, `advance_amount`,
  `platform_fee`, `provider_amount`, `payment_status` to any value via the JS client.
- The app sets `status` client-side (`useBookings.ts:737` cancel path writes
  `{status:'cancelled'}` across ~16 category tables + `bookings`), confirming **there is
  no server-side booking state machine** — transitions are browser-driven.
- **Category booking tables** (`catering_bookings`, `dj_bookings`, `drone_bookings`,
  `videography_bookings`, `decorator_bookings`, `singer_bookings`, … 16 total) repeat the
  pattern: `_customer_update`/`_provider_update` policies enforce **row ownership only**;
  where a `WITH CHECK` exists it re-checks ownership, never columns (`CONSOLIDATED` 4707–
  5199). Same tamper class. RLS does **not** restrict which columns change — this is the
  single most misunderstood point and why "RLS is enabled" ≠ safe.

### P0-2 — Vendor can self-approve / self-verify (authenticated owner UPDATE)

Baseline policy `"Providers can update own profile"` (`CONSOLIDATED:653`,
`FOR UPDATE USING (auth.uid()=user_id)`, no `WITH CHECK`, no column guard) **survives
the sweep**: `20261201000005` only *adds* an admin write policy
(`provider_profiles_admin_write_v2`, `:240`) and `20261201000006` only drops the public
*SELECT* policy (`:223`). No active migration replaces the owner-UPDATE policy and no
verification-column trigger exists. The sweep's own probe closes the **anon** update door
but explicitly leaves the authenticated-owner door (`"…is_verified and is_published live
on that table, so the vendor-verification bypass is still open"` — anon-scoped only).
→ A logged-in vendor can `UPDATE` their own `provider_profiles` row setting
`verification_status='approved'`, `is_verified=true`, `is_published=true`,
`is_featured=true`, bypassing the `approve_artist` RPC gate and appearing as a verified,
featured, published vendor in the marketplace.

### P0-3 — Document/KYC verification is client-decided (verify-document Edge Function)

`verify-document/index.ts` performs **no `getUser()` and no authz** (`:127-153`); the
gateway only requires *some* JWT. `userId` arrives in the body and is never compared to
the token (`:55`). The "verification verdict" branches entirely on client-supplied
`detectedType`/`hasValidAadhaarNumber`/`confidence` (`:58-125`); the "core security gate"
compares two client strings (`:84`). A caller posts
`{expectedType:"aadhaar", detectedType:"aadhaar", confidence:99}` and receives
`status:"verified"`. No server-side OCR. KYC is security theater. (Writes nothing itself,
but any consumer that trusts its verdict inherits the forgery.)

## 8.2 Booking security findings (summary)

| Concern | Repo evidence | Verdict |
|---|---|---|
| Amount trusted from browser at insert | `useBookings.ts:664`, `create-booking:162-165`, pkg fetched w/o price `:106-110` | **P0 — broken** |
| Amount/status mutable after insert | `bookings` UPDATE policy `CONSOLIDATED:669` (no WITH CHECK/guard), never replaced | **P0 — broken** |
| Server-side state machine | none — `useBookings.cancelBooking` sets status client-side across 17 tables | **Absent** |
| Category tables column protection | ownership-only policies, no column guard (`CONSOLIDATED` 4707–5199) | **P0 — broken** |
| `platform_fee` integrity | hardcoded `0` client-side at insert; mutable after | **P0 — broken** |

## 8.3 Payment security findings (summary)

- `payments` table has **NO write policy** in active or archive migrations → default-deny
  under RLS → **writes are service-role-only** (Edge Functions). Financial writes to
  `payments` are correctly server-authoritative. **GOOD** — aligns with Rule 3.
- Caveat: `payments` is **not** in the `20261201000005` REVOKE list, so if the loose-file
  `GRANT ALL … TO anon` on `payments` was ever applied AND RLS were later disabled on it
  (loose files also `DISABLE ROW LEVEL SECURITY` broadly), the default-deny protection
  evaporates. Confirm live RLS-enabled + grants on `payments`. (UNKNOWN, see 8.7.)
- The real payment-integrity gap is upstream: `bookings.total_amount` etc. are attacker-
  controlled (P0-1), so any payment/commission/payout math reading them is poisoned even
  though the `payments` row itself is written server-side.

## 8.4 Role / authorization findings — the sweep is EXCELLENT here (category 1)

`20261201000002` + `20261201000004` are exemplary and, **if applied**, provably close the
admin-escalation P0 (in-migration probes abort otherwise):
- `user_roles`: anon loses all writes; `authenticated` INSERT/DELETE constrained to
  `role IN ('customer','provider')` with actor check; UPDATE revoked; wide-open loose
  policies dropped; `make_admin`/`make_provider` dropped; `approve_artist`/`reject_artist`
  made **service_role-only** (were granted to anon by the loose files).
- Admin role changes now go through `admin_set_user_role` (service_role-only, super_admin
  required, actor from verified JWT in the `admin-user-roles` Edge Function, fully
  audited). This is the correct shape.
- **Residual (tracked, acknowledged in-migration):** an authenticated user can still
  self-grant `provider` and grant `provider` to others — bounded, because a provider role
  alone lists nothing without a verified+published `provider_profiles` row… **except**
  P0-2 lets a vendor self-verify+publish that very row. **P0-2 + this residual compose
  into a full self-onboarding-as-verified-vendor path.** Flag this composition explicitly.

## 8.5 Edge Function findings (8 functions)

| Function | Auth | Authz | Service-role | Trusts client for | Verdict |
|---|---|---|---|---|---|
| **create-booking** | JWT (customer=JWT) | self-booking block only | key + caller-Auth override (RLS applies, fragile) | **amount/base/addons/total** | **P0** |
| **verify-document** | gateway JWT only | **none** | none | entire verdict | **P0/HIGH** |
| admin-user-roles | JWT (actor=JWT) | delegated to RPC (super_admin) | genuine | allowlisted; actor is JWT | Sound *iff* RPC gates (it does) |
| delete-account | JWT | self-only by construction | genuine | nothing | **SAFE** |
| generate-embedding | JWT | explicit `admin` check `:102-109` | genuine (post-check) | `provider_id` only | **SAFE** |
| send-service-start-otp | JWT (vendor=JWT) | delegated to RPC | genuine | table allowlist only; OTP never returned | Sound *iff* RPC gates |
| verify-service-start-otp | JWT (vendor=JWT) | delegated to RPC | genuine | table allowlist + `/^\d{6}$/` | Sound *iff* RPC gates |
| ai-chat | `verify_jwt=false`; in-fn `getUser()` | authenticated-only | none | messages only | LOW (no rate limit → cost abuse) |

- **Latent (MED):** `create-booking` builds a **service-role** client but layers the
  caller's `Authorization` header on top (`:81-89`); PostgREST resolves the caller under
  RLS today, but removing that override silently becomes a full RLS bypass on every insert.
- OTP + admin-role functions delegate the real authz to Postgres RPCs
  (`create_service_start_otp`, `verify_service_start_otp`, `admin_set_user_role`). The
  admin RPC body is in-repo and verified-good (8.4). The two OTP RPC bodies are in
  migrations not yet read → **UNKNOWN** whether they bind the caller to the assigned vendor.
- **LOW:** wildcard CORS on ai-chat / generate-embedding / both OTP functions.

## 8.6 Storage findings

- `20261024000000_fix_provider_media_storage_rls.sql` exists (provider media bucket RLS).
  Not yet line-audited this phase → treat as **partially reviewed**; confirm owner-scoping
  and public-read intent on provider media / KYC document buckets. KYC docs (feeding
  P0-3) must not be publicly readable. → carry into remediation review.

## 8.7 UNKNOWN until live Supabase inspection (do NOT guess — Rule 9/10)

1. **Was the `20261201000*` sweep actually applied to prod, and after the loose files?**
   Governs whether the admin-escalation P0 and anon writes are closed. The sweep is
   self-verifying, so "applied" ⇒ "closed"; this is the single highest-value check.
2. **Live RLS-enabled state + grants on `payments`** (loose files `DISABLE`d RLS broadly and
   `GRANT ALL … anon`; `payments` is absent from the sweep's REVOKE list).
3. **RLS actually enabled on the 16 category booking tables** in prod. Repo shows enable
   logic only inside per-category archive system migrations (conditional `relrowsecurity`
   blocks); if any table has RLS off in prod, `authenticated`'s grant makes it fully open.
4. **The 2 OTP RPC bodies** (`create/verify_service_start_otp`) — do they bind caller→vendor?
5. Whether the loose root SQL files were re-run after the sweep (would reopen everything).

## 8.8 Three-category classification

- **(1) DEFINITELY enforced by tracked migrations (if sweep applied):** admin-escalation
  closed; anon writes revoked on core tables; `user_roles` write model; service-role-only
  role mutation + audit; `payments` default-deny writes; `event_states` owner-only CRUD;
  `delete-account`/`generate-embedding` Edge safety.
- **(2) ASSUMED by app/Edge but NOT enforced server-side:** booking amount/status/fee
  integrity (P0-1); vendor verification gate (P0-2); document verification (P0-3); booking
  state transitions; OTP vendor-binding (delegated, unverified).
- **(3) UNKNOWN until live DB:** everything in 8.7.

## 8.9 Per-table authorization matrix (repo evidence)

Legend: ✅ owner/role-scoped · ⚠️ row-scoped but **no column guard** · ❌ open/absent ·
🔒 service-role-only · S=SELECT I=INSERT U=UPDATE D=DELETE.

| Table | S | I | U | D | Ownership | Sensitive-field protection |
|---|---|---|---|---|---|---|
| `bookings` | ✅ party | ⚠️ I checks `customer_id` only | ⚠️ party, no WITH CHECK | party | row-level | ❌ amount/status/fee mutable |
| category `*_bookings` (16) | ✅ party | ⚠️ `customer_id` only | ⚠️ ownership only | ownership | row-level | ❌ amount/status mutable |
| `payments` | ✅ party | 🔒 no policy = deny | 🔒 deny | 🔒 deny | via booking | ✅ service-role-only writes |
| `provider_profiles` | public/admin (post-006) | ✅ `user_id` | ⚠️ owner, no WITH CHECK | admin | row-level | ❌ is_verified/is_published/status self-settable |
| `profiles` | own/admin | own | ✅ `auth.uid()=id` | admin | ✅ | (is_blocked self-settable — verify) |
| `user_roles` | own/admin (sweep) | ✅ role∈(cust,prov)+actor | 🔒 revoked | ✅ admin-only | ✅ | ✅ admin/super_admin unreachable from client |
| `event_states` | ✅ owner | ✅ owner | ✅ owner+WITH CHECK | owner | ✅ | ✅ well-secured |

## 8.10 Recommended remediation order (NOT yet implemented — awaiting go-ahead)

1. **Confirm the 5 UNKNOWNs (8.7) against live prod first.** No remediation should be
   designed on an unverified schema (Rule 9). Highest value: "did the sweep apply?"
2. **P0-1 booking money:** move amount derivation server-side — compute
   `base/addons/total` from trusted price records inside `create-booking` (ignore body
   amounts); add a `BEFORE UPDATE` trigger (or column-restricted policy) on `bookings` +
   all category tables forbidding client changes to `total_amount/advance_amount/
   platform_fee/provider_amount/status/payment_status`; introduce a server-side status
   state machine. Migration + rollback per Rule 7/8.
3. **P0-2 vendor self-approval:** replace `"Providers can update own profile"` with a
   column-restricted policy (or `BEFORE UPDATE` trigger) that blocks owner writes to
   `verification_status/is_verified/is_published/is_featured/verified_by/verified_at`;
   route approval solely through `approve_artist` (already service-role-only).
4. **P0-3 verify-document:** perform real server-side verification or stop trusting the
   client verdict; bind to `auth.getUser()`; never accept `userId` from body.
5. **P1:** OTP RPC vendor-binding (verify), `create-booking` service-role/Auth-override
   fragility, `payments` live-grant confirmation, storage bucket privacy for KYC docs.
6. **P2:** ai-chat rate limiting, wildcard CORS tightening, dual `vercel.json` + CSP/HSTS.

## 8.11 Validation (audit changed no application code)

This phase modified only this markdown doc (not in the app build graph). Baseline gates
from §1 remain the reference. Re-run to confirm no drift:
`npm run typecheck` · `npm test` · `npm run build` · `npm run lint`.

> **STOP CONDITION (honored):** No booking/payment/RLS/authz behavior was changed. The
> above is findings only. Await explicit go-ahead before implementing remediation.

