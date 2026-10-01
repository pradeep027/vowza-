# Production Security Remediation Plan — P0 Financial & Authorization Defects

Status: **DESIGN ONLY — NOT IMPLEMENTED.** This document is the deliverable for
the "draft remediation, do not implement yet" step. No RLS, booking, payment,
provider-approval, migration, or Edge Function behavior is changed by this file.
Implementation happens later, in small, separately committed batches, after the
five exact proposed changes at the end (§9) are reviewed and approved.

Companion audit: `PRODUCTION_READINESS_STATUS.md` (findings §1–§9, committed on
this branch). This plan turns the P0 findings into concrete architecture.

---

## Legend — evidence tags

Every factual claim below carries one tag so nothing is taken on faith:

- **LIVE-VERIFIED** — confirmed against the production database this session via
  read-only introspection (Supabase Management API `POST /database/query`,
  SELECT-only, token read from Windows Credential Manager, never printed). Ref
  `vavfeataqwwbpjonknne`.
- **REPO-VERIFIED** — confirmed by reading the current repo (migrations, Edge
  Functions, or `src/`) — the source-of-truth per Rule 9.
- **UNKNOWN** — not yet confirmed; explicitly flagged, never guessed (Rule 10).
  Each UNKNOWN names the exact introspection that resolves it before code lands.

---

## §0. Method & scope

Four P0 defect classes are addressed, plus one legacy-RPC P0:

- **P0-1** — Booking financial authority (client sets its own prices/amounts).
- **P0-1b** — Booking state-transition protection (client sets its own status).
- **P0-2** — Provider self-verification / self-publish / self-feature / reputation.
- **P0-3** — Document ("KYC") verification integrity (fabricated verdict).
- **P0-L** — Legacy RPCs with PUBLIC EXECUTE and no auth (artist/event bookings).

The unifying root cause is the same Supabase truth surfaced in the two Dec-2026
hardening migrations already in this repo: **RLS is row-level only; it has no
column dimension, and a permissive `FOR ALL` / `FOR UPDATE` policy with
`WITH CHECK NULL` lets a row's legitimate owner PATCH any column of that row,
including financial and status columns, straight through PostgREST.** The
established, in-repo remedy for exactly this is **column-level GRANT** plus
**SECURITY DEFINER RPCs** for the privileged transitions — not a deny-all
trigger. This plan applies that same proven pattern to bookings and to the
verification columns.

## §1. Protected-column taxonomy (Step 5 deliverable)

Step 5 requires the protected column list be documented *before* any code lands.
This section is that list. It is the contract every migration and RPC in §2–§6
enforces: a column is either **CLIENT** (the row's owner may PATCH it through
PostgREST) or **PROTECTED** (only a trusted server role / SECURITY DEFINER RPC
may write it). Classification is by *write* authority and is independent of read
visibility — several PROTECTED columns are deliberately still *readable* by anon
for the marketplace (migration `20261201000006`), which entitles no one to
*write* them. "Proposed writer" is the target state; every one of these is
currently client-writable (that is the defect §2–§6 close).

### §1.1 Booking tables — financial columns (P0-1)

Applies to the 16 category tables (`anchor_bookings` … `water_bookings`), the
generic `bookings`, and legacy `artist_bookings` / `event_bookings` /
`admin_event_package_bookings`. REPO/LIVE-VERIFIED category column set:
`base_amount`, `addons_amount`, `total_amount`, `advance_amount`,
`remaining_amount`; `photography_package_bookings` adds `album_amount` and uses
`photographer_id`; `rental_bookings` adds `inventory_reserved`. No category
table carries `platform_fee` or `payment_status` (LIVE-VERIFIED, RUN 5).

| Column | Class | Proposed writer |
|---|---|---|
| base_amount | PROTECTED | server, from package/hall/menu row |
| addons_amount | PROTECTED | server, from selected add-on rows |
| album_amount (photog) | PROTECTED | server, from package row |
| total_amount | PROTECTED | server, computed |
| advance_amount | PROTECTED | server, computed from policy % |
| remaining_amount | PROTECTED | server, computed (total − advance) |
| inventory_reserved (rental) | PROTECTED | server |
| quantity / guest_count | CLIENT | customer (input to server calc) |
| event_date, event_time | CLIENT | customer |
| notes, contact fields, address | CLIENT | customer |
| customer_id | PROTECTED | server = auth.uid() at insert |
| provider_id / photographer_id | PROTECTED | server, from package row |

### §1.2 Booking tables — state / lifecycle columns (P0-1b)

REPO-VERIFIED status domain (string literals in `src/`): `pending` → `in_progress`
→ `completed`, plus `cancelled`; provider accept/reject writes `status` directly
(`ProviderDashboard.tsx:242`), admin writes it on the generic table
(`admin/AdminBookings.tsx:55`). `payment_status` enum is
`pending | paid | refunded | failed` (`integrations/supabase/types.ts:10557`).
The lifecycle side-effect columns are written *alongside* `status` today by the
client with no server check.

| Column | Class | Proposed writer |
|---|---|---|
| status | PROTECTED | transition RPC (actor-checked) |
| payment_status | PROTECTED | payment-verify server path only |
| calendar_locked | PROTECTED | transition RPC |
| confirmed_at | PROTECTED | transition RPC (after paid) |
| advance_paid_at | PROTECTED | payment-verify server path only |
| work_started_at | PROTECTED | OTP service-start Edge Function |
| work_completed_at | PROTECTED | OTP complete server path |
| settlement_status | PROTECTED | settlement server path |

### §1.3 provider_profiles — verification / reputation / payout (P0-2)

