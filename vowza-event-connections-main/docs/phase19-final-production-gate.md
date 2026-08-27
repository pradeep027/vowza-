# Phase 19 — Final production gate

This gate is a release decision record for the Vowza review sequence. It is not production approval and it performs no production deployment, migration, data change, or configuration change.

| Gate | Current status | Required evidence before approval |
|---|---|---|
| Authentication | **Pending staging** | Synthetic sign-up/login, session expiry, logout, reset, and wrong-account tests. |
| RLS | **Local replay green; staging pending** | Feature-group policy tests for anonymous, normal user, other user, vendor, admin, and operator roles. |
| Storage | **Local assertions green; staging pending** | Private KYC/chat access, participant boundaries, upload ownership, deletion, enumeration, signed URL expiry. |
| KYC privacy | **Source hardened; staging pending** | Pending, rejected, approved, and deleted document states with no public/API PII exposure. |
| Edge Functions | **Source checks green; staging pending** | JWT gateway, actor derivation, input validation, service-role boundaries, CORS, and sanitized errors. |
| Chat/media | **Local SQL regression green; staging pending** | Two-user chat/media test, expiry, deletion, predictable-URL denial, and wrong-participant denial. |
| Automated tests | **Green locally** | 13 Vitest files and 480 tests pass. |
| E2E | **Pending staging** | Step 13 critical journeys pass against isolated staging. |
| Migrations | **Green locally; staging pending** | Fresh local replay passes; staging migration history and rollback/recovery drill pass. |
| Backups/restore | **Pending operator drill** | Sanitized restore into a disposable target with application smoke checks. |
| Monitoring | **Pending operator setup** | Safe error events, database/Edge Function alerts, owners, escalation, and retention. |
| Performance | **Partially green** | VendorPackages chunk reduced to approximately 17.91 kB; mobile/network/query budgets still require staging measurement. |
| Accessibility | **Partially green** | Key admin/chat icon controls labeled; full keyboard, focus, dialog, contrast, and screen-reader audit remains pending. |
| Production build | **Green locally** | TypeScript, full tests, Vite build, and diff checks pass. |
| Rollback | **Pending staging drill** | Immutable frontend/function rollback and migration-specific recovery procedure exercised. |

## Decision

The final gate is **blocked**. Local source and migration replay evidence is strong, but staging does not yet exist or has not supplied the required cross-account, Storage, Edge Function, backup/restore, E2E, accessibility, and operational evidence. Production deployment must not proceed until every pending gate is explicitly green and an operator records approval against the exact release commit.
