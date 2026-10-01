/**
 * verify-document authentication + fail-closed hardening (SECURITY FIX).
 *
 * THE GAP (audited):
 *   supabase/functions/verify-document/index.ts previously (a) performed NO
 *   end-user authentication — it trusted any caller bearing the project anon key
 *   (config.toml verify_jwt validates only that a project JWT is present, which
 *   the anon key satisfies) — and (b) never validated the body `userId`. The
 *   client (src/utils/documentVerification.ts) then FAILED OPEN: on any server
 *   error / empty response it returned `status: 'verified'` from local OCR alone.
 *
 * WHY STRONG KYC IS ARCHITECTURALLY IMPOSSIBLE HERE (documented, not hidden):
 *   the edge function never receives the document bytes — only a client-produced
 *   OCR classification summary — so it cannot independently confirm authenticity.
 *   The returned status is therefore ADVISORY (a UX gate), and real provider
 *   trust is enforced downstream by admin approval + the Phase F self-approval
 *   trigger. A fabricated "verified" grants no capability.
 *
 * THE FIX:
 *   Edge: require an authenticated user (GoTrue getUser() via the forwarded JWT;
 *   401 otherwise), reject a body/token userId mismatch (403), stamp every
 *   response `advisory: true`, and document the KYC limitation inline.
 *   Client: FAIL CLOSED — a server error/empty result returns `error`, never
 *   `verified`.
 *
 * WHAT THIS TEST LOCKS: a STATIC contract regression (edge fns run in Deno, not
 * under vitest; tsc excludes them). It cannot regress silently to trusting the
 * client or failing open.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const EDGE = repoFile('supabase/functions/verify-document/index.ts');
const CLIENT = repoFile('src/utils/documentVerification.ts');
const UPLOAD_CARD = repoFile('src/components/DocumentUploadCard.tsx');
const PROVIDER_REG = repoFile('src/pages/ProviderRegistration.tsx');

describe('verify-document edge — enforces an authenticated user', () => {
  it('creates an anon-scoped client with the caller JWT and calls getUser()', () => {
    expect(EDGE).toMatch(/import \{ createClient \} from "https:\/\/esm\.sh\/@supabase\/supabase-js@2"/);
    expect(EDGE).toMatch(/global: \{ headers: \{ Authorization: authHeader \} \}/);
    expect(EDGE).toMatch(/callerClient\.auth\.getUser\(\)/);
  });

  it('returns 401 when there is no Authorization header or no user', () => {
    expect(EDGE).toMatch(/const authHeader = req\.headers\.get\('Authorization'\)/);
    expect(EDGE).toMatch(/if \(!authHeader\)[\s\S]*?Authentication required[\s\S]*?401/);
    expect(EDGE).toMatch(/if \(authErr \|\| !user\)[\s\S]*?Authentication required[\s\S]*?401/);
  });

  it('rejects a body userId that does not match the authenticated user (403)', () => {
    expect(EDGE).toMatch(/if \(input\.userId && input\.userId !== user\.id\)[\s\S]*?User mismatch[\s\S]*?403/);
  });
});

describe('verify-document edge — advisory result + documented KYC limitation', () => {
  it('stamps every response advisory: true', () => {
    expect(EDGE).toMatch(/\{ \.\.\.result, advisory: true \}/);
  });

  it('documents that the server never receives bytes and the result is advisory', () => {
    expect(EDGE).toMatch(/NEVER receives the uploaded document bytes/i);
    expect(EDGE).toMatch(/ADVISORY ONLY/);
    expect(EDGE).toMatch(/NOT an authorization or\s*\/\/\s*trust boundary/);
    // Points at the real downstream enforcement so the rationale cannot rot.
    expect(EDGE).toMatch(/self-verifying/);
  });

  it('still enforces the type-mismatch and file-sanity gates in decide()', () => {
    expect(EDGE).toMatch(/if \(detectedType !== expectedType\)/);
    expect(EDGE).toMatch(/status: 'wrong_type'/);
    expect(EDGE).toMatch(/Invalid file type/);
  });
});

describe('verify-document client — fails CLOSED on server failure', () => {
  it('returns error (never verified) when the edge call errors or is empty', () => {
    const block = CLIENT.match(/if \(serverError \|\| !serverResult\) \{([\s\S]*?)\n    \}/);
    expect(block, 'serverError guard block not found').toBeTruthy();
    // Strip // comments so the explanatory note (which mentions the old
    // 'verified' behavior) does not defeat the negative assertion.
    const code = block![1].replace(/\/\/[^\n]*/g, '');
    expect(code).toMatch(/status: 'error'/);
    expect(code).not.toMatch(/status: 'verified'/);
    expect(block![1]).toMatch(/FAIL-CLOSED/);
  });

  it('still forwards the userId to the edge function for cross-check', () => {
    expect(CLIENT).toMatch(/supabase\.functions\.invoke\('verify-document'/);
    expect(CLIENT).toMatch(/userId: _userId/);
  });
});

describe('verify-document — the auth gate does not break the legit KYC flow', () => {
  it('the upload card passes the signed-in user id', () => {
    expect(UPLOAD_CARD).toMatch(/verifyDocument\(/);
    expect(UPLOAD_CARD).toMatch(/user\?\.id/);
  });

  it('the KYC/registration page already requires an authenticated user', () => {
    // If this redirect is removed the "auth gate is safe" rationale changes.
    expect(PROVIDER_REG).toMatch(/if \(!loading && !user\)[\s\S]*?navigate\('\/auth'\)/);
  });
});
