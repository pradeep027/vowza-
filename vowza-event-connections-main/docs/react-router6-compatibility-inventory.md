# React Router 6 compatibility and navigation-security inventory

## Scope and baseline

This review is isolated to branch `manus/router-compatibility`, based on the completed dependency-remediation head `a89ed06`. It does **not** upgrade React Router, change `main`, deploy, or touch Supabase. The application currently declares `react-router-dom@^6.30.1`, React 18, and React DOM 18. The router is a `BrowserRouter` around an eagerly declared `Routes` tree inside `src/App.tsx`; the tree is rendered below a `Suspense` boundary for page-level lazy imports.

The existing package script `test` runs a selected subset of tests. The full suite is available through `test:all` and was used for the prior review chain. No Playwright or Cypress dependency is present, so browser E2E evidence remains a staging/operator responsibility.

## Route inventory

The route tree has three public groups, three protected standalone routes, and three protected layout groups. Parameters are URL path parameters unless otherwise noted. Query parameters are consumed as feature filters or checkout context; no route accepts a generic external return URL.

| Route | Auth required | Role | Parameters | Query parameters | Redirects / guards |
|---|---|---|---|---|---|
| `/` | No | Any | None | None | None |
| `/test-features` | No | Any | None | None | Test-only page; no route guard in `App.tsx` |
| `/auth` | No | Any | None | `mode=reset` is used for password reset UI | Fixed post-auth destination based on role: `/admin/dashboard`, `/vendor/dashboard`, or `/` |
| `/auth/callback` | No | Any | None | None | Fixed `/` when authenticated without a saved return action; fixed `/auth` otherwise |
| `/artists` | No | Any | None | Search/category/event filters | None |
| `/event/:eventId` | No | Any | `eventId` | Feature-specific event context | None in route declaration |
| `/ai-planner` | No | Any | None | Feature-specific planner state | None in route declaration |
| `/contact` | No | Any | None | None | None |
| `/privacy` | No | Any | None | None | Uses contextual back navigation with safe fallback `/` |
| `/terms` | No | Any | None | None | Uses contextual back navigation with safe fallback `/` |
| `/about` | No | Any | None | None | None |
| `/category/:slug` | No | Any | `slug` | Category-specific filters | None |
| `/provider/:id` | No | Any | `id` | None | None |
| `/artist/:id` | No | Any | `id` | None | None |
| `/select-account-type` | Yes | Any authenticated user | None | None | `ProtectedRoute`; unauthenticated users receive the auth modal or fixed `/auth` fallback |
| `/browse` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `/my-bookings` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `/event-dashboard` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `/chat/:bookingId` | Yes | Any authenticated user | `bookingId` | None | `ProtectedRoute` |
| `/checkout` | Yes | Any authenticated user | None | Cart/vendor context may be supplied by callers | `ProtectedRoute` |
| `/catering-cart` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `/cart` | Yes | Any authenticated user | None | `vendor`, `category` scope values | `ProtectedRoute` |
| `/provider/register` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `/artist/onboarding` | Yes | Any authenticated user | None | None | `ProtectedRoute`; completion destination is selected from a fixed role-to-dashboard map |
| `/vendor/edit` | Yes | `provider` | None | None | `ProtectedRoute allowedRoles={['provider']}`; wrong roles go to a fixed dashboard or `/` |
| `/provider/dashboard` | Yes | `provider` | None | None | `ProtectedRoute allowedRoles={['provider']}`; wrong roles go to a fixed dashboard or `/` |
| `/admin` | Yes | `admin` via `AdminLayout` | None | None | `AdminLayout` owns auth/role handling |
| `/admin/dashboard` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/artists` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/customers` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/bookings` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/payments` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/categories` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/reviews` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/announcements` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/notifications` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/analytics` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/coupons` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/event-packages` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/reports` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/support` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/ai-planner` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/cms` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/settings` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/admins` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/audit-logs` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/system-health` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/auth-promotion` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/admin/about-us` | Yes | `admin` | None | None | Nested under `AdminLayout` |
| `/dashboard` | Yes | customer layout role | None | None | `CustomerLayout` owns auth/role handling |
| `/dashboard/bookings` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/wishlist` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/notifications` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/profile` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/payments` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/reviews` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/ai-planner` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/settings` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/dashboard/help` | Yes | customer layout role | None | None | Nested under `CustomerLayout` |
| `/vendor` | Yes | provider via `VendorLayout` | None | None | `VendorLayout` owns auth/role handling |
| `/vendor/dashboard` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/bookings` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/calendar` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/inquiries` | Yes | provider | None | None | Nested under `VendorLayout`; renders vendor bookings |
| `/vendor/messages` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/notifications` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/portfolio` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/packages` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/reviews` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/analytics` | Yes | provider | None | None | Nested under `VendorLayout`; renders vendor dashboard |
| `/vendor/wallet` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/settings` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/vendor/help` | Yes | provider | None | None | Nested under `VendorLayout` |
| `/booking-success` | Yes | Any authenticated user | None | None | `ProtectedRoute` |
| `*` | No | Any | None | None | Renders `NotFound` |

## Redirect and open-redirect assessment

The review found no `redirect`, `returnUrl`, `redirectTo`, `callbackUrl`, invitation, or `next` query parameter that is accepted as a generic destination and passed to React Router. The password-reset `redirectTo` is constructed from `window.location.origin` and the fixed path `/auth?mode=reset`; it is not copied from user input.

The main authentication return path is also internally sourced: `ProtectedRoute` passes `location.pathname` and serialized current query parameters to `useAuthRedirect.setReturnTo`. Before this branch, `useAuthRedirect` read the stored `path` from `sessionStorage` and passed it to `navigate()` without validation. The branch now validates both write-time and read-time paths, accepts only absolute same-origin SPA paths beginning with one `/`, and falls back to `/` if a stored value is invalid.

`useBackNavigation` consumed `location.state.from` dynamically. Normal producers in the application pass a current pathname or a fixed internal path, but the sink did not enforce that contract. The branch now validates `state.from` and the fallback before navigating.

`MarkdownMessage` previously decided that any string beginning with `/` was an internal React Router link. That incorrectly included protocol-relative URLs such as `//evil.example`. The branch now classifies links through `safeNavigation.ts`: valid internal paths use `<Link>`, valid HTTP(S) URLs use a normal external anchor with `target="_blank"` and `rel="noopener noreferrer"`, and dangerous or malformed targets render as text. This is a relevant model/content boundary because markdown text can be supplied by chat/AI responses.

