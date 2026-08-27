# Phase 16 — Dependency and code-quality audit

This audit was run on the review branch without upgrading dependencies, deleting files, contacting production, or modifying Supabase configuration.

| Check | Result | Interpretation |
|---|---:|---|
| TypeScript | Passed | `tsc --noEmit` completes successfully on the canonical source. |
| Full Vitest suite | 13 files / 480 tests passed on the preceding ordered branch | No regression was introduced by the audit branch setup. |
| Vite production build | Passed on the preceding ordered branch | The build remains functional; chunk-size optimization is tracked separately. |
| `git diff --check` | Passed | No whitespace errors in the audit changes. |
| ESLint | 1,985 problems: 1,893 errors and 92 warnings | Existing broad lint debt remains; global lint should not be made a blocking CI gate until staged cleanup is complete. |
| `npm audit --omit=dev` | 5 vulnerabilities: 2 low, 2 moderate, 1 high, 0 critical | Dependency remediation requires a separate compatibility-reviewed dependency branch; no upgrade was made in this phase. |
| Production source maps | Disabled | `vite.config.ts` sets `build.sourcemap` to `false`; this reduces source exposure but requires an error-monitoring strategy that does not depend on public source maps. |
| Browser-exposed secrets | No service-role or server secret found in `VITE_*` application values during the source scan | `VITE_SUPABASE_ANON_KEY`/publishable key are public by design; HMAC, JWT signing, service-role, and provider credentials must remain server-only. |

## Findings requiring follow-up

The global lint result includes legacy root scripts, broad explicit-`any` usage, and formatting/style debt beyond the scope of this phase. The safe remediation strategy is to clean canonical reachable source by feature group and only then enable a full lint gate. The current targeted release gate remains typecheck plus the supported regression suite.

The production dependency audit identified five advisories in the installed production graph. Because dependency changes can alter authentication, Storage, routing, and build behavior, the advisories require a separate branch with lockfile review, compatibility tests, and an explicit decision for each package. No dependency version or lockfile was changed here.

The repository contains scripts that mention service-role environment variables for operator-run migration or verification tasks. Those references are not browser-bundled application secrets, but they must remain excluded from Vite imports and must never receive a production value through a committed `.env` file. The Edge Functions continue to read service-role credentials only from their server-side environment.

## Release decision

Step 16 is **not a clean-code completion claim**. TypeScript and local tests are green, but global lint debt and dependency advisories remain launch review items. The next step can verify the exact production build gates, while dependency remediation should remain isolated from security migrations.
