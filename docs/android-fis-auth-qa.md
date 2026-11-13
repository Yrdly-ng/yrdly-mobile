# Android Firebase Installations FIS_AUTH_ERROR — QA APK #67

**Observed on physical Android device:** `Native notification setup failed: Fetching the token failed: java.util.concurrent.ExecutionException: java.io.IOException: FIS_AUTH_ERROR (step: native_token)`.

This happens in `Notifications.getDevicePushTokenAsync()` while Firebase Installations authenticates, **before** the Expo token exchange or Supabase save. It is not caused by the backend sender or the in-app self-test API.

## APK #67 audited locally (13 Nov 2026)

- GitHub Actions build: [#43413677349](https://github.com/Yrdly-ng/yrdly-mobile/actions/runs/43413677349)
- Uploaded artifact: `yrdly-android-apk-67`
- Actual APK signature: **APK Signature Scheme v2**, signer certificate **`CN=Android Debug`** (despite `assembleRelease`).
- SHA-1 (PUBLIC signing certificate):
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-256 (PUBLIC signing certificate):
  `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
- Compiled resources contain the expected project `yrdly-470221`, sender `399225255875` and a Firebase-style client API key. **The key's Google Cloud restriction status is not yet verified.**

## Priority recovery checklist (Firebase console access required)

1. Firebase → project **`yrdly-470221`** → **Project settings** → **Your apps** → select Android app **`com.yrdly`** → **Add fingerprint** for the exact QA APK #67 signing SHA-1 above. Add SHA-256 too. **This does not establish that the Google Cloud key restrictions are valid; check the next step.**
2. Google Cloud → project `yrdly-470221` → APIs & Services → Credentials. Locate the Android **client API key from the `com.yrdly` client in `google-services.json`**, without sharing it with chat or committing it. If it has **application restrictions**, check that `com.yrdly` + the SHA-1 above is an approved application. If it has **API restrictions**, check that **Firebase Installations API (`firebaseinstallations.googleapis.com`)** is in the allowed API list, alongside other Firebase APIs actually used by the app.
3. Ensure Firebase Installations API is enabled for project `yrdly-470221`. See [Firebase Android setup troubleshooting](https://firebase.google.com/support/guides/init-options) and [Firebase API key restrictions](https://firebase.google.com/docs/projects/api-keys).
4. Re-download the **current** `google-services.json` for `com.yrdly` from Firebase console after updating the project/app; store its full contents in the **GitHub Actions secret `GOOGLE_SERVICES_JSON`**, using authorized credential management only. Do not paste it into Jira/chat or commit it. Verify API key, sender, app ID using `scripts/validate-android-firebase.cjs`.
5. After changing Firebase configuration, install a freshly built authorized QA APK, open YRDLY, sign in, allow notifications and choose **Settings → Notifications → Send Test Notification**. `native_token` must succeed first; then inspect Expo exchange, Supabase saved registration, and actual device receipt. Try reinstall/cleared app storage if old Firebase Installations state persists.
6. Also check the **Expo FCM V1 service account** in the Expo dashboard against the same Firebase project. This is a **separate** sender-side credential check and **cannot resolve the current error before Firebase mints a token**.
7. A Google Play or EAS release-signed APK has a **different** signing SHA-1, which must also be registered when applicable. **Do not assume the QA debug SHA-1 applies to store-installed apps.**

## Prevent future regressions

- The validator verifies project ID, project number, package, app ID and Firebase Android client API-key presence/shape, without logging secret values.
- The GitHub APK workflow runs Android `apksigner verify --print-certs` on the **actual output file**, prints only the public signing certificate DN/SHA-1/SHA-256, and warns on debug-signed QA releases.
- Never enable mass notifications while testing credentials. No Supabase/staging credentials need to change for this issue.

## If Firebase configuration appears correct but FIS_AUTH_ERROR remains

Check Firebase Installations API error metrics and verify the phone has current Google Play services, correct date/time, and a stable connection; try a second authorized physical Android device. Firebase engineers identify this error as invalid Firebase options or service-side API authentication rejection; contact Firebase support with the project, package, and **public** signing fingerprint if needed. Do not include an API key, service account private key, or installation auth token in a support ticket.
