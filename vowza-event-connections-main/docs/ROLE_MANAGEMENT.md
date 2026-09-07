# Role management

How admin roles are granted and revoked, and why it looks the way it does.

## The short version

Nothing in the browser writes `public.user_roles`. The privileges are not there
to allow it. A role change goes:

    AdminAdmins.tsx
      → supabase.functions.invoke('admin-user-roles')     (caller's JWT)
        → auth.getUser()                                   (establishes WHO)
          → rpc admin_set_user_role(actor, ...)            (service_role only)
            → authorize + mutate + audit, one transaction

The Edge Function's only security job is to establish who is calling. Every
decision — whether the caller may do this, who the target is, whether the change
is permitted, and what gets written to the audit trail — happens inside
`public.admin_set_user_role`, in one transaction with the mutation it guards.

## Why the authorization is not in the Edge Function

If the check lived in the function and the write lived in the database, an
authorization decision and the state change it guards would sit in two systems
with a network hop between them. They could disagree; a partial failure could
apply one without the other; and a refusal would be recorded, if at all, by the
party being refused.

Inside the RPC they cannot come apart. Either the role change and its audit row
both commit or neither does. This is also why the RPC *returns* a failure
payload on a denial instead of raising — raising would roll back the audit row
along with the refusal, so refused attempts would leave no trace. Denials are
the events most worth keeping.

`admin-user-roles/index.ts` does validate its input, but that is hygiene, to
reject obvious junk without a database round trip. The RPC re-checks all of it,
and the RPC's copy is authoritative. Do not add an allow/deny decision to the
Edge Function.

## Why admin_set_user_role takes the actor as a parameter

Because it must, and this is the part to be careful about.

The function receives `p_actor_id` and acts on that authority. That is the same
shape as the `make_admin(uuid)` function that produced the original privilege
escalation, and it is safe here for exactly one reason: `EXECUTE` is granted to
`service_role` and revoked from `PUBLIC`. The service role key exists only in
Edge Function environment variables and never reaches a browser.

If that grant is ever widened to `anon` or `authenticated`, the function becomes
an impersonation primitive — pass any super admin's uuid and inherit their
authority. The migration asserts this has not happened and fails to apply if it
has. Any future sweep over function privileges must leave it alone.

The two reader functions, `admin_list_admins()` and
`admin_list_privileged_actions()`, take no actor. They derive it from
`auth.uid()`, so they cannot be impersonated at all, and `authenticated` holds
EXECUTE on both. That is the shape to prefer whenever the call can come from a
user session.

## Why grants go by email and revokes go by user id

`profiles.email` is written by the row's owner — see `workerOnboarding.ts`. It
is not proof of anything.

The old implementation looked up the target with
`profiles.select('id').eq('email', ...)`, which meant a user could set their own
profile email to an address an admin was about to invite and receive the grant
intended for someone else.

Revokes were worse, and less obviously so. The admin list renders an email, so a
user who set their profile email to a real admin's address would make the
"remove" button beside *their own* row resolve to the *real* admin. A super
admin clicking it would revoke the wrong person's access while believing they
had removed the attacker.

So: grants resolve against `auth.users.email`, which only GoTrue writes, and
exist because you generally know an invitee's address and not their uuid.
Revokes take the `user_id` straight from `user_roles`, which no client can write.
If two accounts share an email address the function refuses rather than guessing.

## Why only the admin role

`super_admin` is excluded because there is one of them, and an endpoint that can
create a second or remove the only one is an escalation and a lockout in one
call.

`provider` and `customer` are excluded for a different reason. A provider's role
is not standalone — it exists alongside a `provider_profiles` row and a
verification state. A bare "revoke provider" here would strip the role and leave
an approved, verified provider profile behind, and the vendor would find their
account half-working with nothing in the listings to explain why. Role changes
with dependent rows belong to the flow that owns those rows.

That flow is currently browser-side, which is why `20261201000002` keeps
`INSERT` and `DELETE` granted to `authenticated` and constrains them by policy
to `role IN ('customer','provider')` instead of revoking them. Six call sites
write those two roles — vendor registration, artist onboarding, the customer row
seeded at signup, and three admin approval screens — and four of them discard
the result, so revoking the privilege would have broken vendor onboarding
silently. The privileged role *values* are what became unreachable from a
browser, not the table.

## The second door, and why the table fix alone was not a fix

Worth knowing if you ever add a function that writes `user_roles`.

`public.make_admin(uuid)` existed on the live database as `SECURITY DEFINER`,
owned by `postgres` (which has `rolbypassrls`), containing no authorization
check of any kind, with `GRANT ALL … TO anon`. Its whole body was an `INSERT`
of `role = 'admin'` for whatever uuid you passed.

A definer function owned by a bypassrls role answers to neither RLS nor the
table ACL. So every policy and grant on `user_roles` could have been correct and
an anonymous caller would still have had `POST /rest/v1/rpc/make_admin` — no
account, no session. Revoking anon's `INSERT` on the table and calling the
escalation closed would have been false.

`make_admin` and `make_provider` are dropped; neither had a single caller in the
application or the database. `approve_artist` and `reject_artist` had the same
shape — `reject_artist` deletes a provider role and unpublishes a listing, so
anonymous access to it was a mass vendor takedown — and are kept but made
`service_role`-only, because they move verification state, the role row and the
notification together, which is the right shape for a server-side vendor
approval path to build on. Their bodies still contain no authorization check;
both now carry a `COMMENT` saying so.

The migration asserts this generally rather than by name: no client role may
hold `EXECUTE` on any `public` `SECURITY DEFINER` function whose body writes
`user_roles`. The list comes from `pg_proc`, so a sixth such function cannot
quietly reopen the hole. `handle_new_user` is the one documented exception — it
returns `trigger`, so calling it directly fails with `0A000`.

## The audit trail

`vowza_audit.privileged_actions`, in its own schema, with **no privileges granted
to any role**. It is reachable only through the SECURITY DEFINER functions above.

It is not `public.audit_log`, because that table is `GRANT ALL ... TO anon`:
today any anonymous caller can forge rows in it and delete real ones, and an
audit record the audited party can delete is not evidence of anything.

Three properties worth knowing:

Append-only is enforced, not assumed. A row trigger rejects UPDATE and DELETE
and a separate statement trigger rejects TRUNCATE, which bypasses row triggers.
This binds the definer functions too — they run as `postgres` and could
otherwise rewrite history. Removing an audit record now requires DDL.

There are no foreign keys to `auth.users`. `ON DELETE CASCADE` would erase the
record of what someone did when their account is deleted and `SET NULL` would
erase who did it, so the uuids are stored unconstrained with the email
denormalised alongside them.

Every outcome is recorded, with `outcome` one of `applied`, `denied`, `noop` or
`failed`. `FORBIDDEN` denials are capped at one row per actor per five minutes,
because any authenticated user can reach the endpoint and an unthrottled denial
log is a way to inflate the table. The first denial in each window carries the
signal; the tenth identical one does not.

Reading it requires `super_admin`, not `admin`. The reason admins are not trusted
to change roles — any admin could manufacture peers — applies just as well to
reading who tried: the trail carries actor and target email addresses, the whole
denial history, and raw `SQLSTATE`/`SQLERRM` from failed attempts.

**Do not add `vowza_audit` to the project's Exposed Schemas setting.** That
setting is the only thing standing between this table and the internet.

## Deploying a change to this path

Order matters, because migration `20261201000002` revokes the privileges the old
admin page depended on. Between the migration landing and the frontend deploying,
admin management does not work. That window is acceptable — the page has one user
— and closing the escalation takes priority over it.

**Run every command below from `vowza-event-connections-main/`, not from the
repository root.** The root contains a `supabase/` directory too, but it holds
only `.temp` link state — no `config.toml` and no `migrations/`. The CLI resolves
its project by walking up for `supabase/config.toml`, so from the root it will
not find these migrations. `vercel.json` at the root confirms the same directory
is canonical for the frontend build.

1. **Deploy the frontend first**, by merging to `main` and letting Vercel build.
   This is the reverse of the obvious order and it is required:
   `20261201000006` revokes `anon`'s per-column access, so a bundle still issuing
   `select('*')` on a public page breaks with `42501` the moment it is applied.

   Confirm the new bundle is actually being *served* — load the site in a fresh
   private window — rather than trusting that the build succeeded. A cached or
   failed build leaves the old bundle live, and the migrations below assume it is
   gone.

   Deploying the frontend early is safe because the new bundle also works against
   the pre-migration database: `.insert()` is valid whether or not `UPDATE` has
   been revoked, explicit column lists are valid against a full-table grant, and
   `claimProviderRole()` falls back to a direct insert when the RPC is absent.

2. `supabase db push --dry-run`. It must list exactly `20261201000002`,
   `20261201000003`, `20261201000004`, `20261201000005`, `20261201000006` and
   `20261201000007`.

   **It should not list the eleven historical migrations, and they must not be
   "repaired".** An earlier version of this document said none of them was recorded
   in production's ledger and that `supabase migration repair --status applied`
   should be run once per version. That was incorrect. `supabase migration list`
   shows all eleven already present in Remote. Running repair against them would
   write assertions into the ledger that happen to be true, but the habit is
   dangerous: `repair --status applied` on a migration that genuinely has *not* run
   marks it applied forever, and it will then never be applied.

   Two versions are recorded in Remote that originally had no file here —
   `20260825085842` and `20260825092107`. Files now exist for both. Because they are
   already applied they will not appear in the dry run; they are present so the
   directory is not missing history, and they need no repair either.

   Four historical files use an 8-digit prefix (`20260730`, `20260821`,
   `20260822`, `20261125`) rather than a 14-digit timestamp. They are in the ledger
   under those short versions, so they are accounted for — but it is worth
   confirming the CLI lists them, because a version the CLI cannot parse is a
   version it cannot tell you about.

   If the dry run lists anything unexpected, stop and read the ledger before
   running any repair command.

3. `supabase db push`. Each migration self-verifies and aborts on failure, so a
   silent partial apply is not a possible outcome.
4. `supabase functions deploy admin-user-roles`. Do this *after* the migrations;
   the function calls an RPC that does not exist until step 3. Between the Vercel
   deploy and this step, the admin panel's role controls return an error — an
   admin-only path, and no vendor- or customer-facing flow touches it.
5. **Leave `supabase/migrations-pending/` alone.** Phase C of the provider-role
   change (`PHASE_C_narrow_self_role_grant.sql`) is finished but deliberately
   withheld: it removes the direct-insert path, so it can only be applied after a
   real vendor registration has been observed going through
   `public.claim_provider_role()`. That directory's README has the promotion steps.

**Do not run `supabase config push`** as part of this or any other deploy until
`config.toml`'s `site_url` is corrected. It still reads
`https://vowza-chi.vercel.app`, and pushing it would repoint production's auth
redirect and password-reset links away from `vowza.co.in`. The
`[functions.admin-user-roles] verify_jwt = true` entry needs no config push —
`functions deploy` reads it, and `true` is the default regardless.

Verify by signing in as the super admin and confirming the list renders, then
granting and revoking admin on a test account. Then check the trail:

```sql
SELECT * FROM public.admin_list_privileged_actions(20);
```

Two rows should be there, `applied` both times, with `resolved_by` reading
`email` for the grant and `user_id` for the revoke.

To confirm the escalation itself is closed, from a shell with no session at all.
Both probes matter, and the second is the one that would have been missed:

```bash
# Door 1 — the table
curl -i -X POST 'https://<project>.supabase.co/rest/v1/user_roles' \
  -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","role":"admin"}'

# Door 2 — the definer function
curl -i -X POST 'https://<project>.supabase.co/rest/v1/rpc/make_admin' \
  -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_user_id":"00000000-0000-0000-0000-000000000000"}'
```

| Response | Meaning |
|---|---|
| `401`/`403`, code `42501` | Door 1 closed. The write never reached the table. |
| `404`, code `PGRST202` | Door 2 closed. The function no longer exists. |
| `409`, code `23503` | **Still open.** It passed RLS and the grant, and only failed at the foreign key. |
| `200`/`201` | **Still open, and the foreign key is missing too.** |

The all-zeros uuid is not a real user, so the foreign key guarantees no row is
created either way. Safe against production, decisive in both directions,
nothing to clean up.

Migration `20261201000002` runs the equivalent of the first probe itself before
it commits — assuming the `authenticated` role, setting a JWT claim, and trying
to insert `role = 'admin'` — and refuses to commit unless that comes back
`42501`. It also tries `role = 'provider'` and refuses to commit unless *that*
one gets as far as the foreign key, which is what proves the migration has not
broken vendor registration. The probe checks that it can actually impersonate
before trusting either verdict, because a harness that silently fails to
impersonate would report both as "blocked" and look like a pass.

## Things deliberately left undone

An authenticated user can still self-grant `provider`, and can grant `provider`
to another user, because three of the six browser call sites that write
`user_roles` are admin screens writing someone else's row, and a
`user_id = auth.uid()` restriction would break them. This is the status quo
rather than something introduced here, and it is bounded: a `provider` role on
its own puts nothing in the listings, which additionally require a
`provider_profiles` row with `is_verified` and `is_published`. Closing it means
moving the provider role behind a definer function the way admin now is — the
same pattern, applied to a flow with dependent rows, which is a larger change
than a P0 should carry.

Four of those six call sites discard the result of the write entirely, so a
failure there is invisible: `ProviderRegistration.tsx:352`,
`ArtistOnboarding.tsx:252`, `AdminDashboard.tsx:339` and
`approvalService.ts:202`. `approvalService.ts:125` logs the error and then
returns `{ success: true, message: 'Artist approved — profile is now live!' }`
regardless. None of these is caused by this change and none is fixed by it, but
the vendor-facing two are the ones to fix first: a vendor who submits KYC and
never receives the role sees a successful submission and a broken account.

`anon` keeps `SELECT` on `public.user_roles`. Forty policies across twenty-three
other tables test admin-ness by inlining
`EXISTS (SELECT 1 FROM public.user_roles ...)` rather than calling `has_role()`.
PostgreSQL checks privileges on every relation in a query's range table at
executor startup, and `OR` short-circuiting does not skip it, so revoking that
SELECT turns anonymous reads of those tables into `permission denied` — including
`providers_public_read` on `provider_profiles`, which `/artists` and
`/category/:slug` depend on. It would take the public site down.

Restricting which *rows* anon can see is safe and is what migration
`20261201000002` does. Removing the SELECT entirely is a follow-up that has to
move those forty policies onto `has_role()` first. The migration asserts anon
still holds SELECT, so a well-meaning tidy-up fails at apply time instead of in
production.

`resultFromInvokeError` in `AdminAdmins.tsx` duplicates a private helper in
`src/services/bookingExecutionService.ts`. It should be extracted to a shared
module, but not in a change to this path.

`src/integrations/supabase/types.ts` predates these functions, so the RPC names
are cast at the call site. Regenerating it rewrites thousands of lines and
belongs in its own change — one that must not drop these call sites.
