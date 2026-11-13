const fs = require('node:fs');

// Public identifiers of the Firebase project whose FCM account is assigned in EAS.
const expectedFirebase = {
  projectId: 'yrdly-470221',
  senderId: '399225255875',
  packageName: 'com.yrdly',
};

function validateAndroidFirebase(config) {
  const project = config?.project_info;
  if (project?.project_id !== expectedFirebase.projectId ||
      String(project?.project_number) !== expectedFirebase.senderId) {
    throw new Error('Android Firebase sender does not match YRDLY’s configured Expo FCM project.');
  }
  const client = config?.client?.find(entry =>
    entry?.client_info?.android_client_info?.package_name === expectedFirebase.packageName);
  if (!client || !client.client_info.mobilesdk_app_id?.startsWith(`1:${expectedFirebase.senderId}:android:`)) {
    throw new Error('Android Firebase application does not match com.yrdly and its configured sender.');
  }

  // Firebase Installations requires an Android client API key, not just the
  // correct project number and mobilesdk_app_id. The former validator accepted
  // configurations with no key, resulting in FIS_AUTH_ERROR on-device.
  //
  // This checks the key's presence and format ONLY; Firebase/Google Cloud
  // restrictions (API allowlist, package name and APK signing SHA-1) must also
  // be verified for the actual signed build in the Cloud Console.
  const keys = client.api_key;
  const hasClientKey = Array.isArray(keys) && keys.some(entry =>
    typeof entry?.current_key === 'string' &&
    /^AIza[A-Za-z0-9_-]{35}$/.test(entry.current_key)
  );
  if (!hasClientKey) {
    throw new Error(
      'Android Firebase client API key missing or malformed. Download the current google-services.json from Firebase Project Settings for com.yrdly.'
    );
  }
}

if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(process.argv[2] || 'google-services.json', 'utf8'));
  validateAndroidFirebase(config);
  console.log('Android Firebase project, sender and application verified.');
}

module.exports = { validateAndroidFirebase };