REPO/LIVE-VERIFIED. The 23 columns migration `20261201000006` withholds from
anon *read* overlap the write-protected set but are not identical: read-privacy
and write-authority are separate concerns. Write-protected set (a provider must
never PATCH these on their own row):

| Column(s) | Class | Proposed writer |
|---|---|---|
| is_verified, is_published, is_featured, featured_until | PROTECTED | admin RPC |
| verification_status, verified_at, verified_by | PROTECTED | admin RPC |
| rejection_reason, doc_verification_notes | PROTECTED | admin RPC |
| aadhaar_status, pan_status, govt_id_status | PROTECTED | admin/KYC server |
| aadhaar_verified_at, pan_verified_at, govt_id_verified_at | PROTECTED | admin/KYC server |
| liveness_* (5 cols) | PROTECTED | liveness server (if enabled) |
| average_rating, total_reviews, total_bookings | PROTECTED | reviews/bookings triggers |
| is_bank_verified | PROTECTED | admin/payout server |
| bank_* (5 cols), gst_number | SENSITIVE-CLIENT | owner writes own, but withheld from anon read |
| business/bio/pricing/media/hours/social | CLIENT | owner |
| vendor_details (jsonb) | CLIENT | owner (see §5 PII note) |

### §1.4 payments / photography_package_payments (P0-1)

LIVE-VERIFIED (RUN 5): `payments` has **no write RLS policy** — despite anon +
authenticated holding table-level INSERT/UPDATE/DELETE grants, RLS default-deny
means only SELECT (`Booking parties can view payments`) succeeds; all writes are
already service-role-only. This is the **correct** target model and the pattern
§2 extends to bookings. `amount` and `status` are therefore already PROTECTED at
the DB layer. No change needed to close the write hole here; the P0-1 work is to
route booking-amount writes through the same server-authoritative door.

### §1.5 worker_documents (P0-3)

LIVE-VERIFIED columns: `id, worker_id, document_type, document_url,
document_number, issued_date, expiry_date, verification_status` (default
`pending`), `rejection_reason, uploaded_at, verified_at, verified_by`.
REPO-VERIFIED: **zero rows are ever inserted from `src/`** — every reference is
in `services/adminVerification.ts`, which is never imported (dead code). The
`verification_status / verified_at / verified_by` columns are PROTECTED (admin
only) by design; the P0-3 exposure is not this table but the client-trusted
verdict path in §5.

---

## §2. P0-1 — Booking financial authority

### §2.1 Current vulnerability (REPO/LIVE-VERIFIED)

Every booking is created by a **client-side `.insert()`** that carries its own
money. The browser computes `total_amount`, `advance_amount` and
`remaining_amount` from a price it already holds and writes them straight to the
booking table via PostgREST; the row's INSERT RLS policy checks only
`customer_id = auth.uid()` (and "not booking your own provider profile"), never
the amounts. Representative, REPO-VERIFIED sites — the same idiom repeats across
all 16 category menus:

- `pages/Checkout.tsx:138` — writes `advance_amount`, `remaining_amount`,
  `status:'pending'` from client state.
- `components/SingerMenu.tsx:150` — `advance_amount`, `remaining_amount` computed
  in-browser then inserted.
- `components/{Anchor,Band,BanquetHall,Dancer,DJ,Decorator,Drone,Mehendi,Makeup,Priest,Rental,Videography,WaterSupply}Menu.tsx`
  and `pages/CateringCartPage.tsx` — each inserts with client amounts +
  `status:'pending'` (grep-confirmed at their ~line 200–320 insert blocks).
- `supabase/functions/create-booking/index.ts` — the one server path, but it
  **trusts the client-supplied amount fields** and does not re-fetch price from
  the package row (REPO-VERIFIED; exact request-body lines re-confirmed in §2.5).
- `services/bookingExecutionService.ts:224` — settlement `platform_fee` is
  `bookingAmount * platformFeeRate / 100` where **both `bookingAmount` and
  `platformFeeRate` are function arguments passed by the caller**, then written
  to `vendor_settlements`. Client-authored money reaches the payout ledger.

### §2.2 Attack scenario

1. Attacker opens any vendor's booking flow, intercepts the PostgREST `POST`
   (or calls it directly with the public `sb_publishable_` key from the bundle).
2. Sets `total_amount: 1`, `advance_amount: 1`, `remaining_amount: 0` — or
   `total_amount: 999999` to grief a vendor — and submits. RLS passes because
   `customer_id` is their own uid; the row is written verbatim.
3. At completion, `completeService` is called with `bookingAmount: 1`,
   `platformFeeRate: 0`; the vendor settlement records ₹1 owed, ₹0 platform fee.
   The platform is defrauded of its cut and the vendor of their fee base.

### §2.3 Root cause

RLS is row-level only. A permissive INSERT/UPDATE policy that checks
`customer_id = auth.uid()` with `WITH CHECK NULL` on the money columns lets the
legitimate owner write **any value** into `total_amount`/`advance_amount`/etc.
The database never derives price from a trusted record; it stores whatever the
browser sends. `create-booking` does not close this because it re-uses the
client's numbers instead of looking them up. This is the same column-blindness
root cause as P0-1b and P0-2 — here applied to money.

### §2.4 Proposed architecture — server-authoritative booking RPCs

Extend the **already-correct photography pattern**
(`create_photography_package_booking` / `checkout_photography_cart`, which fetch
the package price server-side) to every category. The smallest safe shape:

- **Client sends identifiers + choices only**: `provider_id`, `package_id`,
  selected `addon_ids[]`, `quantity`/`guest_count`, `event_date`, `event_time`,
  contact/notes. **No amount fields are accepted from the client.**
