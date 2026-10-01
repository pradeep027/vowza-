# `supabase/migrations-pending/` — migrations that must NOT be pushed yet

Everything in this directory is a finished, reviewed migration that is **deliberately
withheld from `supabase/migrations/`**.

`supabase db push` applies every file in `supabase/migrations/` whose version is not
yet in the remote ledger. It has no notion of "apply this one later". So the only
reliable way to stop a migration from being applied before its prerequisite is to
keep it out of that directory entirely. That is what this folder is for.

**Do not move a file out of here because a push failed or because the version
numbering looks incomplete.** Each file's header states the exact precondition that
must hold first. Read it.

## Why a migration would ever be withheld

Some changes are only safe in a particular order relative to a **Vercel deploy**,
and the two orderings are not symmetric:

- A migration that **removes** a privilege must ship **after** the frontend that
  stops relying on it. Push first and the live site breaks immediately.
  (`20261201000006_restrict_anon_column_access.sql` is this shape — its deploy
  order is inverted for exactly this reason.)
- A migration that **adds** something must ship **before** the frontend that calls
  it, but is harmless on its own.
  (`20261201000007_claim_provider_role.sql` is this shape.)

When a single change would break the site in *both* orderings, it has to be split
into phases, and the phase that removes the old path is what lands here until the
new path is live in production.

## Current contents

### `PHASE_C_narrow_self_role_grant.sql`

Phase C of three. Narrows `user_roles_insert_unprivileged` so a user can only
self-grant `customer`, closing the hole where any authenticated account could give
itself `provider` with no `provider_profiles` row, no KYC documents and no audit
trail.

| Phase | What | Where it lives | State |
|---|---|---|---|
| A | Add `public.claim_provider_role()` | `supabase/migrations/20261201000007_claim_provider_role.sql` | in the normal migration path |
| B | Frontend calls the RPC instead of inserting directly | `src/lib/userRoles.ts` (`claimProviderRole`), `src/pages/ProviderRegistration.tsx`, `src/pages/ArtistOnboarding.tsx` | in the working tree |
| C | Narrow the INSERT policy | **this folder** | withheld |

Applying C before B is live in production **breaks vendor registration and artist
onboarding**: the running bundle would still be inserting its own `provider` row,
and C is precisely what refuses that insert. The vendor would finish uploading KYC
documents and then be unable to reach their dashboard.

Note that B is *safe* to deploy before A. `claimProviderRole()` falls back to the
direct insert when the RPC is absent from PostgREST's schema cache, so the ordering
hazard is only ever between C and B — never between A and B.

#### Promoting it

1. Apply Phase A and confirm `public.claim_provider_role()` exists.
2. Deploy the Phase B frontend to Vercel.
3. In a **fresh private window** on https://vowza.co.in, register a test vendor all
   the way through. Then confirm the new code path is the one running:

   ```sql
   select occurred_at, outcome, detail
     from vowza_audit.privileged_actions
    where action = 'claim_provider_role'
    order by occurred_at desc
    limit 5;
   ```

   An `outcome='applied'` row is the only positive proof. "The Vercel deploy
   finished" is not the same as "the new bundle is being served" — a cached bundle
   or a failed build would leave the old path live, and pushing C on top of that is
   the failure this whole arrangement exists to prevent.
4. Only then: `git mv` it into `supabase/migrations/` as
   `20261201000008_narrow_self_role_grant.sql`, and push.
5. Run the negative probe from the file header — as an ordinary logged-in user,
   `POST /rest/v1/user_roles` with `{"user_id":"<own uuid>","role":"provider"}`
   **must** return 403. Until that has actually returned 403, the hole is not
   closed, whatever the migration output said.

### `PHASE_provider_column_lockdown.sql`

Phase 2 of two for **P0-2 (provider self-approval)**. Revokes `authenticated`'s
table-wide `UPDATE` on `public.provider_profiles` and grants it back on only the
benign, vendor-editable columns, so a signed-in vendor can no longer PATCH
`verification_status`, `is_verified`, `is_published`, `is_featured`, `verified_*`,
`rejection_reason`, `is_bank_verified`, the KYC/liveness columns, or the reputation
counters directly.

| Phase | What | Where it lives | State |
|---|---|---|---|
| 1 | Add `admin_set_provider_verification` + `provider_resubmit_for_review` RPCs and the trust-clamp / bank-reverify triggers | `supabase/migrations/20261204000000_provider_verification_authority.sql` | in the normal migration path (additive, safe anytime) |
| 2a | Frontend routes admin approve/reject/suspend and vendor resubmit through the RPCs, and stops writing `is_bank_verified` | `src/services/approvalService.ts`, `src/pages/AdminDashboard.tsx`, `src/pages/VendorEditProfile.tsx`, `src/hooks/useVendorData.ts` | in the working tree |
| 2b | Revoke the column `UPDATE` and grant the benign allowlist | **this folder** | withheld |

