# Next implementation — dependency remediation

This branch addresses the first actionable dependency finding without upgrading packages or changing application behavior outside dependency reachability.

## Change made

`face-api.js` was declared as a direct production dependency but has no import or require site in the canonical `src/` or `supabase/` source. The active liveness implementation uses MediaPipe Face Mesh instead. The unused dependency was removed from `package.json` and `package-lock.json`, along with its unreachable TensorFlow core, nested `node-fetch@2.1.2`, and nested `tslib` lockfile entries.

This removes the vulnerable TensorFlow/node-fetch chain from the committed production graph without changing a dependency version.

## Audit result

| Check | Before | After |
|---|---:|---:|
| Production dependency advisories | 5: 2 low, 2 moderate, 1 high, 0 critical | 2 moderate, 0 high, 0 low, 0 critical |
| TypeScript | Pass | Pass |
| Vitest | 13 files / 480 tests pass | 13 files / 480 tests pass |
| Vite build | Pass | Pass |
| Lockfile diff | N/A | 44 targeted deletions only |
| `git diff --check` | Pass | Pass |

## Remaining advisories

The two remaining moderate advisories affect `react-router` through direct `react-router-dom@6.30.1`. The available automated fix is a major upgrade to React Router 7. It was not applied because the application currently uses the React Router 6 contract and the repository’s standing rule prohibits unreviewed dependency upgrades. A separate compatibility branch must first inventory `Link`/`navigate` destinations, validate the open-redirect advisory against actual user-controlled paths, and run the complete auth/routing/E2E suite before considering React Router 7.

## Scope decision

No audit exclusion, forced major upgrade, dependency downgrade, or unrelated source cleanup was used. This branch is limited to removing an unused direct dependency and its unreachable lockfile subtree.