- **One SECURITY DEFINER RPC per category** (e.g. `create_anchor_booking(...)`),
  or a single dispatcher keyed by category. Inside, running as owner but
  `auth.uid()`-checked:
  1. `SELECT` the authoritative `base_amount` from the package/hall/menu row.
  2. `SELECT` and sum add-on prices from the trusted add-on rows by id.
  3. Compute `total_amount`, `advance_amount` (policy %), `remaining_amount`
     server-side; look up `platform_fee_rate` from a config table, not an arg.
  4. `INSERT` the booking with server-computed money and
     `customer_id = auth.uid()`, `status = 'pending'`.
  5. Return the created row. The whole body is one transaction (§2.6).
- **Lock the write door**: `REVOKE INSERT/UPDATE` on the money columns from
  `authenticated` (column-level GRANT idiom, §7), so a direct PostgREST insert of
  amounts is refused (42501). Benign columns keep their grants.
- **Settlement**: `completeService` must stop passing `bookingAmount` /
  `platformFeeRate`; the completion RPC reads the booking's server-written
  `total_amount` and the config fee rate, and computes the settlement itself.

### §2.5 create-booking Edge Function & transactionality

REPO-VERIFIED: `supabase/functions/create-booking/index.ts` reads amount fields
from the request body and writes them without a server-side price lookup; it is
therefore not a trust boundary today. Two viable end states:

- **(A) Fold into the DB RPCs** and retire the Edge Function's money handling —
  the RPC becomes the single authoritative writer. Preferred: keeps price
  derivation and the `INSERT` in one transactional SQL body, no cross-service
  round trip.
- **(B) Keep the Edge Function** but have it `getUser()` then call the same
  SECURITY DEFINER RPC with identifiers only. Acceptable if the function must
  stay for orchestration (notifications, Razorpay order creation).

**Transactionality**: creation today is multiple client round-trips (insert
booking → later update to `in_progress` → separate settlement insert), each
independently RLS-checked and individually forgeable. The RPC makes *creation*
atomic (price fetch + insert in one statement, no partial writes). Advance
payment and completion remain separate server steps but each becomes its own
authorized transition (§3), gated on real payment state rather than a client
PATCH.

### §2.6 Files / migrations / DB changes / compatibility / rollback

- **New migration** `2026MMDD######_booking_financial_authority.sql`: create the
  per-category `create_*_booking` SECURITY DEFINER RPCs (GRANT EXECUTE TO
  authenticated, **not** anon/PUBLIC); `REVOKE INSERT/UPDATE (base_amount,
  addons_amount, album_amount, total_amount, advance_amount, remaining_amount,
  inventory_reserved)` from `authenticated` on each booking table; add a
  `platform_config` (or reuse existing fee-rate source) read inside the RPC.
- **Frontend**: replace each `*Menu.tsx` / `Checkout.tsx` / `CateringCartPage.tsx`
  insert with an `rpc('create_*_booking', { identifiers })` call; drop all
  client amount computation from the submit path (keep it for *display* only).
  `bookingExecutionService.completeService` stops accepting/passing
  `bookingAmount`/`platformFeeRate`.
- **Compatibility risk**: column REVOKE breaks any surviving direct insert of a
  money column → deploy frontend FIRST (per memory: verify by bundle marker),
  then `supabase db push`. In-flight bookings already written are untouched
  (no data migration). `SELECT` is unaffected (REVOKE is INSERT/UPDATE only).
- **Rollback**: `GRANT INSERT/UPDATE (<cols>) ON <table> TO authenticated;` (a
  table-level or column-level GRANT restores the old write surface) and
  `DROP FUNCTION create_*_booking`. Frontend redeploy of the prior bundle. No
  destructive data change to reverse.

### §2.7 Test plan (P0-1) — proves the invariant, not coverage

- **Manipulated amount**: authenticated client calls `create_*_booking` — assert
  the stored `total_amount` equals the price derived from the package row, and a
  crafted extra `total_amount:1` in the payload is *ignored* (RPC does not accept
  it). Then a raw PostgREST `insert({... total_amount:1})` returns **42501**.
- **Manipulated advance / remaining**: assert `advance_amount` = policy % of the
  server total and `remaining_amount = total − advance`, regardless of any client
  values sent.
- **Manipulated platform_fee / vendor_amount**: drive `completeService`/completion
  RPC and assert settlement `platform_fee` and vendor earnings derive from the
  booking's stored `total_amount` and the config rate — a client-passed rate/
  amount cannot change them.
- **Add-on tampering**: pass an `addon_id` belonging to a *different* provider or
  a non-existent id — assert the RPC rejects it (does not price it in).
- These run against a disposable local/staging DB (never production, Rule 7).

---

## §3. P0-1b — Booking state-transition protection

### §3.1 Current vulnerability & actual state map (REPO-VERIFIED)

Every state change is a client `.update({ status: ... })` gated only by the
column-blind `<cat>_bookings_customer_update` / `<cat>_bookings_provider_update`
policies (and generic `bookings` "Booking parties can update", `WITH CHECK
NULL`). The client picks the target state *and* writes the lifecycle side-effect
columns. Actual states in use (string literals in `src/`):

`pending` → `in_progress` → `completed`; `cancelled` from either; plus provider
accept/reject and admin override. Side-effect columns: `calendar_locked`,
`confirmed_at`, `advance_paid_at`, `work_started_at`, `work_completed_at`,
`settlement_status`.

