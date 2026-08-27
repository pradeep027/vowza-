# Phase 18 — Staging release candidate

This phase defines the release-candidate process for the exact commit intended for promotion. It is an operator-gated checklist and does not deploy to either staging or production.

## Release sequence

| Order | Gate | Required evidence |
|---:|---|---|
| 1 | Select immutable RC commit | Commit SHA, branch, and clean working tree recorded. |
| 2 | Verify staging target | `tools/verify-staging-target.sh` accepts a non-production Supabase project ref, Supabase URL, and frontend URL. |
| 3 | Deploy frontend to staging | Preview URL points only to staging Supabase and staging Edge Functions. |
| 4 | Apply migrations to staging | Migration history matches the RC; no manual production SQL is used. |
| 5 | Seed synthetic fixtures | Customer, vendor, admin, super-admin, booking, private Storage, and KYC fixtures contain no production values. |
| 6 | Run smoke tests | Public routes, auth, onboarding, planner, vendor, booking, KYC, chat, media, admin, and account flows render and return expected results. |
| 7 | Run security tests | RLS, Storage, KYC, Edge Function authorization, role-management, signed-URL expiry, and cross-user denial tests pass. |
| 8 | Run E2E tests | The Step 13 critical-journey contract passes with separate synthetic accounts. |
| 9 | Run performance/accessibility checks | Vendor package chunk budget, mobile route checks, keyboard/focus checks, labels, dialogs, contrast, and screen-reader basics pass. |
| 10 | Manual approval | Operator records approver, timestamp, commit SHA, environment, known warnings, rollback target, and explicit go/no-go decision. |

The release candidate must be rebuilt from the exact approved commit after any source change. A staging pass does not authorize production deployment; the final gate remains separate and requires explicit operator approval.
