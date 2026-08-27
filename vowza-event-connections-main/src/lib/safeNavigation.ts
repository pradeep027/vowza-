export type SafeLinkTarget =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string };

const CONTROL_OR_WHITESPACE = /[\u0000-\u0020\u007f]/;

/**
 * Accept only absolute, same-origin SPA paths for React Router destinations.
 * Protocol-relative paths, backslashes, schemes, and control/whitespace
 * characters are rejected because browsers may normalize them into external
 * destinations or ambiguous URLs.
 */
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  if (CONTROL_OR_WHITESPACE.test(value)) return false;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

export function sanitizeInternalPath(value: unknown, fallback = '/'): string {
  if (isSafeInternalPath(value)) return value;
  return isSafeInternalPath(fallback) ? fallback : '/';
}

/**
 * Classify markdown/AI links without ever sending an external URL through
 * React Router. Explicit HTTP(S) links remain normal anchors; all other
 * schemes and malformed targets are rejected by returning null.
 */
export function classifySafeLink(value: unknown): SafeLinkTarget | null {
  if (isSafeInternalPath(value)) return { kind: 'internal', href: value };
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  if (CONTROL_OR_WHITESPACE.test(value) || value.startsWith('//') || value.includes('\\')) return null;

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { kind: 'external', href: url.toString() };
    }
  } catch {
    // Invalid link syntax is rendered as plain text by the caller.
  }

  return null;
}