The most dangerous transition is **advance payment**: `MyBookings.tsx:156` (and
`customer/MyBookingsPage.tsx:347–351`) set `status:'in_progress'`,
`calendar_locked:true`, `confirmed_at`, `advance_paid_at` **with no payment taken
and no server verification** — the toast literally says "Advance paid! Booking
confirmed." after a bare PATCH. A customer confirms a booking and locks a
vendor's calendar for free.

### §3.2 Transition table (proposed authority)

| From → To | Actor | Required condition | Financial | Side effects |
|---|---|---|---|---|
| ∅ → pending | customer | auth; valid package | total/advance derived (§2) | row created |
| pending → in_progress | **payment server** | Razorpay advance **verified** | advance captured | calendar_locked, confirmed_at, advance_paid_at |
| pending → confirmed/rejected | provider | owns provider row | none | notify |
| in_progress → (work started) | OTP Edge fn | customer OTP verified | none | work_started_at |
| in_progress → completed | OTP complete server | status=in_progress; OTP done | settlement computed server-side | work_completed_at, settlement_status |
| any → cancelled | customer or provider party | party owns row; policy refund | refund computed server-side | calendar_locked=false |
| any → any | admin | has_role admin/super_admin | as applicable | audited |

### §3.3 Attack scenarios, root cause, proposed architecture

**Attacks**: (a) mark own `pending` booking `in_progress`/`confirmed` without
paying — free calendar lock + vendor obligation; (b) set `status:'completed'`
directly to trigger a settlement without service; (c) a booking party PATCHes
`payment_status:'paid'`; (d) cross-party: a customer edits a booking row whose
`provider_id` is someone else (blocked by `customer_id` predicate only if the
policy also constrains the *other* party — to verify).

**Root cause**: same column-blindness — the UPDATE policy authorizes the *row*,
not the *column* or the *target value*, and `WITH CHECK NULL` re-uses `USING`, so
any reachable party may set any state.

**Proposed** (mirrors §2 + the established SECURITY DEFINER idiom):

- `REVOKE UPDATE (status, payment_status, calendar_locked, confirmed_at,
  advance_paid_at, work_started_at, work_completed_at, settlement_status)` from
  `authenticated` on every booking table (column-level GRANT, §7). Benign
  columns (notes, contact, event_date pre-confirmation) keep their grant.
- **Transition RPCs** (SECURITY DEFINER, `auth.uid()`-checked) implement the
  §3.2 table: `confirm_booking_after_payment` (called only by the verified-
  payment server path, never the browser), `provider_respond_to_booking`
  (checks caller owns the provider row), `cancel_booking` (checks caller is a
  party; computes refund server-side), completion via the existing OTP server
  path. Each validates the **from-state** inside the transaction.
- Advance confirmation is decoupled from the browser entirely: only the
  Razorpay-verification server step may move `pending → in_progress`.

### §3.4 Concurrency & duplicate submission

- **From-state guard as an atomic predicate**: each transition RPC does
  `UPDATE ... SET status = <to> WHERE id = $1 AND status = <expected_from>` and
  checks the affected-row count. Two concurrent "confirm" calls: the first
  matches and updates, the second sees `status <> pending` and no-ops — no double
  transition, no lost update. This replaces the read-then-write race the current
  client PATCH has.
- **Idempotent payment confirmation**: `confirm_booking_after_payment` keys on
  the Razorpay payment id (unique constraint) so a webhook retry or double-submit
  cannot capture twice or re-lock.
- **Calendar lock** becomes a side effect of the *server* confirmation, so a
  duplicate submit cannot lock two slots.

### §3.5 Files / DB / compatibility / rollback

- **Migration** `2026MMDD######_booking_state_transitions.sql`: column REVOKE on
  the lifecycle columns; the transition RPCs; a unique index for payment
  idempotency. Additive PERMISSIVE policies unchanged for benign columns.
- **Frontend**: `MyBookings.tsx:150` (`handlePayAdvance`), `MyBookingsPage.tsx`,
  `MyBookings.tsx:182` / `useBookings.ts:689–737` (cancel), `VendorBookings.tsx:201`,
  `ProviderDashboard.tsx:242`, `admin/AdminBookings.tsx:55` → call the matching
  RPC instead of a direct `.update({ status })`. `bookingExecutionService.ts`
  completion already reads/writes server-side and mostly stays.
- **Compatibility**: deploy frontend first (RPC calls are backward compatible
  against the current wide grant), then push the REVOKE. In-flight rows keep
  their current status; no data migration.
- **Rollback**: `GRANT UPDATE (<cols>) ... TO authenticated;` + `DROP FUNCTION`
  the transition RPCs; redeploy prior bundle. Non-destructive.

### §3.6 Test plan (P0-1b)

- **Direct status write blocked**: authenticated PATCH `status:'in_progress'` →
  42501; PATCH `payment_status:'paid'` → 42501.
- **Free confirm blocked**: calling confirm without a verified payment id →
  rejected; booking stays `pending`, calendar not locked.
- **Illegal transition**: `completed` while `pending` → rejected (from-state
  guard). `completed` twice → second no-ops.
- **Concurrency**: two parallel confirms → exactly one succeeds (row-count
  assertion).
- **Cross-party**: customer A cannot transition customer B's / another vendor's
  booking → rejected. Legit customer/provider/admin transitions still succeed.

---

## §4. P0-2 — Provider self-verification / self-publish / self-feature

### §4.1 Current vulnerability (LIVE/REPO-VERIFIED)

