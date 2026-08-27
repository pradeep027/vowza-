# Phase 11 — Staging environment contract

This document defines the staging environment required before any release-candidate deployment. The staging environment must be separate from production and must contain no production users, KYC documents, bookings, profiles, provider records, secrets, or copied Storage objects.

## Required components

| Component | Requirement | Acceptance check |
|---|---|---|
| Frontend | A Vercel preview or separate staging project built from the exact review commit. | The frontend points only to the staging Supabase URL and never to `vavfeataqwwbpjonknne.supabase.co`. |
| Supabase project | A dedicated project using PostgreSQL 17-compatible behavior and an independent project ref. | Operator confirms the ref is not the production ref and enables audit logging. |
| Database | Fresh schema replay from the committed migrations, followed by synthetic seed data. | Clean-state migration replay succeeds without manual SQL outside the migration runner. |
| Storage | Separate buckets with synthetic objects only. KYC and chat buckets are private; provider portfolio is public only where explicitly intended. | Anonymous, wrong-user, participant, signed-URL expiry, deletion, and enumeration tests pass. |
| Edge Functions | Deploy all required functions to staging with explicit `verify_jwt` settings and no production secrets. | Unauthorized, malformed, wrong-owner, and admin-boundary requests return expected safe errors. |
| Authentication | Synthetic test accounts for customer, vendor, admin, and super-admin roles. | Sign-up, login, logout, expiry, password reset, and role transition tests pass. |
| Secrets | Staging-only API keys and HMAC secrets stored in the staging project secret manager. | No production secret appears in repository files, build output, logs, or preview variables. |
| Environment variables | Only `VITE_SUPABASE_URL` and the publishable/anon key are exposed to the browser. | Client bundle contains no service-role key, OTP HMAC secret, JWT signing secret, or provider credential. |

## Safe environment template

Copy this template into the hosting provider’s staging configuration. Do not commit real values.

```dotenv
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
# No service-role key or server secret belongs in VITE_* variables.
```

Server-side staging secrets are configured only in the staging Edge Function environment:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OTP_HMAC_SECRET
OPENAI_API_KEY or the selected staging LLM key
```

## Operator handoff

The operator must create or identify the dedicated staging Supabase project, provide its project ref, create synthetic accounts, and configure staging-only secrets. The agent must not run production SQL, copy production data, change production configuration, or deploy Edge Functions to the production project.

After staging exists, the release candidate must execute the clean migration replay, synthetic seed, frontend build, Edge Function deployment, authentication smoke suite, RLS/Storage security suite, feature journeys, and browser accessibility checks described in later phases. Any failure blocks promotion.
