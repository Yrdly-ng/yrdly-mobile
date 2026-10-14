// Follow the same public authorization endpoint used by AuthService. Never
// print Google's Location URL: it contains a transient OAuth state value.
import assert from 'node:assert/strict';

const targets = {
  qa: 'jxgpvvehajxegeeozlnl.supabase.co',
  production: 'api.yrdly.ng',
};
const target = process.argv[2];
assert.ok(Object.hasOwn(targets, target), 'Usage: node qa-scripts/oauth-preflight.mjs qa|production');
const host = targets[target];
const authorize = new URL(`https://${host}/auth/v1/authorize`);
authorize.searchParams.set('provider', 'google');
authorize.searchParams.set('redirect_to', 'yrdlymobile://auth/callback');

try {
  const response = await fetch(authorize, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 302, 'Supabase did not redirect to Google');
  const google = new URL(response.headers.get('location'));
  assert.equal(google.hostname, 'accounts.google.com', 'Unexpected OAuth provider');
  assert.equal(google.searchParams.get('redirect_uri'), `https://${host}/auth/v1/callback`, 'Unexpected backend callback');
  const page = await fetch(google, { signal: AbortSignal.timeout(20000) });
  const body = await page.text();
  assert.ok(!/redirect_uri_mismatch/.test(body), 'Google rejects the backend callback: redirect_uri_mismatch');
  assert.ok(!/invalid_request|invalid_client/.test(body), 'Google rejected the authorization request');
  assert.ok(page.ok && /identifierId|signin\/identifier|Sign in/i.test(body), 'Google sign-in page was not reached');
  console.log(`${target}: Google accepts the backend callback and serves sign-in. A completed account sign-in remains a separate device check.`);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'OAuth preflight unavailable; request details withheld');
  process.exitCode = 1;
}