`provider_profiles` carries a permissive owner-write policy `providers_owner_write`
(`FOR ALL`, `{public}`, `USING user_id = auth.uid()`, **`WITH CHECK NULL`**) plus
`"Providers can update own profile"` (`FOR UPDATE`, `WITH CHECK NULL`), and
`authenticated` holds **table-level UPDATE** (RUN 5 grants). Together these let a
vendor PATCH **any column of their own row** — including `is_verified`,
`is_published`, `is_featured`, `verification_status`, `verified_by`,
`verified_at`, `average_rating`, `total_bookings`, and the KYC `*_status`
columns.

Legitimate app code never does this from a provider path — the self-registration
insert hardcodes `verification_status:'pending'` (`ProviderRegistration.tsx`,
insert ~L338–350) and only the admin services below set approval columns — so
the exposure is the **grant/policy**, not application code. A vendor bypasses the
UI and calls PostgREST directly.

### §4.2 Attack scenario

Authenticated vendor sends `PATCH /provider_profiles?id=eq.<own>` with
`{ "is_verified": true, "is_published": true, "is_featured": true,
"verification_status": "approved" }`. RLS `USING user_id = auth.uid()` passes;
`WITH CHECK NULL` imposes no column constraint; the table-level UPDATE grant
permits every column. The vendor is now a verified, featured, published provider
in the public marketplace (`providers_public_read` shows
`verification_status IN ('approved','verified')`) with a self-set rating — no
admin ever reviewed them.

### §4.3 Root cause

Column-blind RLS + table-level UPDATE grant. Identical to P0-1/P0-1b; here the
protected columns are trust/reputation rather than money.

### §4.4 Legitimate admin approval flow (traced first, per Step 6)

Must keep working. REPO-VERIFIED writers of the protected columns:

- `services/approvalService.ts` — approve sets `verification_status:'approved'`,
  `is_published:true`, `is_verified:true`, `verified_at`, `verified_by`; reject
  (`:200–201`) sets `verification_status:'rejected'`.
- `pages/AdminDashboard.tsx:338–341` — sets `verification_status`,
  `rejection_reason`, `verified_at` by `user_id`; `:363` reject path.
- `services/adminVerification.ts:229–341` — **dead code** (never imported;
  confirmed by import grep), writes to `provider_profiles` + `worker_documents`.
- RLS admin doors today: `provider_profiles_admin_write_v2` (`{authenticated}`,
  `has_role admin/super_admin`) and `providers_admin_write` (`{public}`,
  user_roles admin). These rely on the table-level UPDATE grant.

### §4.5 Proposed architecture

- **Column REVOKE**: `REVOKE UPDATE (is_verified, is_published, is_featured,
  featured_until, verification_status, verified_at, verified_by, rejection_reason,
  doc_verification_notes, aadhaar_status, pan_status, govt_id_status,
  aadhaar_verified_at, pan_verified_at, govt_id_verified_at, liveness_*,
  average_rating, total_reviews, total_bookings, is_bank_verified)` from
  `authenticated` on `provider_profiles`. Benign profile columns keep UPDATE, so
  normal editing (`VendorEditProfile`, `useVendorData`) is unaffected.
- **Admin RPC**: because a column GRANT is role-level, revoking from
  `authenticated` also stops *admins* writing those columns directly. Move
  approval into `admin_set_provider_verification(p_user_id, p_status, ...)`
  SECURITY DEFINER, which checks `has_role(auth.uid(),'admin'|'super_admin')`
  internally, sets `verified_by = auth.uid()`, and is the only writer of the
  approval columns. `approvalService.ts` and `AdminDashboard.tsx` call this RPC
  instead of `.update(...)`. Drop dead `adminVerification.ts`.
- **Reputation columns** (`average_rating`, `total_*`) move to DB triggers/RPCs
  driven by the reviews and bookings tables, never a client write.

### §4.6 Files / rollback / tests

- **Migration** `2026MMDD######_provider_verification_authority.sql`: the column
  REVOKE + `admin_set_provider_verification` RPC + reputation trigger. Follows §7
  idiom (DO $catalog$ has_column_privilege assertions; DO $probe$ `SET LOCAL ROLE
  authenticated` proving a self-approval PATCH is refused; NOTIFY pgrst).
- **Rollback**: `GRANT UPDATE (<cols>) TO authenticated` + `DROP FUNCTION`;
  redeploy prior bundle. Non-destructive; approval rows already set are untouched.
- **Tests**: vendor PATCH `is_verified:true` / `is_published:true` /
  `verification_status:'approved'` → 42501; admin RPC approval still flips the
  columns and stamps `verified_by`; a non-admin calling the RPC → rejected;
  normal profile edit (bio, price) by the vendor still succeeds.

---

## §5. P0-3 — Document / KYC verification integrity

### §5.1 Current trust model (REPO-VERIFIED)

The entire "verification" verdict is client-authored:

- OCR, classification and confidence are computed **in the browser** with
  Tesseract (`utils/documentVerification.ts`: `classifyDocument` 169–271,
  `isValidAadhaarFormat` 275–283, `isValidPanFormat` 287–292).
- `documentVerification.ts:432` invokes the `verify-document` Edge Function with
  a **client-supplied** payload (433–447): `expectedType`, `detectedType`,
  `confidence`, `hasValidAadhaarNumber`, `hasValidPanNumber`, masked `ocrSummary`,
  `fileMetadata`, and `userId` (defaults to `'anonymous'`).
- `supabase/functions/verify-document/index.ts` has **no `getUser()` / no authz**
  (127–153); it trusts `detectedType`/`confidence`/`hasValid*` verbatim.
- The client response handler **fails open**: on any edge error it fabricates
  `status:'verified'` (450–470) rather than failing closed.
