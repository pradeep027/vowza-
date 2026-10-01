/**
 * Phase L — OBSERVABILITY regression.
 *
 * Locks the self-contained error-reporting seam added in Phase L:
 *  - reportError normalizes any thrown value, always logs to console (the
 *    transport the production build keeps), forwards to an optional sink, and
 *    NEVER throws — not even if console or the sink throws.
 *  - Global handlers for 'error' and 'unhandledrejection' are installed once
 *    (idempotent) and SSR-safe (no-op without a window).
 *  - The module does NO network I/O and reads NO secrets/tokens/env/storage —
 *    so it cannot exfiltrate data or leak credentials (STOP: the real
 *    Sentry/Datadog transport that WOULD need a DSN stays parked, wired later
 *    via setErrorSink with no call-site changes).
 *  - ErrorBoundary and main.tsx route through this seam.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeError,
  reportError,
  setErrorSink,
  installGlobalErrorHandlers,
  __resetObservabilityForTests,
} from '../observability';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const OBS = repoFile('src/lib/observability.ts');
const BOUNDARY = repoFile('src/components/ErrorBoundary.tsx');
const MAIN = repoFile('src/main.tsx');

beforeEach(() => {
  __resetObservabilityForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeError — any thrown value becomes a safe shape', () => {
  it('keeps name/message/stack from an Error', () => {
    const n = normalizeError(new TypeError('boom'));
    expect(n.name).toBe('TypeError');
    expect(n.message).toBe('boom');
    expect(typeof n.stack).toBe('string');
  });

  it('handles strings, objects, and null without throwing', () => {
    expect(normalizeError('plain').message).toBe('plain');
    expect(normalizeError({ a: 1 }).message).toContain('"a":1');
    expect(() => normalizeError(null)).not.toThrow();
    // a circular object must not blow up JSON.stringify
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(() => normalizeError(circ)).not.toThrow();
  });
});

describe('reportError — always logs, forwards to sink, never throws', () => {
  it('logs through console.error with the [observability] tag and context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('x'), { source: 'unit', foo: 'bar' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, payload] = spy.mock.calls[0];
    expect(tag).toBe('[observability]');
    expect(payload).toMatchObject({ name: 'Error', message: 'x', source: 'unit', foo: 'bar' });
  });

  it('forwards to a registered sink and survives a throwing sink', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn(() => {
      throw new Error('sink down');
    });
    setErrorSink(sink);
    expect(() => reportError(new Error('y'), { source: 's' })).not.toThrow();
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('never throws even if console.error itself throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console down');
    });
    expect(() => reportError(new Error('z'))).not.toThrow();
  });
});

describe('installGlobalErrorHandlers — idempotent, SSR-safe, routes to reportError', () => {
  it('is a no-op when there is no window (SSR/node)', () => {
    // default vitest env is node → window is undefined; must not throw.
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    expect(() => installGlobalErrorHandlers()).not.toThrow();
  });

  it('registers error + unhandledrejection exactly once across repeated calls', () => {
    const add = vi.fn();
    vi.stubGlobal('window', { addEventListener: add } as unknown as Window);
    installGlobalErrorHandlers();
    installGlobalErrorHandlers(); // second call must be ignored
    const events = add.mock.calls.map((c) => c[0]);
    expect(events.filter((e) => e === 'error')).toHaveLength(1);
    expect(events.filter((e) => e === 'unhandledrejection')).toHaveLength(1);
  });

  it('an unhandled rejection is routed into reportError via console', () => {
    const handlers: Record<string, (ev: unknown) => void> = {};
    vi.stubGlobal('window', {
      addEventListener: (name: string, fn: (ev: unknown) => void) => {
        handlers[name] = fn;
      },
    } as unknown as Window);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installGlobalErrorHandlers();
    handlers.unhandledrejection({ reason: new Error('async fail') });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toMatchObject({
      message: 'async fail',
      source: 'unhandledrejection',
    });
  });
});

describe('observability — self-contained, leaks nothing (security contract)', () => {
  it('performs no network I/O and touches no secrets/storage/env', () => {
    for (const bad of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /navigator\.sendBeacon/,
      /localStorage/,
      /sessionStorage/,
      /document\.cookie/,
      /import\.meta\.env/,
      /process\.env/,
    ]) {
      expect(OBS, `observability must not reference ${bad}`).not.toMatch(bad);
    }
  });

  it('is wired into ErrorBoundary and main.tsx', () => {
    expect(BOUNDARY).toMatch(/from ['"]@\/lib\/observability['"]/);
    expect(BOUNDARY).toMatch(/reportError\(/);
    // the old ad-hoc raw log is gone
    expect(BOUNDARY).not.toMatch(/console\.error\(\s*["']\[ErrorBoundary\]/);
    expect(MAIN).toMatch(/installGlobalErrorHandlers\(\)/);
  });
});
