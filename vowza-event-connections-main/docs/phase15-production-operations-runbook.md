# Phase 15 — Production operations runbook

This runbook defines the operational controls required before Vowza is promoted to production. It is a review artifact only; it does not create monitoring resources, change Supabase settings, rotate secrets, deploy code, or run production SQL.

## Operational controls

| Control | Required implementation | Evidence required before launch |
|---|---|---|
| Error monitoring | Capture frontend exceptions, Edge Function failures, failed database calls, and Storage signing failures with sensitive fields redacted. | A staging event is received, grouped, assigned, and resolved. No tokens, KYC paths, document contents, or raw JSONB appear in the event. |
| Application logs | Use structured logs with request/function identifiers and safe error codes. Keep user-facing messages generic for privileged failures. | Sample staging logs demonstrate correlation without secret or PII leakage. |
| Database monitoring | Track migration failures, slow queries, connection saturation, RLS errors, and Storage policy errors. | Alert thresholds, recipients, retention, and escalation owner are documented. |
| Critical alerts | Alert on authentication outage, Edge Function error rate, failed payments, KYC access-denial anomalies, and elevated 5xx responses. | Synthetic alert exercises reach the assigned operator and are acknowledged. |
| Backups | Enable managed database backups and document retention, encryption, and access ownership. | Backup policy and the exact backup artifact identifier are recorded by the operator. |
| Restore drill | Restore a sanitized staging backup into a separate disposable project/database and run schema, auth, Storage, and application smoke checks. | Timestamped restore result, row-count sanity checks, migration version, and application smoke result. |
| Migration procedure | Review migration SQL, replay on a fresh local database, apply to staging, run regression tests, and record the migration version. | Migration log and approval record tied to the release commit. |
| Migration rollback | Every destructive or privilege-changing migration has a tested forward-compatible rollback or an operator recovery procedure. Never roll back by deleting migration history. | Staging rollback/recovery drill and explicit data-loss assessment. |
| Deployment procedure | Build from an immutable commit, pass CI gates, deploy a preview, run staging smoke/E2E/security/performance checks, then require approval. | Release checklist with commit, build artifact, environment, approver, and rollback target. |
| Secret inventory | Maintain a named inventory of client-exposed publishable values versus server-only secrets. Rotate staging secrets independently. | Inventory contains owners, scope, expiry/rotation cadence, and no secret values. |
| Admin audit logging | Record actor, action, target, outcome, timestamp, and safe detail for role changes and KYC approvals. Keep audit schema private and append-only. | Staging audit queries show expected events while anonymous/authenticated ordinary users cannot read or mutate the audit table. |

## Restore drill sequence

The operator creates a disposable staging restore target, restores the selected backup, verifies that the database migration version is known, and confirms that no production credentials or production Storage endpoints are configured. The agent then runs the clean migration and application tests against the disposable target. After the smoke suite, the operator destroys the disposable target according to the organization’s retention policy.

## Rollback principles

A deployment rollback returns the frontend and Edge Functions to the last approved immutable commit. A database rollback is not an instruction to reverse arbitrary DDL in production: the operator must use the migration-specific rollback/recovery procedure, preserve audit history, and assess whether data written by the newer application is compatible with the previous version. Any irreversible migration requires an explicit forward-fix plan before approval.

## Launch stop conditions

Launch remains blocked until monitoring is receiving safe events, a restore drill has passed, migration and rollback procedures have been exercised in staging, secrets are inventoried, and privileged actions are visible in the private audit log. Production changes remain operator-owned and are outside this review branch.