- The verdict is **advisory UI-gating only** — it never writes a KYC column. The
  sole DB write is `ProviderRegistration.tsx` insert (~338–350) which hardcodes
  `verification_status:'pending'`; approval stays admin-only (§4). `worker_documents`,
  `liveness_*` and the typed `*_status` columns are never written (dead targets).

### §5.2 The two real problems

1. **Fabricated verdict / fail-open**: nothing stops a caller asserting
   `detectedType:'aadhaar', confidence:1, hasValidAadhaarNumber:true`, or simply
   erroring the edge call to get a fabricated `verified`. The system must not
   *present* "verified" on client say-so.
2. **PII in a public bucket**: identity documents upload to the **PUBLIC**
   `provider-media` bucket (`ProviderRegistration.tsx` uploadDoc 327–331, path
   `docs/{userId}_{aadhaar|pan|govtid}_{ts}`) and their URLs are stored in
   `provider_profiles.vendor_details` (readable by anon, §1.3 note). Aadhaar/PAN
   scans are world-readable by URL.

### §5.3 Proposed trust boundary

Do **not** fabricate a third-party KYC integration (Step 7). Instead, make the
system honest about what it actually is — a document *classifier*, not an
identity *verifier* — and close the integrity holes:

- **Separate the two concepts**: rename/repurpose the client verdict to
  `document_classification` (type + OCR confidence, clearly advisory UX). Real
  identity/KYC status stays a **PROTECTED** column set an admin (or a future,
  clearly-labelled backend integration) sets — never the browser.
- **Bind identity in the Edge Function**: `verify-document` must call
  `getUser()` from the Authorization header and use *that* uid — ignore the
  client `userId` entirely (no more `'anonymous'`). Reject unauthenticated calls.
- **Ownership**: the function only ever classifies a document the caller owns;
  it never accepts another user's id or path.
- **Fail closed**: the client handler must treat an edge error as
  `unverified`/`error`, never fabricate `verified`.
- **Server-side classification (optional, later)**: if the type/confidence must
  be trustworthy, recompute them server-side from the stored file rather than
  trusting client `detectedType`/`confidence`. Not required to close P0-3;
  making the verdict advisory + non-authoritative is.
- **PII storage**: move identity docs to a **private** bucket with owner-scoped
  storage RLS (`bucket_id = 'provider-kyc' AND owner = auth.uid()`), serve via
  short-lived signed URLs to admins only, and stop writing document URLs into the
  anon-readable `vendor_details`. (Sequenced as its own migration — touches a
  live upload path.)
- **No sensitive-number logging**: keep the Edge Function logging to
  type/confidence/status only (currently 141–146); never log full Aadhaar/PAN.
  OCR summaries are already masked (455–461, 482–489) — keep that.

### §5.4 Files / DB / compatibility / rollback

- **Edge Function** `supabase/functions/verify-document/index.ts`: add
  `getUser()` auth + ownership; ignore client `userId`; return an explicit
  advisory classification, not an authoritative verdict.
- **Frontend** `utils/documentVerification.ts:432,450–492`: send the auth token,
  stop sending `userId`, and fail **closed** (no fabricated `verified`).
  `DocumentUploadCard.tsx:94` and `ProviderRegistration.tsx` step-4 handlers
  (840–865) consume the advisory result; the UI must not equate it with KYC.
- **Storage migration** (separate batch): create private `provider-kyc` bucket +
  owner-scoped policies; migrate existing `docs/*` objects; replace
  `vendor_details` doc URLs with private references. Deploy frontend upload
  change first.
- **Compatibility**: auth-binding the function rejects anonymous/legacy callers —
  confirm every caller is authenticated (registration is behind auth). Bucket
  privatization must not break admin review — signed URLs replace public URLs.
- **Rollback**: revert the Edge Function (redeploy prior version); the bucket
  change rolls back by re-opening read (not recommended) or restoring the prior
  policy. No booking/payment surface touched.

### §5.5 Test plan (P0-3)

- **Unauthenticated call** to `verify-document` → rejected (no `getUser`, no
  verdict).
- **Other user's document**: authenticated A cannot classify a doc owned by B.
- **Fabricated verdict**: payload `detectedType:'aadhaar', confidence:1,
  hasValidAadhaarNumber:true` for a garbage file does **not** yield an
  authoritative "verified" KYC state; the classification is advisory and no
  protected `*_status` column flips.
- **Fail-closed**: edge error → client shows `unverified`/error, never
  `verified`.
- **PII**: identity doc object is not retrievable via a public URL by an
  unauthenticated request; no full Aadhaar/PAN appears in function logs.

---

## §6. P0-L — Legacy RPCs with PUBLIC EXECUTE and no auth

### §6.1 Vulnerability (REPO/LIVE-VERIFIED)

`create_event_booking`, `add_artist_to_event` and `update_artist_booking_status`
are `SECURITY DEFINER` functions with **PUBLIC EXECUTE** (`=X/postgres` in
`proacl`) and **no internal auth check**. SECURITY DEFINER runs as the owner and
bypasses RLS, so *any* caller — including `anon` with the public
`sb_publishable_` key — can create/modify artist & event bookings and set their
status, unauthenticated. Contrast the GOOD model
`create_photography_package_booking` / `checkout_photography_cart`, which check
`auth.uid()` and fetch price server-side.

### §6.2 Proposed / files / rollback / tests

