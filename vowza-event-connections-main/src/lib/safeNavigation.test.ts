import { describe, expect, it } from 'vitest';
import { classifySafeLink, isSafeInternalPath, sanitizeInternalPath } from './safeNavigation';

describe('safe navigation policy', () => {
  it('accepts absolute internal SPA paths with query and hash components', () => {
    expect(isSafeInternalPath('/artists')).toBe(true);
    expect(isSafeInternalPath('/artist/123?from=search#reviews')).toBe(true);
    expect(sanitizeInternalPath('/dashboard', '/')).toBe('/dashboard');
  });

  it('rejects protocol-relative, schemed, backslash, and whitespace destinations', () => {
    for (const value of [
      '//evil.example/account',
      'https://evil.example',
      'javascript:alert(1)',
      '/\\evil.example',
      '/artists\n/evil',
      ' artists',
    ]) {
      expect(isSafeInternalPath(value), value).toBe(false);
      expect(sanitizeInternalPath(value, '/')).toBe('/');
    }
  });

  it('never classifies external URLs as internal router destinations', () => {
    expect(classifySafeLink('https://example.com/help')).toEqual({
      kind: 'external',
      href: 'https://example.com/help',
    });
    expect(classifySafeLink('http://example.com/')).toEqual({
      kind: 'external',
      href: 'http://example.com/',
    });
    expect(classifySafeLink('//evil.example')).toBeNull();
    expect(classifySafeLink('javascript:alert(1)')).toBeNull();
    expect(classifySafeLink('mailto:test@example.com')).toBeNull();
  });

  it('uses a safe root fallback when a caller supplies an unsafe fallback', () => {
    expect(sanitizeInternalPath(undefined, 'https://evil.example')).toBe('/');
    expect(sanitizeInternalPath('//evil.example', '//other.example')).toBe('/');
  });
});
