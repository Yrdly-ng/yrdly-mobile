# Android Firebase registration release gate

APK #72 was downloaded from its GitHub Actions artifact and its compiled Android resources inspected. The `google_api_key` resource SHA-256 is `f46314d52071bbf12734aa86e54d31b74468851e7a618359af1da63dd4df2d90`; app ID is `1:399225255875:android:6475b121afd9c16a30af76`, sender `399225255875`, project `yrdly-470221`, package `com.yrdly`.

On 16 November 2026, a Firebase Installations registration request with that exact client key returned HTTP 400 with reason `API_KEY_INVALID`. The new preflight reproduced that rejection. This establishes that the compiled key is currently invalid; it does not verify that the differently named key visible in Google Cloud screenshots is the same key.

After replacing `GOOGLE_SERVICES_JSON` with a valid Android client configuration, run `node scripts/verify-firebase-installations.cjs`. It validates project/app/sender, registers a synthetic installation, exercises installation authentication and deletes that synthetic installation. Raw API keys, tokens and provider messages are never logged. A successful preflight proves client configuration acceptance, not Android push delivery. An API key restricted to an Android certificate may require a device-based check instead of this server-side preflight; do not weaken restrictions to make the test pass.

The GitHub Android build performs this check before Expo prebuild/Gradle compilation. Do not repeatedly create APKs with the rejected key. The installed app must then successfully obtain its device token, exchange it for an Expo token, register the token against the authenticated installation and receive/open a controlled test push. Daily reminders remain strict opt-in and require the backend's approved question and feature switches.