- **Migration** `2026MMDD######_revoke_legacy_rpc_public_execute.sql`:
  `REVOKE EXECUTE ... FROM PUBLIC, anon;` on all three; add an
  `auth.uid() IS NOT NULL` + actor/ownership check inside each (or GRANT EXECUTE
  only to `authenticated` and add the checks). If a function is dead (no `src/`
  or Edge caller), `DROP` it instead — confirm usage first (UNKNOWN, §10).
- **Rollback**: `GRANT EXECUTE ... TO PUBLIC;` restores prior (insecure) state;
  keep only as an emergency lever.
- **Tests**: anonymous `rpc('create_event_booking', ...)` → refused;
  authenticated non-owner cannot `update_artist_booking_status` on another's
  booking; a legitimate authenticated owner path still works (or, if dropped, no
  live caller regresses).

---

## §7. Migration idiom, sequencing & deploy discipline

Every migration in §2–§6 follows the **established in-repo pattern** proven by
`20261201000005` and `20261201000006`:

- Naming `2026MMDD######_*.sql`; wrap in `BEGIN; … COMMIT;`.
- `REVOKE` the table-level / broad grant from `PUBLIC, anon` (and, for write
  restriction, from `authenticated`) **first**, then `GRANT` back the benign
  allowlist at column granularity — a table-level grant *outranks* column grants,
  so it must be removed or the column grants are decorative.
- **`DO $catalog$`** assertions using `has_column_privilege()` / `aclexplode()` /
  `pg_attribute` — never `information_schema` (those views hide grants made by
  another grantor and a check that cannot fail is worse than none). Assert both
  "sensitive column withheld" and "benign column still works".
- **`DO $probe$`** with `SET LOCAL ROLE anon` (and a `SET LOCAL ROLE
  authenticated` probe for the write cases) that actually attempts the forbidden
  write and asserts `insufficient_privilege` (42501), and attempts the legitimate
  path and asserts it still succeeds. Verify by execution, not inspection.
- `NOTIFY pgrst, 'reload schema';` after `COMMIT`.
- A documented `ROLLBACK` header (the reverse `GRANT` + `DROP FUNCTION`).

**Deploy order (per memory, non-negotiable)**: ship the **frontend first** (RPC
calls + explicit column lists are backward-compatible against the current wide
grant), confirm the live bundle by **bundle marker** (asset hashes and cached
HTML lie), *then* `supabase db push`. The reverse order breaks the app the moment
a `REVOKE`/column restriction lands. Each P0 is its own separately-committed
batch (Step 10). Sequence: P0-2 and P0-L (self-contained, no client-flow change
beyond admin RPC calls) are lowest-risk; P0-1/P0-1b touch the live booking+
payment path and go last, behind their own verification. The KYC bucket
privatization (§5) is its own batch after the verdict fix.

---

## §8. Attack-oriented regression tests (Step 9)

These prove each **security invariant**, not coverage. Each runs against a
disposable local/staging DB (Rule 7); the DB-level ones are `DO $probe$` blocks
inside the migration (so the migration self-fails if the invariant is not met)
plus a `vitest` layer driving PostgREST/RPCs as a real authenticated user.

**Booking financial (P0-1)** — assert the server rejects or ignores:
- manipulated `amount` / `total_amount` (stored = server-derived, client value
  ignored; raw column insert → 42501);
- manipulated `platform_fee` (settlement derives from stored total + config rate);
- manipulated `provider_amount` / `vendor_amount` (derived, not client);
- manipulated `advance_amount` (= policy % of server total);
- add-on id belonging to another provider / non-existent (rejected).

**Booking state (P0-1b)**:
- direct `status` change (`in_progress`/`completed`) → 42501;
- direct `payment_status:'paid'` → 42501;
- confirm without verified payment → booking stays `pending`;
- cross-vendor / cross-customer edit of another party's booking → rejected;
- duplicate submission → single effect (idempotency key);
- two concurrent updates → exactly one wins (from-state row-count guard).

**Provider verification (P0-2)**:
- self-approval: PATCH `verification_status:'approved'` → 42501;
- self set `is_verified` / `is_published` / `is_featured` → 42501;
- self set `average_rating` → 42501;
- legit admin approval via RPC still flips columns and stamps `verified_by`;
- non-admin calling the admin RPC → rejected;
- normal profile edit (bio/price/media) by the vendor still succeeds.

**Document verification (P0-3)**:
- unauthenticated `verify-document` call → rejected;
- verifying another user's document → rejected;
- fabricated `detectedType`/`confidence`/`hasValid*`/verdict → no authoritative
  KYC state, classification advisory only;
- fail-closed on edge error (never fabricated `verified`);
- sensitive numbers (full Aadhaar/PAN) never reach logs; identity doc not
  publicly retrievable by URL.

---

## §9. The five exact proposed changes (review gate — Step 10)

Per the STOP anchor, these are the exact changes to approve **before** any
implementation. Nothing below is applied by this document.

### 9.1 Protected booking / payment columns

The complete PROTECTED list only a trusted server role / SECURITY DEFINER RPC may
write (all currently client-writable):

- **Booking money** (all booking tables): `base_amount`, `addons_amount`,
  `album_amount` (photog), `total_amount`, `advance_amount`, `remaining_amount`,
  `inventory_reserved` (rental), plus server-set `customer_id`,
  `provider_id`/`photographer_id`.
- **Booking lifecycle**: `status`, `payment_status`, `calendar_locked`,
  `confirmed_at`, `advance_paid_at`, `work_started_at`, `work_completed_at`,
  `settlement_status`.
- **payments / photography_package_payments**: `amount`, `status` — **already**
  DB-protected (no write policy → default-deny); keep as the reference model.
- Enforcement: `REVOKE INSERT/UPDATE (<these>) FROM authenticated`; benign
  columns keep their grant.

