const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { validateAndroidFirebase } = require('./validate-android-firebase.cjs');

/** Exercise only a synthetic installation; never log keys, tokens or provider bodies. */
async function verifyFirebaseInstallations(config, fetcher = fetch) {
  validateAndroidFirebase(config);
  const client = config.client.find(c => c.client_info?.android_client_info?.package_name === 'com.yrdly');
  const key = client.api_key?.[0]?.current_key;
  if (typeof key !== 'string' || !/^AIza[\w-]{35}$/.test(key)) throw new Error('Firebase client API key is missing or malformed.');
  const bytes = randomBytes(17); bytes[0] = (bytes[0] & 15) | 112;
  const fid = bytes.toString('base64url').slice(0, 22);
  const base = `https://firebaseinstallations.googleapis.com/v1/projects/${config.project_info.project_id}/installations`;
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  async function request(url, method, body, authorization) {
    // Match the SDK's one bounded retry for transient provider failures.
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try { response = await fetcher(url, { method, headers: { ...headers, ...(authorization ? { Authorization: authorization } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) }); }
      catch { throw new Error('Firebase Installations could not be reached; credentials remain unverified.'); }
      let data = {}; try { data = await response.json(); } catch { /* DELETE may have no body. */ }
      if (response.status >= 500 && attempt === 0) continue;
      return { status: response.status, data };
    }
  }
  const created = await request(base, 'POST', { fid, appId: client.client_info.mobilesdk_app_id, authVersion: 'FIS_v2', sdkVersion: 'a:0.0.0' });
  if (created.status !== 200) {
    const providerError = created.data.error || {};
    const reasons = Array.isArray(providerError.details)
      ? providerError.details.map(d => ({
          reason: d.reason || d['@type'] || undefined,
          service: d.metadata?.service || undefined,
          consumer: d.metadata?.consumer || undefined,
          permission: d.metadata?.permission || undefined
        })).filter(d => Object.values(d).some(Boolean))
      : [];
    // Log only Google's structured diagnostic fields; never echo request headers or API keys.
    const diagnostic = JSON.stringify({
      status: providerError.status || undefined,
      message: providerError.message || undefined,
      reasons
    });
    throw new Error(`Firebase Installations rejected the client configuration (HTTP ${created.status}). Google diagnostic: ${diagnostic}. Check the API key's API restrictions and Firebase Installations API enablement.`);
  }
  const refresh = created.data.refreshToken;
  const actualFid = created.data.fid;
  if (typeof refresh !== 'string' || actualFid !== fid) throw new Error('Firebase returned an incomplete synthetic installation; credentials remain unverified.');
  try {
    const token = await request(`${base}/${fid}/authTokens:generate`, 'POST', { installation: { sdkVersion: 'a:0.0.0', appId: client.client_info.mobilesdk_app_id } }, `FIS_v2 ${refresh}`);
    if (token.status !== 200 || typeof token.data.token !== 'string') throw new Error(`Firebase installation authentication failed (HTTP ${token.status}); do not distribute this build.`);
  } finally {
    const deleted = await request(`${base}/${fid}`, 'DELETE', undefined, `FIS_v2 ${refresh}`);
    if (![200,204,404].includes(deleted.status)) throw new Error(`Synthetic Firebase installation cleanup failed (HTTP ${deleted.status}).`);
  }
}
if (require.main === module) {
  Promise.resolve().then(() => verifyFirebaseInstallations(JSON.parse(fs.readFileSync(process.argv[2] || 'google-services.json', 'utf8'))))
    .then(() => console.log('Firebase client key and installation authentication verified; synthetic installation removed.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { verifyFirebaseInstallations };
