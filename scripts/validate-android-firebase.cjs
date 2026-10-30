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
}

if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(process.argv[2] || 'google-services.json', 'utf8'));
  validateAndroidFirebase(config);
  console.log('Android Firebase project, sender and application verified.');
}

module.exports = { validateAndroidFirebase };