### 9.2 Booking transaction / source-of-truth flow

- Client sends **identifiers + choices only** (provider/package/addon ids,
  quantity, date, contact) — **no amounts**.
- One `SECURITY DEFINER` `create_*_booking` RPC per category (extending the
  photography model): fetch base + add-on prices from trusted rows, compute
  total/advance/remaining and read `platform_fee_rate` from config, insert with
  `customer_id = auth.uid()` and `status='pending'` — **atomically**.
- Transitions via actor-checked RPCs: `confirm_booking_after_payment` (server/
  payment path only, idempotent on Razorpay id), `provider_respond_to_booking`,
  `cancel_booking` (server-side refund), completion via OTP server path. Each
  guards the from-state with `WHERE status = <expected>` (concurrency-safe).
- `completeService` stops accepting `bookingAmount`/`platformFeeRate`; settlement
  derives from stored values + config.

### 9.3 Provider profile authorization policy

- `REVOKE UPDATE` on the trust/reputation/KYC column set (§4.5) from
  `authenticated`; benign profile columns keep UPDATE so normal editing works.
- Approval moves to `admin_set_provider_verification(...)` SECURITY DEFINER,
  gated by `has_role(auth.uid(),'admin'|'super_admin')`, sole writer of
  `is_verified`/`is_published`/`is_featured`/`verification_status`/`verified_*`;
  `approvalService.ts` + `AdminDashboard.tsx` call it. `average_rating`/`total_*`
  become trigger/RPC-driven. Dead `adminVerification.ts` dropped.

### 9.4 Document-verification trust boundary

- Reframe the client verdict as an **advisory classification**, not KYC.
- `verify-document` Edge Function: require `getUser()`, use that uid, ignore
  client `userId`, enforce ownership; client **fails closed** (never fabricates
  `verified`).
- Real KYC status stays admin/server-set PROTECTED columns.
- Identity documents move from the PUBLIC `provider-media` bucket to a private
  owner-scoped bucket with signed-URL admin access; stop storing doc URLs in the
  anon-readable `vendor_details`. No full Aadhaar/PAN in logs.

### 9.5 Tests that prove each P0 is fixed

The §8 attack matrix, split as: P0-1 (amount/fee/advance/add-on tampering all
rejected or ignored; stored money = server-derived), P0-1b (direct status/
payment_status writes → 42501; free-confirm blocked; concurrency + idempotency;
cross-party rejected), P0-2 (self-verify/publish/feature/rating → 42501; admin
RPC still works; non-admin RPC rejected; normal edit works), P0-3 (unauth
rejected; cross-user rejected; fabricated verdict non-authoritative; fail-closed;
no PII leak). DB-level invariants are `DO $probe$` blocks that self-fail the
migration; a `vitest` layer drives the RPCs as a real authenticated user.

---

## §10. UNKNOWNs to resolve before code lands (Rule 10)

Each names the exact read-only introspection or repo trace that resolves it. No
implementation begins until the ones it depends on are confirmed.

1. **Category-table grant posture** — the 16 category booking tables were NOT in
   the `20261201000005` sweep. Confirm current `anon`/`authenticated` grants per
   table (`role_table_grants` / `has_table_privilege`) before writing each
   `REVOKE`. Do not assume they mirror `bookings`.
2. **create-booking request body** — exact lines reading amounts from the body
   vs a DB row, and whether the current frontend actually calls it or uses the
   direct `.insert()` (resolved by the in-flight booking-creation trace).
3. **Generic `bookings` columns** — confirm whether it carries `payment_status`
   and the exact `status` domain/constraint (`information_schema.columns` +
   `pg_constraint`). `types.ts:10557` shows a `payment_status` enum; confirm its
   table.
4. **Provider accept/reject literals** — `ProviderDashboard.tsx:242` writes
   `status: action`; confirm the exact target values and target table.
5. **Category UPDATE policy predicates** — confirm whether
   `<cat>_bookings_provider_update` constrains the provider to the owning row
   (cross-party edit surface) — RUN 5 showed `WITH CHECK NULL`; read each `qual`.
6. **platform_fee_rate source of truth** — is there a config table, or is the
   rate only ever an argument? The RPC must read it from a trusted row (grep for
   a fee/config table; `completeService` currently takes it as a param).
7. **Photography RPC location** — confirm `create_photography_package_booking` /
   `checkout_photography_cart` exist in *current* migrations (not only
   `migrations-archive`) before citing them as the pattern to extend.
8. **Legacy RPC live callers** — grep `src/` + `supabase/functions/` for
   `create_event_booking` / `add_artist_to_event` / `update_artist_booking_status`;
   if dead, `DROP` rather than re-secure.
9. **vendor_details key inventory** — `SELECT DISTINCT jsonb_object_keys(
   vendor_details) ...` (keys only, never values) to confirm which KYC/doc URL
   keys are anon-readable and must move out (§5).
10. **Real advance-payment path** — confirm whether any server/Razorpay-verified
    flow moves `pending → in_progress`, or whether `handlePayAdvance`
    (`MyBookings.tsx:150`) is the only path (i.e. today it confirms with no
    payment). Determines how `confirm_booking_after_payment` is wired.
11. **provider_profiles write-site enumeration** — the complete set of
    non-admin writers of sensitive columns (resolved by the in-flight
    provider-profiles trace) to be sure the column REVOKE breaks nothing benign.

---

_End of remediation plan. No RLS, booking, payment, provider-approval, migration,
or Edge Function behavior has been changed by this document. Implementation
proceeds only after review of §9, in small separately-committed batches (§7)._
