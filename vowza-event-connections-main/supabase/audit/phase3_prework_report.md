# Phase 2 Corrections and Phase 3 Pre-Work

## Scope and branch state

This report accompanies the Phase 2 corrections on the stacked branch `manus/phase2-public-rebaseline`. The local `manus/audit-and-stabilization` branch was reset hard to `origin/manus/audit-and-stabilization` at the committed baseline `325e1cb`; the Phase 2 change remains solely on the stacked PR branch. No production SQL, production data, Supabase configuration, deployment, or merge was performed.

The public baseline remains committed at [`supabase/baseline/baseline_schema.sql`](../baseline/baseline_schema.sql). The corrected migrations are [`20261201000000_public_schema_baseline.sql`](../migrations/20261201000000_public_schema_baseline.sql) and [`20261201000001_auth_hooks_and_storage_policies.sql`](../migrations/20261201000001_auth_hooks_and_storage_policies.sql).

## Phase 2 corrections

The public baseline migration is now versioned `20261201000000_public_schema_baseline.sql`, later than the recorded production migration versions supplied for this phase. No other file under `supabase/` collides with that timestamp.

The migration now places the required extension setup before public objects:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
```

A discrepancy survived inspection: the committed schema-only dump contains **zero literal `CREATE EXTENSION` statements**, so there was no extension list to reproduce verbatim. The baseline does, however, reference `public.vector` and `extensions.uuid_generate_v4()`. The two statements above preserve those observed placements and are explicitly recorded here as an inference from the object references, not as literal lines copied from the dump.

The second migration deliberately touches Supabase-managed schemas only for app-owned objects. It contains the single `auth.users` trigger that invokes `public.handle_new_user` and all 115 `storage.objects` policies. It does not recreate managed tables, indexes, constraints, or functions. The schema-only baseline contains no storage bucket rows, and production access/data exports are unavailable by instruction; therefore no `storage.buckets` `INSERT` statements or public-flag values were fabricated. This is an explicit gap requiring a separately approved bucket data export before those rows can be versioned.

| Managed-schema item | Baseline evidence | Phase 2 treatment |
|---|---:|---|
| `auth.users` application trigger | 1 | Included exactly in `20261201000001_auth_hooks_and_storage_policies.sql` |
| `storage.objects` policies | 115 | Included exactly in the second migration |
| `storage.buckets` table definition | Present only as managed DDL | Not recreated |
| `storage.buckets` data rows | Absent from schema-only dump | Not fabricated; explicit follow-up gap |
| Auth policies | 0 | None copied |
| Storage policies | 115 | Included as app-owned policy objects |
| Public policies | 388 | Included in the public baseline migration |
| Total policy statements | 503 | 388 public + 115 storage; the 115 difference is fully accounted for |

## Local replay verification

PostgreSQL 17.11 and `postgresql-17-pgvector` were installed natively in the sandbox. A fresh local database was created and both migrations applied with `psql -X -v ON_ERROR_STOP=1`. A local-only bootstrap supplied only compatibility objects needed to parse managed-schema references: platform roles, `auth.users`, `auth.uid`, `auth.role`, `auth.jwt`, `storage.objects`, and `storage.foldername`. The bootstrap is not part of the repository migrations.

The public replay completed successfully, as did the managed app-object replay. A PostgreSQL 17 `pg_dump --schema-only --schema=public --quote-all-identifiers --no-owner` was compared with a public-only extraction of the committed baseline. The comparison normalized dump-control headers, two equivalent PostgreSQL 17 CHECK-expression renderings, and a trailing separator comment. The acceptance result was:

```text
public_baseline_vs_replayed=EMPTY
checker_exit=0
reference_lines=16701
replayed_lines=16701
```

This verifies that the public migration reproduces the committed public baseline in the local replay. It does **not** prove that the migration is safely applicable to an already-populated database. It is a baseline for a clean database, not an instruction to run `supabase db push` against the existing production project.

## Independent baseline cross-check

An independent regex-based pass over the committed baseline produced the following counts, separate from the migration-generation and replay-comparison tooling:

| Baseline object class | Count |
|---|---:|
| `CREATE POLICY` on `public` | 388 |
| `CREATE POLICY` on `storage` | 115 |
| `CREATE POLICY` on `auth` | 0 |
| Public RLS enable statements | 144 |
| Trigger on `auth.users` | 1 |
| Literal `CREATE EXTENSION` statements | 0 |

The user-provided context cited approximately 18 public tables with RLS disabled. The replay catalog derived from the committed baseline contains 11, not 18. That discrepancy is called out rather than silently reconciled; the 11-table result is authoritative for the committed public baseline used here, while the 18-table figure may refer to another snapshot or a broader catalog definition.

## Phase 3 pre-work exports

The four requested read-only catalog queries were run against the local `vowza_phase2_full_replay_corrected` database, not production. The results are committed as CSV files in this directory:

| Export | Data rows | Purpose |
|---|---:|---|
| [`public_table_exposure.csv`](public_table_exposure.csv) | 155 | RLS state, policy count, and anon table privileges |
| [`blanket_public_policies.csv`](blanket_public_policies.csv) | 74 | Blanket public policies and their predicates |
| [`security_definer_functions.csv`](security_definer_functions.csv) | 79 | SECURITY DEFINER functions, search paths, and execute grants |
| [`rls_enabled_zero_policies.csv`](rls_enabled_zero_policies.csv) | 1 | RLS-enabled tables with no policies |

The resulting summary is:

| Finding | Result |
|---|---:|
| Public tables in replay catalog | 155 |
| Tables with RLS disabled | 11 |
| RLS-disabled tables with anon `SELECT` | 11 |
| RLS-disabled tables with any anon privilege | 11 |
| Blanket policy rows | 74 |
| Blanket `USING (true)` rows | 68 |
| Blanket `WITH CHECK (true)` rows | 6 |
| SECURITY DEFINER functions | 79 |
| SECURITY DEFINER functions executable by anon | 73 |
| SECURITY DEFINER functions without `search_path` in `proconfig` | 8 |
| RLS-enabled tables with zero policies | 1: `booking_start_otps` |

The 11 RLS-disabled public tables are `artist_categories`, `bookings`, `menu_items`, `pooja_services`, `pricing_packages`, `profiles`, `provider_faqs`, `provider_profiles`, `rental_items`, `reviews`, and `subcategories`. All 11 are anon-readable in the replay catalog, so they are openly readable with the publishable key under this catalog state.

The eight SECURITY DEFINER functions without a `search_path` entry are:

```text
add_artist_to_event
create_event_booking
get_active_promotion_video
get_random_eligible_promotion_video
is_chat_eligible
is_chat_participant
record_promotion_view
update_artist_booking_status
```

Seventy-three SECURITY DEFINER functions are executable by anon in the replay catalog. This includes the eight functions without a configured search path and additional functions whose search path is configured but whose anon execute grant remains broad. Phase 3 must review these privileges and function bodies; no privilege or function changes were made in this pre-work phase.

The single deny-all-by-RLS result is `booking_start_otps`. It has RLS enabled and zero policies, which normally denies access rather than exposing data; whether that is a broken feature requires application call-site review in Phase 3.

## Replay-versus-production caveat

The public catalog is schema-identical to the committed public baseline under the normalized dump comparison, but the local replay is not a full production clone. The local bootstrap supplies simplified auth and storage compatibility objects, and no production bucket rows were available. Consequently, public table definitions, public policies, public functions, and public grants are useful for triage, while managed-schema behavior and bucket contents require separate verification from a future approved export or environment. The Phase 3 CSVs must not be read as production evidence for managed schemas.

## Stop condition

This report intentionally stops after Phase 2 corrections and read-only Phase 3 pre-work. No Phase 3 remediation, policy rewrite, function hardening, data seeding, or deployment has begun.

## References

[1]: ../baseline/baseline_schema.sql "Committed production schema-only baseline"
[2]: ../migrations/20261201000000_public_schema_baseline.sql "Public-only baseline migration"
[3]: ../migrations/20261201000001_auth_hooks_and_storage_policies.sql "App-owned auth hook and storage policy migration"
[4]: public_table_exposure.csv "Local public-table exposure export"
[5]: blanket_public_policies.csv "Local blanket-policy export"
[6]: security_definer_functions.csv "Local SECURITY DEFINER export"
[7]: rls_enabled_zero_policies.csv "Local RLS deny-all export"
