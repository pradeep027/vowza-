// ─── getErrorMessage ──────────────────────────────────────────────────────────
// Behavior-preserving replacement for the `catch (err: any) { err.message }`
// pattern. Returns err.message when it is a non-empty string (matching the old
// `err.message || fallback` for both Error instances and Supabase/Postgrest
// error objects, which are plain objects carrying a `message` string), and the
// fallback otherwise. Does not change any runtime message the user already saw.
export function getErrorMessage(err: unknown, fallback = ''): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}
