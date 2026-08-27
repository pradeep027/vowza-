# Phase 13 — Critical E2E test contract

This contract defines the browser journeys that must run against the isolated staging environment. It intentionally adds no dependency because the repository currently has no Playwright or Cypress runner; the operator may wire the existing organization-approved browser runner in staging without changing application behavior.

| Journey | Primary actor | Required assertions | Negative/boundary assertions |
|---|---|---|---|
| Sign up and login | Synthetic customer | Account creation, confirmation behavior, login, session restoration, dashboard navigation. | Invalid credentials, duplicate account, expired session, logout, and cross-account data isolation. |
| Provider onboarding | Synthetic provider | Profile form, private document upload, portfolio upload, pending status, and safe completion. | Invalid file type/size, wrong document classification, duplicate submission, missing required fields, and no provider role before approval in the pending flow. |
| Event creation | Synthetic customer | Valid event creation, persistence, and return to the event dashboard. | Required-field validation, invalid dates, empty state, retry after transient failure, and wrong-owner update/delete denial. |
| Planner and budget | Synthetic customer | Event-aware planner generation, budget allocation, and follow-up chat context. | Missing event type, invalid budget, event alias normalization, retry, and no cross-event contamination. |
| Vendor discovery/profile | Logged-out visitor | `/`, `/artists`, category route, provider route, public projection, portfolio, and published packages render. | Missing provider, unpublished provider, sensitive KYC fields absent, and failed related query produce safe empty/error states. |
| Booking and checkout | Synthetic customer/vendor | Booking creation, status transition, checkout, and confirmation. | Unavailable package, invalid date, wrong owner, payment failure, retry, and unauthorized mutation. |
| KYC operator review | Synthetic provider/admin | Pending submission, admin review, approve/reject, notification, and role transition. | Customer cannot review documents, wrong admin cannot approve, rejected documents remain inaccessible, and deleted objects cannot be fetched. |
| Chat/media | Synthetic customer/vendor pair | Eligible booking chat, text, upload, render-time signed media, expiry, and realtime update. | Non-participant cannot enumerate/read/upload/delete; deleted object fails after refresh; public URL access is unavailable. |
| Account/settings | Synthetic customer | Profile update, password change, settings, and account deletion. | Invalid input, failed deletion, session expiry, and inability to target another account. |
| Admin role management | Synthetic super-admin/admin | List admins, grant/revoke admin, audit record, and refresh. | Non-admin denied, self-modification denied, super-admin protected, invalid target rejected, and client actor ID ignored. |

## Execution order

Run each journey first on a fresh synthetic database/storage seed, then repeat the permission-boundary cases with separate customer, vendor, admin, and super-admin accounts. Capture HTTP status, visible UI result, database-side policy result, and Storage object result. Do not capture document contents, secrets, tokens, or raw KYC paths.

The suite is release-blocking until the staging project exists and all rows above are green. Local Vitest, TypeScript, and Vite checks are necessary but cannot substitute for these browser and cross-account assertions.