`AIResponseCards` previously passed the model-generated `vowzaSearchUrl` directly to `<Link>`. It now applies the same classifier and will render a model-generated HTTP(S) link as an external anchor or omit an invalid target rather than sending it through React Router.

The current application’s static route destinations, role redirects, notification route map, dashboard links, and provider/category links are internally bounded or derived from validated application records. Search and filter values are encoded into ordinary internal paths and are not treated as redirect destinations.

## React Router 7 compatibility conclusions

The current tree uses the declarative v6 APIs `BrowserRouter`, `Routes`, `Route`, `Link`, `Navigate`, `useNavigate`, `useLocation`, and `useParams`. No data routers, loaders, actions, `redirect()` helpers, SSR hydration APIs, `createBrowserRouter`, or `useLoaderData` usage was identified in the canonical source. The app uses nested routes and layout outlets through components, not data-router route objects.

A future Router 7 branch should still inventory relative navigation, splat behavior, route ranking, lazy imports, authentication guards, and deep-link fallback behavior. It must not be created by running `npm audit fix --force`. The current branch intentionally does not modify `react-router-dom` or its transitive packages because the available automated fix is a major-version migration and the repository rule requires an explicit compatibility decision.

## Regression coverage added

`src/lib/safeNavigation.test.ts` covers accepted internal paths, protocol-relative paths, external HTTP(S) URLs, dangerous schemes, backslashes, whitespace/control characters, malformed targets, and unsafe fallbacks. The test is deliberately dependency-free and does not claim browser E2E coverage.

## Remaining evidence

The route inventory and unit-level navigation policy are complete on this branch. The following remain staging/operator evidence rather than local claims: browser back/forward behavior, direct deep-link loading through the deployed host, unauthenticated and wrong-role rendering in a real browser, cross-account auth journeys, mobile layout behavior, and any Router 7 before/after comparison. React Router 7 remains unapproved and unimplemented.

## Sources in the repository

The inventory is derived from `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/hooks/useAuthRedirect.ts`, `src/hooks/useBackNavigation.ts`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`, `src/components/ai/MarkdownMessage.tsx`, `src/components/ai/AIResponseCards.tsx`, and bounded source searches for React Router imports and navigation sinks.