Applying 2b before phase 1 is live **and** the phase-2a frontend is the served
bundle **breaks admin approval, vendor resubmit, and bank-detail saves**: the old
bundle PATCHes these columns directly, and 2b is precisely what starts returning 403
for those PATCHes. Phase 1 is additive and harmless on its own; the ordering hazard
is only ever between 2b and 2a.

#### Promoting it

1. Apply phase 1 and confirm `admin_set_provider_verification`,
   `provider_resubmit_for_review` and both `provider_profiles_*` triggers exist.
2. Deploy the phase-2a frontend to Vercel.
3. In a **fresh private window** on https://vowza.co.in, exercise an admin
   approve/reject and a vendor resubmit, then confirm the RPC path is the one
   running:

   ```sql
   select occurred_at, action, outcome, detail
     from vowza_audit.privileged_actions
    where action in ('admin_set_provider_verification','provider_resubmit_for_review')
    order by occurred_at desc
    limit 5;
   ```

   An `outcome='applied'` row is the only positive proof the new path is live. A
   cached or failed build would leave the old direct-PATCH bundle serving, and
   pushing 2b on top of that is the failure this arrangement exists to prevent.
4. Only then: `git mv` it into `supabase/migrations/` as
   `<next-timestamp>_provider_column_lockdown.sql`, and push. Its own `$catalog$`
   and `$probe$` blocks re-prove the lockdown at apply time and abort if it is wrong.
5. Run the negative probe from the file header — as an ordinary logged-in vendor,
   `PATCH /rest/v1/provider_profiles?id=eq.<own id>` with
   `{"verification_status":"approved"}` **must** return 403, while a PATCH of
   `{"bio":"..."}` **must** return 200. Until that 403 is observed, the hole is not
   closed, whatever the migration output said.

### `PHASE_vendor_settlements_rls_lockdown.sql`

Phase 2 of two for **P0 Phase D (payment / settlement integrity)**. Drops the two
`auth.uid() IS NOT NULL`-only write policies on `public.vendor_settlements`
(`authenticated_insert_settlements`, `authenticated_update_settlements`) that let
ANY signed-in user INSERT a fabricated settlement (arbitrary `vendor_id`,
`booking_amount`, `vendor_earnings`) or UPDATE any existing one, and adds an
admin-only `UPDATE` for settle/dispute. The scoped SELECT policies are untouched.

| Phase | What | Where it lives | State |
|---|---|---|---|
| 1 | Add the `complete_booking_service` SECURITY DEFINER RPC (reads amount/provider/customer from the stored row, derives the fee from `platform_settings`, writes the settlement server-side) | `supabase/migrations/20261242000000_complete_booking_service_authoritative.sql` | in the normal migration path (additive, safe anytime) |
| 2a | Frontend completes a service through the RPC instead of raw-inserting the settlement | `src/services/bookingExecutionService.ts` (`completeService`), `src/pages/vendor/VendorBookings.tsx` | in the working tree |
| 2b | Drop the broad write policies; add admin-only UPDATE | **this folder** | withheld |

Applying 2b before phase 1 is live **and** the phase-2a frontend is the served
bundle **breaks service completion**: the old bundle raw-inserts the settlement, and
2b is precisely what starts returning 403 for that insert. Phase 1 is additive and
harmless on its own; the ordering hazard is only ever between 2b and 2a. 2b's own
`$catalog$` also refuses to apply unless the Phase 1 RPC is already installed — so
it can never leave the table with no write path at all.

#### Promoting it

1. Apply phase 1 and confirm `public.complete_booking_service(uuid, text)` exists.
2. Deploy the phase-2a frontend to Vercel.
3. In a **fresh private window** on https://vowza.co.in, complete a test service as
   a vendor, then confirm the RPC path is the one running — a fresh row whose
   `vendor_user_id` is the provider and whose money matches `platform_settings`:

   ```sql
   select created_at, vendor_user_id, booking_amount, platform_fee_amount, vendor_earnings
     from public.vendor_settlements
    order by created_at desc
    limit 5;
   ```

   A row written by the RPC is the only positive proof the new path is live. A cached
   or failed build would leave the old raw-insert bundle serving, and pushing 2b on
   top of that is the failure this arrangement exists to prevent.
4. Only then: `git mv` it into `supabase/migrations/` as
   `<next-timestamp>_vendor_settlements_rls_lockdown.sql`, and push. Its own
   `$catalog$` and `$verify$` blocks re-prove the lockdown at apply time and abort if
   it is wrong.
5. Run the negative probe from the file header — as an ordinary logged-in user, a
   direct `POST /rest/v1/vendor_settlements` **must** return 403, and so must a
   `PATCH`. Until that 403 is observed, the hole is not closed, whatever the migration
   output said.

## Adding a file here

Name it `PHASE_<x>_<slug>.sql`, **without** a timestamp prefix, so that it is
visibly not a versioned migration and a stray copy into `supabase/migrations/` is
obvious on sight. Do not rely on the filename as the safeguard — the safeguard is
the directory. (Whether the CLI skips, warns about, or errors on a non-conforming
filename inside `migrations/` has not been tested here, so it is not something to
depend on either way.)

State the precondition in the file header, not only here. A file that leaves this
folder loses this README but keeps its header.
