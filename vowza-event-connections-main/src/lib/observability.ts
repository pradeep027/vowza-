/**
 * Observability — a single, self-contained error-reporting seam.
 *
 * WHY: before this, the only error capture was ErrorBoundary.componentDidCatch
 * (React *render* errors) logging straight to console. Errors thrown in event
 * handlers, timers, async callbacks, and REJECTED PROMISES were caught by
 * nothing — they vanished. This module adds global capture and gives the app a
 * single sink (`reportError`) so error handling is consistent and there is ONE
 * place to later attach a transport (Sentry/Datadog) — see `setErrorSink`.
 *
 * SECURITY / PRIVACY:
 *  - This module performs NO network I/O and reads NO secrets, tokens, env, or
 *    storage. It only forwards what the caller hands it.
 *  - Callers MUST NOT pass secrets or PII in `context`. Keep context to small,
 *    non-sensitive structured tags (a source label, an id already visible to
 *    the user, a flag). The sink does not walk app state.
 *  - Output goes through `console.error`, which the production build KEEPS
 *    (vite.config.ts drops only console.log/info/debug via esbuild `pure`),
 *    so captured errors remain visible in the shipped bundle.
 *
 * The actual Sentry/Datadog wiring stays parked (needs a DSN / credential);
 * when it lands it registers here via `setErrorSink` and nothing else changes.
 */

export interface ErrorContext {
  /** Where the error originated, e.g. 'ErrorBoundary' | 'window.onerror'. */
  source?: string;
  /** React component stack, when reporting from an error boundary. */
  componentStack?: string;
  /** Small, non-sensitive structured extras. Never secrets or PII. */
  [key: string]: unknown;
}

/** Normalized, serializable shape of any thrown value. */
export interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

/** Optional additional transport (e.g. Sentry). Registered in production only. */
type ErrorSink = (error: NormalizedError, context: ErrorContext) => void;

let sink: ErrorSink | null = null;
let installed = false;

/** Coerce any thrown value (Error, string, object, null) into a safe shape. */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }
  try {
    return { name: 'NonError', message: JSON.stringify(error) };
  } catch {
    return { name: 'NonError', message: String(error) };
  }
}

/**
 * Register an additional transport. The single integration point for a future
 * Sentry/Datadog hookup — passing it here means no call site changes. Pass null
 * to clear. Reporting ALWAYS also goes to console regardless of the sink.
 */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

/**
 * Report an error from anywhere. Never throws — a failure inside reporting must
 * not take down the surrounding code path.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  const normalized = normalizeError(error);
  try {
    // Baseline transport: survives the production build (console.error kept).
    console.error('[observability]', { ...normalized, ...context });
  } catch {
    /* never let logging throw */
  }
  if (sink) {
    try {
      sink(normalized, context);
    } catch {
      /* a broken transport must not break the app */
    }
  }
}

/**
 * Install process-wide handlers for errors and unhandled promise rejections.
 * Idempotent and SSR-safe. Call once at app startup.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? event.message, {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}

/** Test-only: reset module state between cases. */
export function __resetObservabilityForTests(): void {
  sink = null;
  installed = false;
}
